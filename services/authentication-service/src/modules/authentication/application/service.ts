import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { AuthTransaction, AuthenticatedUser } from "./contracts.js";
import type {
  AuthenticationProvider,
  BaselineAccessProvisioner,
  DirectoryProvisioner,
} from "./ports.js";

const emailSchema = z.string().email().max(320);
const displayNameSchema = z.string().trim().min(1).max(200);

export interface SignInStart {
  authorizationUrl: string;
  transaction: AuthTransaction;
}

export interface AuthenticationSettings {
  tenantId: string;
  clientId: string;
  sessionMaxAgeSeconds: number;
}

export class AuthenticationService {
  constructor(
    private readonly entra: AuthenticationProvider,
    private readonly directory: DirectoryProvisioner,
    private readonly baselineAccess: BaselineAccessProvisioner,
    private readonly settings: AuthenticationSettings,
  ) {}

  get isConfigured(): boolean {
    return this.entra.isConfigured;
  }

  async beginSignIn(returnTo: string): Promise<SignInStart> {
    if (!this.entra.isConfigured) {
      throw new Error("Microsoft Entra sign-in is not configured");
    }

    const { challenge, verifier } = await this.entra.generatePkceCodes();
    const transaction: AuthTransaction = {
      state: randomBytes(32).toString("base64url"),
      nonce: randomBytes(32).toString("base64url"),
      codeVerifier: verifier,
      returnTo,
      createdAt: Date.now(),
    };
    const authorizationUrl = await this.entra.authorizationUrl(transaction, challenge);
    return { authorizationUrl, transaction };
  }

  async completeSignIn(code: string, transaction: AuthTransaction): Promise<AuthenticatedUser | null> {
    const claims = await this.entra.redeemAuthorizationCode(code, transaction.codeVerifier, transaction.nonce);
    const objectId = typeof claims.oid === "string" ? claims.oid : "";
    const tenantId = typeof claims.tid === "string" ? claims.tid : "";
    const audience = typeof claims.aud === "string" ? claims.aud : "";
    const nonce = typeof claims.nonce === "string" ? claims.nonce : "";
    const expiresAt = typeof claims.exp === "number" ? claims.exp : 0;
    const email = (typeof claims.email === "string" && claims.email) ||
      (typeof claims.preferred_username === "string" && claims.preferred_username) || "";
    const rawName = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : email;
    const nameResult = displayNameSchema.safeParse(rawName);

    if (!objectId || tenantId.toLowerCase() !== this.settings.tenantId.toLowerCase() ||
        audience.toLowerCase() !== this.settings.clientId.toLowerCase() ||
        !constantTimeMatch(nonce, transaction.nonce) || expiresAt <= Math.floor(Date.now() / 1000) ||
        !emailSchema.safeParse(email).success || !nameResult.success) {
      return null;
    }

    const employee = await this.directory.provision({
      tenantId,
      objectId,
      email: email.toLowerCase(),
      displayName: nameResult.data,
    });
    if (!employee.active) return null;
    await this.baselineAccess.ensureBaselineAccess(employee.employeeId);
    return {
      employeeId: employee.employeeId,
      oid: objectId,
      expiresAt: Math.min(expiresAt, Math.floor(Date.now() / 1000) + this.settings.sessionMaxAgeSeconds),
    };
  }

  logoutUrl(): string | null {
    return this.entra.logoutUrl();
  }
}

export function constantTimeMatch(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length > 0 && expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer);
}
