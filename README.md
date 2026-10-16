# CGSI Suite

CGSI Suite is a single workspace for several separately deployed applications. **Cube** is the app directory and employee sign-in entry point. CDEX (CRM) and BILS (Billing and Invoice Lifecycle System) keep their own frontend builds and service boundaries.

## Start the local suite

1. Copy `.env.example` to `.env` and replace the local secrets.
2. Add the Microsoft Entra tenant ID, app registration client ID, and client secret. The client secret stays in the identity service; it is never built into a frontend.
3. Run `docker compose up --build`.
4. Open [http://localhost:8080](http://localhost:8080).

Locally, CDEX and BILS use the same-origin paths `/crm/` and `/billing/` so Microsoft sign-in can use the `localhost` callback. The gateway is also configured to route production hosts such as `cdex.yourdomain.com` and `bils.yourdomain.com`; production must use HTTPS and set a shared cookie domain and allowed return origins.

The same Compose stack also starts the local platform tools. Grafana is available at `http://localhost:3000`, Prometheus at `http://localhost:9090`, Jenkins at `http://localhost:8081`, RabbitMQ Management at `http://localhost:15672`, and the MinIO Console at `http://localhost:9001`. See [docs/local-platform-tools.md](docs/local-platform-tools.md) for credentials, internal service addresses, and observability wiring.

If the Entra app registration values are empty, the Cube directory and APIs start, but the sign-in endpoint returns a setup message.

For frontend-only development, run `npm run setup` once, then start Cube, CDEX, or BILS with `npm run dev --prefix apps/cube`, `npm run dev --prefix apps/cdex`, or `npm run dev --prefix apps/bils`. Cube uses port 5173, CDEX uses port 5174 under `/crm/`, and BILS uses port 5175 under `/billing/`. The app directory API proxy expects the Compose gateway on port 8080. The Compose gateway hostnames are the production-shaped test path.

Run the local checks with `npm run ci`. The root commands run Go tests and vet, identity service tests and type checks, frontend lint/build checks, and production-bundle smoke tests. To test the built Compose stack, run `npm run test:integration`. See [the testing and deployment guide](docs/testing-and-deployment.md) for individual commands, production image releases, and the Compose deployment flow.

## Current application directory

| App | Frontend | API service | Cube status |
| --- | --- | --- | --- |
| Cube | `apps/cube` | identity, catalog, authorization | Available |
| CDEX (CRM) | `apps/cdex` | `crm-service` scaffold | Coming soon |
| BILS (Billing and Invoice Lifecycle System) | `apps/bils` | `billing-service` scaffold | Coming soon |
| HUMA (HRIS) | Planned | Planned | Coming soon |
| RDES (ticketing and support) | Planned | Planned | Coming soon |

## Repository layout

```text
apps/
  cube/                           # Cube React/Vite frontend
  cdex/                           # CDEX React/Vite frontend
  bils/                           # BILS React/Vite frontend
services/
  authentication-service/       # Express + MSAL; Compose service is identity-service
  app-catalog-service/          # Go app directory API
  authorization-service/        # Go OpenFGA integration API
  crm-service/                  # Go CRM API
  billing-service/              # Go billing API
  shared/                       # shared Go platform packages
  Dockerfile                    # builds a selected Go service
infra/
  nginx/                        # single reverse proxy and frontend image
  postgres/init/                # first-volume schema bootstrap
  postgres/migrations/          # versioned upgrades for existing and new volumes
  openbao/                      # optional local secrets manager configuration
packages/
  contracts/                    # shared frontend API types
  design-system/                # shared Tailwind theme and component styles
  ui/                           # small cross-frontend UI package
docs/                           # architecture and identity setup notes
scripts/                        # local integration smoke checks
.github/workflows/              # CI checks and version-tag image publishing
package.json                    # cross-platform task entry points
```

Each app remains its own frontend build with a separate lockfile. The root npm scripts orchestrate the apps and Go services without adding another task-runner package. The existing TailAdmin theme CSS is shared from `packages/design-system/theme.css`; reusable cross-app UI and API types live in `packages/ui` and `packages/contracts`. App-specific pages and APIs stay in their app folders.

## Platform decisions

- **Identity:** only the Express `identity-service` uses MSAL Node for Microsoft Entra workforce-tenant sign-in. The browser receives an HttpOnly server-side session cookie.
- **Managed devices:** Intune reports compliance to Entra ID. Entra Conditional Access must require compliant devices for the CGSI enterprise app. The app does not query Intune directly.
- **Permissions:** the authorization service checks OpenFGA before the catalog advertises app access. The model includes app roles plus record-level CRM and invoice relations.
- **Backend:** only `identity-service` runs Express/TypeScript and uses MSAL Node. The app catalog, authorization, CRM, and Billing services are Go microservices. Service bounded contexts and dependency rules are documented in [the DDD context map](docs/domain-driven-design.md). CRM and Billing APIs remain scaffolds; their business use cases are not implemented yet.
- **Data:** PostgreSQL (`cgsi`) now holds the minimal local employee directory, Entra identity links, IAM groups/roles/permissions, audit history, sessions, outbox, and app-owned schemas. Versioned migrations run as a one-shot Compose service; identity uses a restricted PostgreSQL login. OpenFGA retains its engine-owned tables in the same database instance for now.
- **Observability:** backend services emit structured logs, HTTP spans, and request metrics over OTLP/HTTP to the existing Collector, which routes to Loki, Tempo, and Prometheus.
- **Edge:** Nginx serves Cube at `/`, CDEX at `/crm/`, and BILS at `/billing/` locally. It also routes production hosts such as `cdex.<domain>` and `bils.<domain>` to their frontends. Configure `COOKIE_DOMAIN` and `AUTH_ALLOWED_RETURN_ORIGINS` for the shared session and safe sign-in return across production subdomains. The API, database, and OpenFGA ports are not published, except the authorization admin endpoint bound to localhost for local permission setup.

## Local app access assignment

After signing in, the employee is provisioned locally and assigned to `all-employees`. The transactional outbox projects that group membership to OpenFGA; the seeded `cube.employee` role grants baseline Cube access. CRM and Billing remain unavailable until a user or group is granted access.

For local development, grant one employee the CRM app relation through the localhost-only authorization admin endpoint:

```powershell
$headers = @{ "X-CGSI-Service-Token" = "<AUTHORIZATION_ADMIN_TOKEN from .env>" }
$body = @{ user = "user:<ENTRA_OBJECT_ID>"; relation = "viewer"; object = "app:crm" } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "http://localhost:8083/v1/relationships" -Headers $headers -ContentType "application/json" -Body $body
```

The admin endpoint is deliberately not routed by Nginx. Keep it bound to loopback, and do not publish it on a network interface. Use a separate admin token from the service-to-service tokens.

See [docs/architecture.md](docs/architecture.md), [docs/data-platform-and-privacy-blueprint.md](docs/data-platform-and-privacy-blueprint.md), [docs/secrets-management.md](docs/secrets-management.md), [docs/identity-and-device-access.md](docs/identity-and-device-access.md), [docs/m365-setup.md](docs/m365-setup.md), and [docs/permissions.md](docs/permissions.md) for service boundaries and setup details. The M365 guide also includes the Postgres password-volume recovery steps for the reported `cgsi_admin` authentication error.
