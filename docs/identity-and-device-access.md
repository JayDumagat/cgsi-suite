# Identity and managed-device access

Only `identity-service` connects to Microsoft Entra, using MSAL Node's confidential-client authorization-code flow with PKCE. After verifying tenant, client, subject, nonce, and token lifetime, it upserts a minimal employee row and immutable Entra identity mapping in PostgreSQL, adds a first-time employee to the baseline group, records the sign-in event, and commits an OpenFGA group-membership event to the outbox in that same transaction. The outbox dispatcher provisions OpenFGA and retries failures. New session records store the employee ID and Entra object ID rather than copying name and email; the session endpoint reads the current profile from the local directory. The catalog, CRM, Billing, and authorization services do not connect to Entra or MSAL.

Intune evaluates managed-device compliance and reports the result to Entra. Conditional Access applies that result when an employee signs into CGSI Cube. The application does not call Microsoft Graph or Intune and does not make its own device-compliance decision.

Use the step-by-step [Microsoft 365 setup guide](m365-setup.md) to configure the workforce tenant, app registration, employee assignment, Intune compliance, Conditional Access, production secrets, and sign-in troubleshooting.

The current session lasts no longer than the ID token's remaining lifetime and is capped at eight hours. Sessions are stored in PostgreSQL so identity-service replicas can share them. A disabled/offboarded local employee is denied at the session endpoint. Token refresh, Graph synchronization, self-service directory administration, and grant/revoke workflows are not implemented yet.
