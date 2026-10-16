# Testing and deployment

## Local setup

Install the locked dependencies for all four Node projects and the Go toolchain once:

```powershell
npm run setup
```

The applications retain separate lockfiles so each frontend or service can also be installed and built on its own. The root `package.json` orchestrates commands without adding a task-runner dependency.

## Test levels

Run the full local CI set with:

```powershell
npm run ci
```

The checks cover:

- Go domain and application unit tests, HTTP handler tests, and adapter tests using `httptest`.
- Identity-service application/domain unit tests using Node's built-in test runner.
- TypeScript checks and ESLint for each React app, followed by production bundle tests that verify the HTML entry and emitted assets.
- Go static analysis and builds.

The focused commands are `npm run test:go`, `npm run test:identity`, `npm run test:frontends`, `npm run lint`, and `npm run build`.

For an integration smoke test against the local Compose services, run:

```powershell
docker compose up --build --detach gateway
npm run smoke:local
```

Or run both steps with `npm run test:integration`. It checks the gateway and Cube static bundle, plus the anonymous identity-session and app-catalog authorization responses. It does not complete Microsoft OAuth because that requires a real Entra app registration and browser sign-in.

## Local deployment

Copy `.env.example` to `.env`, configure the local secrets and Entra app registration, then run:

```powershell
docker compose up --build --detach
docker compose ps
```

Open `http://localhost:8080`. Cube remains at `/`; CDEX and BILS use `/crm/` and `/billing/` locally so they can share the localhost sign-in cookie.

## Production images and Compose

The GitHub Actions workflow runs tests and a Compose smoke check for pushes and pull requests. Pushing a version tag such as `v1.2.0` publishes nine images to GitHub Container Registry: the Cube, CDEX, and BILS web apps; identity, authorization, app catalog, CDEX, and BILS APIs; and the gateway. Frontend images build separately, so a production release can update one web app without rebuilding the others. The workflow uses the repository's built-in `GITHUB_TOKEN`; it does not need registry credentials stored as repository secrets.

On the production host, create a deployment `.env` with the application secrets and these image selectors:

```dotenv
CGSI_IMAGE_PREFIX=ghcr.io/your-github-owner
CGSI_IMAGE_TAG=v1.2.0
COOKIE_SECURE=true
COOKIE_DOMAIN=.yourdomain.com
AUTH_ALLOWED_RETURN_ORIGINS=https://cube.yourdomain.com,https://cdex.yourdomain.com,https://bils.yourdomain.com
CUBE_PUBLIC_URL=https://cube.yourdomain.com
CDEX_APP_URL=https://cdex.yourdomain.com
BILS_APP_URL=https://bils.yourdomain.com
```

Set the remaining required Entra, database, service-token, and monitoring values from `.env.example` using production secrets. Do not copy its local fallback credentials to production. Configure DNS and TLS at the load balancer or reverse proxy in front of the gateway. The Entra redirect URI must use the public Cube host.

Use Docker Compose v2.24.4 or later for the production overlay's `!reset` merge tags.

Deploy or roll forward the selected version with:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --detach --remove-orphans
```

The production overlay removes local image build definitions and selects the tagged registry images. A server restart/deployment job is intentionally not wired into CI because this repository has no configured production host or deployment credentials; the tagged images and Compose commands provide the release handoff without embedding environment-specific secrets.
