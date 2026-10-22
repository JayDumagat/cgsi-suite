import type { Request, Response } from "express";
import { AuthenticationService, constantTimeMatch } from "../application/service.js";
import type { EmployeeSessionProfile } from "../application/contracts.js";
import { destroySession, regenerateSession, saveSession } from "./session-operations.js";
import { authenticatedUserSchema, authTransactionSchema } from "./schemas.js";
import { safeReturnPath } from "../../../platform/security.js";
import { telemetryLog } from "../../../platform/telemetry.js";

const transactionLifetimeMs = 10 * 60 * 1000;

export class AuthenticationController {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly cookieSecure: boolean,
    private readonly cookieDomain: string,
    private readonly allowedReturnOrigins: string[],
    private readonly readEmployeeProfile: (employeeId: string) => Promise<EmployeeSessionProfile | null>,
    private readonly sessionMaxAgeSeconds: number,
  ) {}

  login = async (request: Request, response: Response): Promise<void> => {
    if (!this.authentication.isConfigured) {
      response.status(503).send("Microsoft Entra sign-in is not configured. Contact your CGSI administrator.");
      return;
    }

    try {
      const signIn = await this.authentication.beginSignIn(
        safeReturnPath(request.query.returnTo, this.allowedReturnOrigins),
        request.query.keepSignedIn === "true",
      );
      request.session.authTransaction = signIn.transaction;
      if (!signIn.transaction.keepSignedIn) {
        request.session.cookie.expires = null;
      }
      await saveSession(request);
      response.redirect(302, signIn.authorizationUrl);
    } catch (error) {
      reportFailure("Could not start Microsoft sign-in", error);
      response.status(500).send("Sign-in could not be started.");
    }
  };

  callback = async (request: Request, response: Response): Promise<void> => {
    if (!this.authentication.isConfigured) {
      response.status(503).send("Microsoft Entra sign-in is not configured. Contact your CGSI administrator.");
      return;
    }

    const transactionResult = authTransactionSchema.safeParse(request.session.authTransaction);
    const keepSignedIn = transactionResult.success && transactionResult.data.keepSignedIn === true;
    delete request.session.authTransaction;
    if (request.query.error) {
      await saveSession(request).catch(() => undefined);
      response.redirect(302, "/signin?error=microsoft");
      return;
    }

    const transaction = transactionResult.success ? transactionResult.data : null;
    const state = typeof request.query.state === "string" ? request.query.state : "";
    const code = typeof request.query.code === "string" ? request.query.code : "";
    if (!transaction || !constantTimeMatch(transaction.state, state) || !code ||
        Date.now() - transaction.createdAt > transactionLifetimeMs) {
      response.status(401).send("Sign-in could not be verified. Start again from CGSI Cube.");
      return;
    }

    try {
      const user = await this.authentication.completeSignIn(code, transaction);
      if (!user) {
        response.status(401).send("Microsoft sign-in could not be verified. Contact your CGSI administrator.");
        return;
      }
      await regenerateSession(request);
      if (keepSignedIn) {
        request.session.cookie.maxAge = this.sessionMaxAgeSeconds * 1000;
      } else {
        request.session.cookie.expires = null;
      }
      request.session.user = user;
      await saveSession(request);
      response.redirect(302, transaction.returnTo);
    } catch (error) {
      reportFailure("Microsoft sign-in could not be completed", error);
      response.status(502).send("Microsoft sign-in could not be completed. Contact your CGSI administrator.");
    }
  };

  session = async (request: Request, response: Response): Promise<void> => {
    const parsed = authenticatedUserSchema.safeParse(request.session.user);
    if (!parsed.success || parsed.data.expiresAt <= Math.floor(Date.now() / 1000)) {
      response.status(401).json({ error: "unauthenticated" });
      return;
    }
    const { oid, employeeId, email, name } = parsed.data;
    if (employeeId) {
      const employee = await this.readEmployeeProfile(employeeId);
      if (!employee?.active) {
        await destroySession(request);
        response.status(401).json({ error: "unauthenticated" });
        return;
      }
      response.status(200).json({
        authenticated: true,
        user: { oid, email: employee.email, name: employee.displayName },
      });
      return;
    }
    response.status(200).json({ authenticated: true, user: { oid, email, name } });
  };

  logout = async (request: Request, response: Response): Promise<void> => {
    await destroySession(request);
    response.clearCookie("cgsi_session", {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: "lax",
      path: "/",
      ...(this.cookieDomain ? { domain: this.cookieDomain } : {}),
    });
    response.status(200).json({ logoutUrl: this.authentication.logoutUrl() ?? "/signin" });
  };
}

function reportFailure(message: string, error: unknown): void {
  const errorType = error instanceof Error ? error.name : "unknown";
  telemetryLog("ERROR", message, { error_type: errorType });
}
