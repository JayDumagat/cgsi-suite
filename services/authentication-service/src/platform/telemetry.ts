import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { Request, RequestHandler } from "express";

type AttributeValue = { stringValue: string } | { intValue: string } | { doubleValue: number } | { boolValue: boolean };
type Attribute = { key: string; value: AttributeValue };

interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

interface HttpMetric {
  method: string;
  statusClass: string;
  count: number;
  durationSum: number;
  buckets: number[];
}

const traceContext = new AsyncLocalStorage<TraceContext>();
const traceQueue: Record<string, unknown>[] = [];
const logQueue: Record<string, unknown>[] = [];
const metricSeries = new Map<string, HttpMetric>();
const metricBounds = [5, 10, 25, 50, 100, 250, 500, 1000, 5000];
const allowedLogFields = new Set([
  "service", "port", "signal", "error_type", "http_method", "http_route",
  "http_status_code", "duration_ms",
]);
const processStart = BigInt(Date.now()) * 1_000_000n;
const resource = {
  attributes: [
    { key: "service.name", value: { stringValue: process.env.OTEL_SERVICE_NAME || "identity-service" } },
    { key: "service.version", value: { stringValue: "0.1.0" } },
    { key: "deployment.environment.name", value: { stringValue: process.env.OTEL_DEPLOYMENT_ENVIRONMENT || "development" } },
  ],
};
const otlpBase = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://otel-collector:4318").replace(/\/$/, "");
const flushTimer = setInterval(() => void flushTelemetry(), 5_000);
flushTimer.unref();

export function currentTraceparent(): string | undefined {
  const current = traceContext.getStore();
  return current ? `00-${current.traceId}-${current.spanId}-01` : undefined;
}

export function httpTelemetry(service: string): RequestHandler {
  return (request, response, next) => {
    const parent = parseTraceparent(request.header("traceparent"));
    const current: TraceContext = {
      traceId: parent?.traceId ?? randomHex(16),
      spanId: randomHex(8),
      ...(parent ? { parentSpanId: parent.spanId } : {}),
    };
    const start = performance.now();
    const startNs = BigInt(Date.now()) * 1_000_000n;

    traceContext.run(current, () => {
      response.once("finish", () => {
        const duration = performance.now() - start;
        const route = routeTemplate(request);
        const status = response.statusCode;
        const statusClass = `${Math.floor(status / 100)}xx`;
        const method = normalizedMethod(request.method);
        recordHttpMetric(method, statusClass, duration);
        const attributes: Attribute[] = [
          stringAttribute("http.request.method", method),
          stringAttribute("http.route", route),
          intAttribute("http.response.status_code", status),
          doubleAttribute("http.server.duration", duration),
        ];
        traceQueue.push({
          traceId: Buffer.from(current.traceId, "hex").toString("base64"),
          spanId: Buffer.from(current.spanId, "hex").toString("base64"),
          ...(current.parentSpanId ? { parentSpanId: Buffer.from(current.parentSpanId, "hex").toString("base64") } : {}),
          name: `${method} ${route}`,
          kind: 2,
          startTimeUnixNano: startNs.toString(),
          endTimeUnixNano: (startNs + BigInt(Math.round(duration * 1_000_000))).toString(),
          attributes,
          status: { code: status >= 500 ? 2 : 1 },
        });
        telemetryLog(status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO", "http_request", {
          service,
          http_method: method,
          http_route: route,
          http_status_code: status,
          duration_ms: Math.round(duration * 100) / 100,
        });
      });
      next();
    });
  };
}

export function telemetryLog(
  severity: "INFO" | "WARN" | "ERROR",
  message: string,
  fields: Record<string, string | number | boolean> = {},
): void {
  const current = traceContext.getStore();
  const safeFields = Object.fromEntries(Object.entries(fields).filter(([key]) => allowedLogFields.has(key)));
  const consoleRecord = {
    timestamp: new Date().toISOString(),
    level: severity.toLowerCase(),
    message,
    ...(current ? { trace_id: current.traceId } : {}),
    ...safeFields,
  };
  process.stdout.write(`${JSON.stringify(consoleRecord)}\n`);

  const severityNumber = severity === "ERROR" ? 17 : severity === "WARN" ? 13 : 9;
  logQueue.push({
    timeUnixNano: (BigInt(Date.now()) * 1_000_000n).toString(),
    observedTimeUnixNano: (BigInt(Date.now()) * 1_000_000n).toString(),
    severityNumber,
    severityText: severity,
    body: { stringValue: message },
    ...(current ? {
      traceId: Buffer.from(current.traceId, "hex").toString("base64"),
      spanId: Buffer.from(current.spanId, "hex").toString("base64"),
    } : {}),
    attributes: Object.entries(safeFields).map(([key, value]) => attribute(key, value)),
  });
}

export async function shutdownTelemetry(): Promise<void> {
  clearInterval(flushTimer);
  await flushTelemetry();
}

export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number> = {},
  operation: () => Promise<T>,
): Promise<T> {
  const parent = traceContext.getStore();
  if (!parent) return operation();

  const child: TraceContext = {
    traceId: parent.traceId,
    spanId: randomHex(8),
    parentSpanId: parent.spanId,
  };
  const startNs = BigInt(Date.now()) * 1_000_000n;
  const start = performance.now();
  let failed = false;
  try {
    return await traceContext.run(child, operation);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    const duration = performance.now() - start;
    traceQueue.push({
      traceId: Buffer.from(child.traceId, "hex").toString("base64"),
      spanId: Buffer.from(child.spanId, "hex").toString("base64"),
      parentSpanId: Buffer.from(parent.spanId, "hex").toString("base64"),
      name,
      kind: 1,
      startTimeUnixNano: startNs.toString(),
      endTimeUnixNano: (startNs + BigInt(Math.round(duration * 1_000_000))).toString(),
      attributes: [
        doubleAttribute("operation.duration", duration),
        ...Object.entries(attributes).map(([key, value]) =>
          typeof value === "number" ? intAttribute(key, value) : stringAttribute(key, value),
        ),
      ],
      status: { code: failed ? 2 : 1 },
    });
  }
}

function parseTraceparent(value: string | undefined): { traceId: string; spanId: string } | undefined {
  if (!value) return undefined;
  const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(value.trim());
  if (!match || /^0+$/.test(match[1]!) || /^0+$/.test(match[2]!)) return undefined;
  return { traceId: match[1]!.toLowerCase(), spanId: match[2]!.toLowerCase() };
}

function routeTemplate(request: Request): string {
  const routePath = request.route?.path;
  if (typeof routePath !== "string") return "unmatched";
  return `${request.baseUrl}${routePath}`.slice(0, 128);
}

function normalizedMethod(value: string): string {
  return ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(value) ? value : "OTHER";
}

function randomHex(byteCount: number): string {
  return randomBytes(byteCount).toString("hex");
}

function recordHttpMetric(method: string, statusClass: string, duration: number): void {
  const key = `${method}|${statusClass}`;
  let series = metricSeries.get(key);
  if (!series) {
    series = { method, statusClass, count: 0, durationSum: 0, buckets: Array(metricBounds.length + 1).fill(0) as number[] };
    metricSeries.set(key, series);
  }
  series.count += 1;
  series.durationSum += duration;
  const bucketIndex = metricBounds.findIndex((bound) => duration <= bound);
  const bucket = bucketIndex < 0 ? metricBounds.length : bucketIndex;
  series.buckets[bucket] = (series.buckets[bucket] ?? 0) + 1;
}

function stringAttribute(key: string, value: string): Attribute {
  return { key, value: { stringValue: value } };
}

function intAttribute(key: string, value: number): Attribute {
  return { key, value: { intValue: String(value) } };
}

function doubleAttribute(key: string, value: number): Attribute {
  return { key, value: { doubleValue: value } };
}

function attribute(key: string, value: string | number | boolean): Record<string, unknown> {
  if (typeof value === "string") return { key, value: { stringValue: value } };
  if (typeof value === "boolean") return { key, value: { boolValue: value } };
  return { key, value: { intValue: String(value) } };
}

async function flushTelemetry(): Promise<void> {
  const spans = traceQueue.splice(0, 100);
  const logs = logQueue.splice(0, 100);
  const metricPoints = Array.from(metricSeries.values());
  const now = (BigInt(Date.now()) * 1_000_000n).toString();
  const requests = [
    spans.length ? exportOtlp("traces", {
      resourceSpans: [{ resource, scopeSpans: [{ scope: { name: "cgsi-suite" }, spans }] }],
    }) : Promise.resolve(),
    logs.length ? exportOtlp("logs", {
      resourceLogs: [{ resource, scopeLogs: [{ scope: { name: "cgsi-suite" }, logRecords: logs }] }],
    }) : Promise.resolve(),
    metricPoints.length ? exportOtlp("metrics", {
      resourceMetrics: [{
        resource,
        scopeMetrics: [{ scope: { name: "cgsi-suite" }, metrics: [
          {
            name: "http.server.request.count",
            unit: "{request}",
            sum: {
              aggregationTemporality: 2,
              isMonotonic: true,
              dataPoints: metricPoints.map((point) => ({
                startTimeUnixNano: processStart.toString(),
                timeUnixNano: now,
                asInt: String(point.count),
                attributes: metricAttributes(point),
              })),
            },
          },
          {
            name: "http.server.duration",
            unit: "ms",
            histogram: {
              aggregationTemporality: 2,
              dataPoints: metricPoints.map((point) => ({
                startTimeUnixNano: processStart.toString(),
                timeUnixNano: now,
                count: String(point.count),
                sum: point.durationSum,
                explicitBounds: metricBounds,
                bucketCounts: point.buckets.map(String),
                attributes: metricAttributes(point),
              })),
            },
          },
        ] }],
      }],
    }) : Promise.resolve(),
  ];
  await Promise.all(requests);
}

function metricAttributes(point: HttpMetric): Record<string, unknown>[] {
  return [
    { key: "http.request.method", value: { stringValue: point.method } },
    { key: "http.response.status_class", value: { stringValue: point.statusClass } },
  ];
}

async function exportOtlp(signal: "traces" | "logs" | "metrics", payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${otlpBase}/v1/${signal}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2_000),
    });
  } catch {
    // Telemetry must not block authentication or leak request data into fallback logs.
  }
}
