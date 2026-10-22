import { createAuthenticationApp, drainAuthorizationOutbox, fallbackPort, serviceName } from "./app.js";
import { sessionPool, sessionStore } from "./infrastructure/persistence/session-store.js";
import { shutdownTelemetry, telemetryLog } from "./platform/telemetry.js";
import { listen, portFromEnvironment } from "./platform/http.js";

export function startAuthenticationService(): void {
  const app = createAuthenticationApp();
  const outboxTimer = setInterval(() => {
    void drainAuthorizationOutbox().catch(() => {
      telemetryLog("ERROR", "authorization_outbox_dispatch_failed");
    });
  }, 5_000);
  outboxTimer.unref();
  listen(app, portFromEnvironment(fallbackPort), serviceName, async () => {
    clearInterval(outboxTimer);
    await drainAuthorizationOutbox().catch(() => undefined);
    sessionStore.close();
    await sessionPool.end();
    await shutdownTelemetry();
  });
}
