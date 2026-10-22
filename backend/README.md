# Backend service structure

Backend services use Domain-Driven Design bounded contexts with dependency inversion. Keep each service independently buildable and keep `cmd/<service>/main.go` limited to startup wiring. The context map and modeling rules are in [domain-driven-design.md](../docs/domain-driven-design.md).

```text
<service>/
  cmd/<service>/main.go                 # load settings, construct dependencies, start server
  internal/<bounded-context>/
    domain/                             # aggregates, value objects, invariants, domain errors
    application/                       # use cases and outbound ports
    infrastructure/                    # persistence and external-service adapters
  internal/config/                      # validated environment and runtime settings
  internal/transport/http/              # inbound adapter and protocol mapping
```

Use context-specific packages instead of a generic shared `domain` package. A service with one bounded context may keep its `domain`, `application`, and `infrastructure` packages directly under `internal/`. CDEX groups customer, account, and sales activity concepts under its customer relationship context; BILS owns invoicing. Their domain packages currently contain identity value objects only because their actual invariants and lifecycle policies are not yet defined. Add use cases and adapters as those rules are agreed.

## Dependency direction

- `cmd/` may wire all service-owned packages together.
- `transport/` calls application interfaces and maps application/domain results to HTTP.
- `application/` owns use cases and declares the interfaces it needs from infrastructure.
- `domain/` stays independent of HTTP, databases, Microsoft libraries, and other services.
- `infrastructure/` implements application interfaces and contains network or persistence details.
- Shared code is limited to stable platform concerns such as HTTP server lifecycle and JSON response helpers. Do not move service business rules into `shared/`.

## Go conventions

- Use small, focused packages and files with names based on the capability they contain.
- Keep exported identifiers documented and prefer explicit constructors for dependencies.
- Pass `context.Context` to request-scoped I/O; set bounded timeouts on outbound clients.
- Return wrapped errors from infrastructure and translate them to stable public errors in transport.
- Validate untrusted HTTP input at the transport boundary, then enforce business invariants in domain/application code.
- Keep secrets in runtime environment configuration; never bake them into source or images.
- Run `gofmt` on changed Go files. The Go module is rooted at `services/go.mod`.

The identity service is the exception in runtime and language: it uses Express and strict TypeScript for the Entra/MSAL integration. Its `src/modules/<bounded-context>/{domain,application,http}`, `src/infrastructure`, `src/config`, and `src/platform` directories follow equivalent boundaries. The root `src/app.ts` is the composition root. No other microservice should acquire TypeScript or MSAL dependencies unless requested.
