import type { Express } from "express";
import { AuthenticationService } from "./modules/authentication/application/service.js";
import { config } from "./config/environment.js";
import { EntraClient } from "./infrastructure/entra/client.js";
import { writeEmployeeGroupMembership } from "./infrastructure/authorization/membership-client.js";
import { sessionPool, createSessionMiddleware } from "./infrastructure/persistence/session-store.js";
import { DirectoryRepository } from "./infrastructure/persistence/directory.js";
import { AuthorizationOutboxDispatcher } from "./infrastructure/persistence/outbox-dispatcher.js";
import { EmployeeDirectoryService } from "./modules/directory/application/service.js";
import { ErisDirectoryController } from "./modules/directory/http/eris-controller.js";
import { AuthenticationController } from "./modules/authentication/http/controller.js";
import { createAuthenticationRoutes } from "./modules/authentication/http/routes.js";
import { createApp, errorHandler, notFound } from "./platform/http.js";
import { httpTelemetry } from "./platform/telemetry.js";

export function createAuthenticationApp(): Express {
  const app = createApp();
  const directory = new EmployeeDirectoryService(new DirectoryRepository(sessionPool));
  const erisDirectory = new ErisDirectoryController(directory, config.erisDirectoryServiceToken);
  const outbox = new AuthorizationOutboxDispatcher(sessionPool, writeEmployeeGroupMembership);
  dispatchAuthorizationOutbox = () => outbox.dispatchPending();
  app.set("trust proxy", 1);
  app.use(httpTelemetry(serviceName));
  app.use(createSessionMiddleware());

  app.get("/healthz", async (_request, response) => {
    try {
      await sessionPool.query("SELECT 1");
      response.status(200).json({ service: "identity-service", status: "ok" });
    } catch {
      response.status(503).json({ service: "identity-service", status: "starting" });
    }
  });

  const authentication = new AuthenticationService(
    new EntraClient(),
    {
      provision: async (profile) => {
        const employee = await directory.provisionFromVerifiedEntra(profile);
        return { employeeId: employee.employeeId, active: employee.active };
      },
    },
    { ensureBaselineAccess: (employeeId) => outbox.dispatchPending(employeeId) },
    config,
  );
  const controller = new AuthenticationController(
    authentication,
    config.cookieSecure,
    config.cookieDomain,
    config.allowedReturnOrigins,
    (employeeId) => directory.readActiveProfile(employeeId),
    config.sessionMaxAgeSeconds,
  );
  app.use("/api/auth", createAuthenticationRoutes(controller));
  app.get("/internal/eris/employees", erisDirectory.listEmployees);
  app.get("/internal/eris/employees/:employeeId", erisDirectory.getEmployee);
  app.post("/internal/eris/employees", erisDirectory.createEmployee);
  app.put("/internal/eris/employees/:employeeId", erisDirectory.updateEmployee);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export const serviceName = "identity-service";
export const fallbackPort = 8081;

let dispatchAuthorizationOutbox: () => Promise<void> = async () => undefined;

export function drainAuthorizationOutbox(): Promise<void> {
  return dispatchAuthorizationOutbox();
}
