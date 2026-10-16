# Architecture

## Application boundary

Cube, CDEX (CRM), and BILS (Billing and Invoice Lifecycle System) are separate React/Vite frontends under `apps/`, each with its own static-web container image and dependency lockfile. Nginx keeps the `/`, `/crm/`, and `/billing/` paths for local development and also routes production hosts `cdex.<domain>` and `bils.<domain>` to their frontend containers. HUMA (HRIS) and RDES (ticketing and support) are catalog placeholders until their frontends are implemented.

The TailAdmin theme, component CSS, app-card component, and frontend catalog contract are shared. Existing page code and route trees remain app-owned. This keeps the current frontend design while allowing common design fixes to ship consistently.

## Backend services

Each backend boundary is an independently built microservice. Only `identity-service` uses Express 5, strict TypeScript, and MSAL Node to connect to Microsoft Entra. The other services use Go and call internal HTTP APIs; they do not receive Entra credentials.

| Service | Language/runtime | Responsibility | Internal port |
| --- | --- | --- | ---: |
| `identity-service` | TypeScript / Express | MSAL authorization-code + PKCE, Entra ID token claims, PostgreSQL employee session | 8081 |
| `app-catalog-service` | Go | Authenticated app directory and app permission checks | 8082 |
| `authorization-service` | Go | OpenFGA store/model bootstrap, checks, membership and admin relationship writes | 8083 |
| `crm-service` | Go | CRM module API boundary and health endpoint scaffold | 8084 |
| `billing-service` | Go | Billing module API boundary and health endpoint scaffold | 8085 |
| `openfga` | OpenFGA | Relationship-based authorization engine | 8080 |

## Local platform services

Compose also runs Redis for cache/ephemeral state, RabbitMQ for asynchronous messaging, MinIO for S3-compatible object storage, Jenkins for CI orchestration, and the Prometheus/Grafana/Loki/OpenTelemetry/Tempo observability stack. These services share the Compose network and named persistent volumes. Their host ports are bound to loopback for local development; they are not exposed through Nginx.

The OpenTelemetry Collector accepts OTLP over gRPC and HTTP and routes traces to Tempo, metrics to a Prometheus scrape endpoint, and logs to Loki. Identity, catalog, authorization, CRM, and Billing now emit privacy-filtered HTTP request spans, low-cardinality request metrics, and structured request logs over OTLP/HTTP. W3C trace context is propagated across internal HTTP calls. Grafana provisions the three data sources at startup. RabbitMQ metrics are scraped from its Prometheus plugin; database client spans and domain-specific metrics will be added with each service's data APIs.

MinIO Community Edition is archived upstream and no longer receives official container builds. Compose pins a community-built image of the final patched upstream release for local development only. Do not store production data in this container; choose a currently maintained object-store distribution for production.

Jenkins runs as a controller with persistent home storage. It does not mount the host Docker socket; add a restricted build agent before configuring pipelines that build or deploy containers.

Nginx is the only public gateway. Internal service calls use separate tokens for authorization checks, identity provisioning, and administrative relationship writes. Health endpoints are used as Compose readiness checks; the authorization service only starts after its OpenFGA store and model are ready.

Nginx gates CDEX and BILS frontend routes and API prefixes through the app catalog. The catalog requires a valid employee session and an OpenFGA `can_access` result; unauthenticated browser navigation returns to Cube sign-in, while APIs return an authorization status. These modules remain unavailable until their catalog status changes from `coming_soon`. Locally, the apps use same-origin paths so the browser session stays on `localhost`. In production, set `COOKIE_DOMAIN` to a shared parent such as `.yourdomain.com`, enable secure cookies, list the exact Cube/CDEX/BILS origins in `AUTH_ALLOWED_RETURN_ORIGINS`, and set `CUBE_PUBLIC_URL` to the public Cube URL.

## Shared data store

PostgreSQL has one database, `cgsi`, backed by a persistent Compose volume. `postgres-migrate` applies versioned migrations on both new and existing volumes. The database now contains `directory`, `iam`, `audit`, and `platform` schemas plus the Cube, CDEX, BILS, HUMA, and RDES application schema boundaries. The identity service uses a restricted `cgsi_identity` role; OpenFGA tables remain engine-managed in the same database for now. CRM and Billing business tables and repositories will be added when their APIs are implemented.

The migration runner and OpenFGA still use the local `cgsi_admin` bootstrap credential. OpenFGA's datastore and tuples have not been moved because that would require a data migration. The identity service uses `cgsi_identity`, with grants limited to the directory, baseline IAM membership, audit inserts, outbox, and session tables. Add service-specific database roles before CRM/Billing/HUMA/RDES persist business data. The Compose OpenFGA URI still requires a URL-safe password.

## Nginx routes

| Path | Destination |
| --- | --- |
| `/` | Cube frontend |
| `/crm/` | CRM frontend |
| `/billing/` | Billing frontend |
| `/api/auth/*` | Identity service |
| `/api/v1/apps` | App catalog service |
| `/api/crm/*` | CRM service |
| `/api/billing/*` | Billing service |
| `cdex.<domain>` | CDEX frontend |
| `bils.<domain>` | BILS frontend |

The existing frontends share the same public image assets. Nginx serves them from the common TailAdmin image set. When app-specific imagery is introduced, move those assets to app-prefixed paths.

## Repository structure and conventions

```text
services/
  authentication-service/       # Express + MSAL; Compose service is identity-service
    src/
      application/              # sign-in and session workflows
      config/                   # environment configuration
      infrastructure/           # Entra, Postgres, and internal service clients
      modules/authentication/   # auth types, validation, HTTP controller and routes
      platform/                 # shared Express setup and security helpers
    package.json                # auth-only dependencies and scripts
    Dockerfile                  # authentication-service image
  app-catalog-service/          # Go app directory API
    cmd/                        # service entrypoint
    internal/
      application/              # app directory workflows and dependency ports
      config/                   # environment configuration
      domain/                   # app metadata, employee identity, and domain errors
      infrastructure/           # identity and OpenFGA HTTP clients
      transport/http/           # HTTP handlers
  authorization-service/        # Go OpenFGA integration API
    cmd/                        # service entrypoint
    internal/
      application/               # authorization checks, writes, and bootstrap workflow
      config/                   # environment configuration
      domain/                   # authorization tuple and validation
      infrastructure/openfga/   # OpenFGA client and embedded authorization model
      transport/http/           # HTTP handlers
  crm-service/                  # Go CRM API
    cmd/                        # service entrypoint
    internal/{application,domain,transport/http}/
  billing-service/              # Go billing API
    cmd/                        # service entrypoint
    internal/{application,domain,transport/http}/
  healthcheck/                  # Go container health-check helper
  shared/                       # Go HTTP server and JSON response helpers
  go.mod                        # shared Go module for the Go services
  Dockerfile                    # builds a selected Go service image
apps/cube/                       # Cube React/Vite frontend
apps/cdex/                       # CDEX React/Vite frontend
apps/bils/                       # BILS React/Vite frontend
infra/nginx/                     # reverse proxy and frontend image
infra/postgres/init/             # shared database schema setup
infra/rabbitmq/                  # management and Prometheus plugins
infra/prometheus/                # Prometheus scrape configuration
infra/grafana/provisioning/      # preconfigured Prometheus, Loki, and Tempo sources
infra/loki/                      # local log storage configuration
infra/tempo/                     # local trace storage configuration
infra/otel-collector/            # OTLP receiver and signal routing
packages/                        # shared frontend UI and API contracts
scripts/                         # local Compose integration smoke checks
.github/workflows/               # CI, integration checks, and image publishing
package.json                     # cross-platform root commands
docs/                            # architecture, authorization, and M365 setup
```

- Keep service entrypoints thin and put service behavior in service-owned modules.
- In Go services, keep startup wiring in `cmd/`, use `internal/domain/` for business types and rules, `internal/application/` for workflows and dependency ports, `internal/infrastructure/` for external systems, and `internal/transport/http/` for request/response mapping. Add service-owned persistence adapters under infrastructure when data access is introduced.
- In the authentication service, keep Express controllers/routes, sign-in workflows, environment configuration, and Entra/PostgreSQL integrations in their respective `src/modules`, `src/application`, `src/config`, and `src/infrastructure` packages.
- Use explicit request/response contracts, bounded request bodies, and bounded internal HTTP timeouts.
- Fail closed when identity or authorization dependencies are unavailable.
- Keep tenant credentials and service tokens in runtime secrets, never frontend source or Vite build variables.
- Keep TypeScript and MSAL dependencies scoped to the identity service. Use idiomatic, formatted Go for the remaining backend services.
- Frontend route pages stay under each app's `src/pages/`; shared browser contracts and UI belong in `packages/contracts` and `packages/ui`.
