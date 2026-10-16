# Domain-Driven Design across CGSI services

## Bounded contexts

Each backend service owns its model and persistence. Services exchange versioned HTTP contracts or events; they do not import another service's domain package.

| Service | Bounded context | Domain ownership |
| --- | --- | --- |
| Identity | Authentication | Entra sign-in protocol, verified external identity, and session-facing authentication decisions. |
| Identity | Directory | Minimal local employee projection and employee access lifecycle. Microsoft Graph remains an adapter, not the employee model. |
| Authorization | Access control | Valid authorization relationships, group membership concepts, and policy evaluation through OpenFGA. |
| App catalog | Application catalog | App definitions, availability, and whether an app can be opened. Identity and authorization checks are application ports. |
| CRM / CDEX | Customer relationship management | Customer, account, and sales activity identifiers and eventual aggregates. Detailed profile fields and lifecycle rules are not invented before product rules are agreed. |
| Billing / BILS | Invoicing | Invoice identity and eventual invoice lifecycle aggregate. Tax, numbering, approval, and posting rules need explicit finance decisions before they become invariants. |

HUMA and RDES are not backend services yet. Their future domains should be introduced inside their owning services rather than added to a shared directory model.

## Dependency and modeling rules

```text
HTTP / message adapter -> application use case -> domain model
                                  ^
                                  | ports
                         infrastructure adapter
```

- Domain packages contain business language, value objects, aggregates, invariants, and domain errors. They do not depend on HTTP, PostgreSQL, OpenFGA SDKs, Entra/MSAL, or shared platform code.
- Application packages coordinate use cases and declare the ports they need. Infrastructure implements those ports. Composition roots wire adapters together.
- Transport owns request/response DTOs and maps stable domain/application errors to protocol responses. Database rows and vendor DTOs stay in infrastructure.
- A bounded context owns its own tables and migrations. Shared platform code is for technical capabilities such as telemetry and HTTP server lifecycle, not shared business entities.
- Cross-service calls use explicit contracts. Persisted cross-context work uses outbox events with stable event names and versions; do not share ORM models or SQL tables as service APIs.
- Add an aggregate boundary only when it protects a real consistency invariant. Model an unknown policy as an open question rather than guessing a rule and baking it into code.

## Current implementation

- Identity is split into authentication and directory modules. Authentication depends on its own directory-provisioning and baseline-access ports; the service composition root maps those contracts to directory and outbox adapters. PostgreSQL directory and session stores remain infrastructure adapters.
- Authorization owns tuple and employee-group membership value objects. OpenFGA calls remain behind the application port and infrastructure adapter.
- App catalog now owns an immutable catalog collection and app availability/access behavior in its domain layer; identity and authorization are outbound ports.
- CDEX and BILS now have named customer relationship and invoicing domain packages with distinct identifiers. Their current HTTP endpoints remain scaffolds; no speculative CRM data schema or invoice lifecycle policy has been added.

## Next modeling workshops

Before implementing CDEX and BILS commands, agree the aggregate invariants, data ownership, and event contracts with the business owners. Start with customer/account relationships and sales activity for CDEX; start with invoice draft, approval, issue, posting, correction, and cancellation behavior for BILS. Keep tax/accounting rules and retention requirements explicit and reviewed before migrations are finalized.
