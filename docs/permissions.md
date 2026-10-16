# OpenFGA permissions

## Relationship model

The Go authorization service bootstraps one persistent OpenFGA store and a versioned model on first start. OpenFGA stores tuples in the shared PostgreSQL database. The model in `services/authorization-service/internal/infrastructure/openfga/model.json` contains:

- `group:<key>#member` for verified employee identities assigned to a CGSI group.
- `organization:cgsi#member` for compatibility with existing employee tuples and organization-scoped relations.
- `app:<id>#viewer` and `app:<id>#owner` for app-level access.
- `crm_record:<id>` with inherited app access and direct viewer/editor relations.
- `billing_invoice:<id>` with inherited app access and direct viewer/editor relations.
- Computed `can_access`, `can_view`, and `can_edit` permissions for API checks.

On successful Entra sign-in, the local directory transaction assigns a first-time employee to the `all-employees` group and queues `user:<oid> member group:all-employees`. A baseline group relation feeds the existing organization member set; Cube's seeded tuple grants that set access to Cube. App catalog requests check `user:<oid> can_access app:<id>` before returning the effective access flag. CDEX and BILS have no default access tuple.

CRM and Billing services must check OpenFGA on each protected resource operation. The model defines record and invoice permissions, but those domain APIs are still scaffolds and do not yet perform record-level checks.

## Assigning app access

The database seeds the `all-employees` group, a `cube.employee` role, a permission catalog, and starter roles for CDEX, BILS, HUMA, and RDES. Administrative APIs that safely grant and revoke those roles, add group members, emit audit events, and synchronize role changes to OpenFGA are still pending. The legacy localhost-only raw relationship endpoint remains for development and bypasses the normalized IAM tables; keep it bound to loopback and do not use it as the production grant workflow.

For local development, the authorization admin endpoint listens on loopback at port 8083 and is not proxied by Nginx. Use a separate `AUTHORIZATION_ADMIN_TOKEN` from `.env` to write a direct app assignment:

```json
{
  "user": "user:<entra-object-id>",
  "relation": "viewer",
  "object": "app:crm"
}
```

Send this JSON to `POST http://localhost:8083/v1/relationships` with the `X-CGSI-Service-Token` header. This compatibility route is not audited through the local IAM tables; migrate access administration to the group/role workflow before production.

Never expose port 8083 beyond loopback. In deployment, provide a separate administrative provisioning path and keep authorization-service private to the service network.

OpenFGA's official [project documentation](https://openfga.dev/docs) covers stores, authorization models, relationship tuples, and the Check API.
