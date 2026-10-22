import express, { type ErrorRequestHandler, type Express, type RequestHandler } from "express";
import helmet from "helmet";
import { telemetryLog } from "./telemetry.js";

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "16kb", strict: true }));
  app.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  return app;
}

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: "not_found" });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const statusCode = error instanceof SyntaxError ? 400 : 500;
  response.status(statusCode).json({ error: statusCode === 400 ? "invalid_json" : "internal_error" });
};

export function healthRoute(service: string, ready: () => boolean = () => true): RequestHandler {
  return (_request, response) => {
    const isReady = ready();
    response.status(isReady ? 200 : 503).json({ service, status: isReady ? "ok" : "starting" });
  };
}

export function listen(app: Express, port: number, service: string, onShutdown?: () => Promise<void>): void {
  const server = app.listen(port, "0.0.0.0", () => {
    telemetryLog("INFO", "service_listening", { service, port });
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 20_000;
  server.keepAliveTimeout = 5_000;

  const shutdown = (signal: NodeJS.Signals) => {
    telemetryLog("INFO", "service_shutdown_started", { service, signal });
    server.close((error) => {
      if (error) {
        telemetryLog("ERROR", "http_server_shutdown_failed", { service, error_type: error.name });
        process.exitCode = 1;
      }
      if (onShutdown) {
        void onShutdown().catch((shutdownError: unknown) => {
          const errorType = shutdownError instanceof Error ? shutdownError.name : "unknown";
          telemetryLog("ERROR", "service_shutdown_cleanup_failed", { service, error_type: errorType });
          process.exitCode = 1;
        });
      }
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

export function portFromEnvironment(fallback: number): number {
  const value = process.env.PORT?.trim();
  if (!value) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be a valid TCP port");
  }
  return port;
}
