# Local platform tools

The root `docker-compose.yml` starts the application suite and its supporting developer tools on the default private Compose network. Admin interfaces bind to `127.0.0.1` on the host and are not routed through Nginx.

## Local access

| Tool | Local address | Container address | Notes |
| --- | --- | --- | --- |
| OpenFGA console | `http://localhost:3001` | `openfga-console:80` | Lists the existing stores, current authorization model and relationship tuples; includes a read-only access check. The API is available at `http://localhost:8180`. Both host ports bind to loopback. |
| Grafana | `http://localhost:3000` | `grafana:3000` | Uses `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD`; Prometheus, Loki, and Tempo are provisioned as data sources. |
| Prometheus | `http://localhost:9090` | `prometheus:9090` | Scrapes itself, OpenTelemetry Collector metrics, and RabbitMQ metrics. |
| Jenkins | `http://localhost:8081` | `jenkins:8080` | Complete the setup wizard. Retrieve its initial unlock key with `docker compose logs jenkins`. |
| RabbitMQ Management | `http://localhost:15672` | `rabbitmq:15672` | Uses `RABBITMQ_DEFAULT_USER` and `RABBITMQ_DEFAULT_PASS`; AMQP is available on port `5672`. |
| MinIO Console | `http://localhost:9001` | `minio:9001` | Uses `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`; the S3 API is available on port `9000`. |
| Redis | `localhost:6379` | `redis:6379` | Requires `REDIS_PASSWORD`. |
| Loki | `http://localhost:3100` | `loki:3100` | Receives OpenTelemetry logs at `/otlp/v1/logs`. |
| Tempo | `http://localhost:3200` | `tempo:3200` | Stores traces locally and accepts OTLP from the Collector. |
| OpenTelemetry Collector | `localhost:4317` / `localhost:4318` | `otel-collector:4317` / `otel-collector:4318` | OTLP gRPC and HTTP receivers. |
| OpenBao (optional) | `http://localhost:8200/ui` | `openbao:8200` | Start with `docker compose --profile secrets up -d openbao`; persistent local storage, initially sealed. See [secrets-management.md](secrets-management.md). |

Set secrets and optional host port overrides in `.env`. The fallback values in Compose are for local development only. All tool data is stored in named volumes; `docker compose down` preserves it.

## Telemetry flow

```text
Backend OTLP/HTTP exporters -> OpenTelemetry Collector -> Tempo (traces)
                                                     -> Prometheus scrape endpoint (metrics)
                                                     -> Loki OTLP endpoint (logs)
Grafana -> Prometheus, Loki, and Tempo
Prometheus -> OpenTelemetry Collector and RabbitMQ
```

Identity, catalog, authorization, CRM, and Billing emit privacy-filtered structured request logs, traces, and low-cardinality HTTP metrics over OTLP/HTTP. Trace context is propagated on internal HTTP calls. Redis metrics are collected through the Collector's Redis receiver, and RabbitMQ metrics are enabled through the `rabbitmq_prometheus` plugin. Database client spans and business-service-specific metrics still need to be added as those APIs are implemented.

## Jenkins and object storage

Jenkins is a persistent controller instance and is not mounted to the Docker daemon. Use a restricted build agent for image builds instead of granting the controller unrestricted access to the host Docker socket.

MinIO Community Edition is archived upstream, and its official container image is no longer maintained. This Compose setup pins a community-built image of the final patched upstream release for local development. Treat it as disposable development storage and do not use it for production data.
