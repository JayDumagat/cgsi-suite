# Microsoft 365 setup for CGSI Suite

This guide configures the workforce tenant, employee sign-in, Intune compliance, and Conditional Access for the current CGSI Suite implementation.

## What connects to Microsoft 365

Only `identity-service` connects to Microsoft Entra and uses MSAL Node. It is a confidential server-side web client using the authorization-code flow with PKCE. The browser receives a server-side session cookie; the other services receive only the minimum identity data they need over internal HTTP.

The current app does not call Microsoft Graph or the Intune APIs. It requests OpenID Connect sign-in scopes (`openid`, `profile`, `email`) to establish the employee identity. There is no Graph API permission or delegated Graph access token requirement for this sign-in-only flow. Device state is enforced by Entra Conditional Access using Intune's compliance signal. See Microsoft's [Node/Express MSAL sign-in and sign-out flow](https://learn.microsoft.com/en-us/entra/identity-platform/tutorial-web-app-node-sign-in-sign-out) and [authorization code flow guidance](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).

## Prerequisites and licensing

- Use the CGSI **workforce** tenant that contains employee accounts. The application is configured for one tenant.
- The tenant needs Microsoft Entra ID P1 or P2 for Conditional Access. Group-based enterprise-app assignment also requires Entra ID P1 or P2.
- Assign the appropriate Microsoft Intune licenses to the users/devices that will be managed. Enroll supported company devices into Intune before requiring compliance.
- Use an account with application registration permissions to create the app. For enterprise-app assignment, use an authorized application, cloud application, or user administrator. Conditional Access changes require a Conditional Access administrator or security administrator.

Microsoft's [app registration guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) recommends single-tenant registration for most internal applications. Microsoft's [group assignment guide](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/assign-user-or-group-access-portal) documents group-assignment licensing and notes that nested group membership does not cascade.

## 1. Register the web application

1. Open the [Microsoft Entra admin center](https://entra.microsoft.com/) and select the CGSI workforce tenant.
2. Go to **Entra ID → App registrations → New registration**.
3. Name the registration `CGSI Suite - Cube` (or another recognizable service name).
4. Under **Supported account types**, choose **Accounts in this organizational directory only**.
5. Under **Redirect URI**, choose **Web** and add the local callback:

   ```text
   http://localhost:8080/api/auth/callback
   ```

6. Register the application. On its overview page, record the **Application (client) ID** and **Directory (tenant) ID**.
7. Under **Authentication**, add the production callback for the public Cube origin, for example:

   ```text
   https://yourdomain.com/api/auth/callback
   ```

   Also add the post-logout return URI as a Web redirect URI, such as `http://localhost:8080/` locally and the Cube origin in production. Both the authentication callback and post-logout URI must exactly match their configured values, including scheme, hostname, path, and port. Do not register each frontend as a separate OAuth client: Cube, CDEX, and BILS use the same identity service.
8. Under **Certificates & secrets → Client secrets**, create a development secret and copy its value immediately. It is shown only once.
9. Keep the secret in the identity service's runtime secret configuration. Never place it in a `VITE_*` variable, a frontend file, source control, or an image build argument. Microsoft's [web app guidance](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-web-app-sign-in) recommends a certificate or federated credential instead of a long-lived client secret for production; the current service configuration uses a client secret, so changing the credential type will require an implementation change.
10. Review **API permissions**. This implementation only signs users in and does not call Microsoft Graph. Do not add Graph permissions for the current sign-in flow. If the tenant's registration has an unused default Graph `User.Read` permission, remove it unless another approved feature needs it.

The callback is a web/server callback. Do not configure it as a SPA redirect or enable implicit token grant for the frontend.
Leave the optional **Front-channel logout URL** unset for this first deployment; the app has not implemented Entra-initiated front-channel session clearing.

## 2. Restrict sign-in to CGSI employees

1. Go to **Entra ID → Enterprise applications → CGSI Suite - Cube → Properties**.
2. Set **Assignment required?** to **Yes** and save.
3. Go to **Users and groups → Add user/group**.
4. Assign the CGSI employee security group, or assign named test employees during initial setup.
5. Keep guests and other tenant users unassigned unless the organization explicitly intends to allow them.

Group assignment is a tenant-level sign-in gate. OpenFGA remains the application-level permission source for Cube, CRM, Billing, and future record-level permissions. The app currently provisions the authenticated employee into `organization:cgsi`; employee-group changes in Entra do not automatically create custom OpenFGA app roles.

## 3. Configure Intune compliance

1. Enroll representative company devices into Intune and confirm that the enrolled users have appropriate licenses.
2. In the [Intune admin center](https://intune.microsoft.com/), go to **Devices → Manage devices → Compliance → Policies → Create policy**.
3. Create a compliance policy for each platform CGSI will support, such as Windows, macOS, iOS/iPadOS, or Android. Define the organization's approved minimum security requirements (for example, supported OS version, encryption, firewall, and device integrity). The exact settings should follow CGSI's endpoint-security baseline.
4. Assign policies to the intended managed-device or employee groups. Configure noncompliance actions and user notifications so employees can understand and remediate a failing device.
5. Go to **Devices → Compliance → Compliance policy settings** and set **Mark devices with no compliance policy assigned as** to **Not compliant**. Assign a policy to every device intended to pass Conditional Access.
6. Sync a test device and confirm its status is **Compliant** before enforcing Conditional Access.

Intune policy evaluation and compliance are prerequisites for device-based Conditional Access. Microsoft's [create a compliance policy guide](https://learn.microsoft.com/en-us/intune/device-security/compliance/create-policy) and [compliance overview](https://learn.microsoft.com/en-us/intune/device-security/compliance/overview) explain policy assignment and the “no policy assigned” setting.

## 4. Require compliant devices with Conditional Access

1. In the Entra admin center, go to **Entra ID → Conditional Access → Policies → New policy**.
2. Name it `CGSI Suite - Require compliant device`.
3. Under **Users**, include the intended CGSI employee group. Exclude emergency-access/break-glass accounts and any required directory synchronization accounts.
4. Under **Target resources**, select **Resources (formerly cloud apps) → Select resources**, then choose the `CGSI Suite - Cube` enterprise application.
5. Under **Grant**, select **Grant access** and **Require device to be marked as compliant**. If CGSI requires MFA for this application, include the organization's approved MFA grant control in the same policy or enforce it through a separate policy.
6. Set **Enable policy** to **Report-only** and save. Review Entra sign-in logs with a compliant test device, a noncompliant test device, and the users/devices in scope. Confirm the evaluated policy and assignment are correct.
7. Once the expected results are confirmed and affected users have working compliant devices, change the policy to **On**.

Microsoft warns that a compliance policy and at least one compliant device must exist before the Conditional Access policy is enabled. Keep emergency-access exclusions and use report-only evaluation before enforcement. See [Require device compliance with Conditional Access](https://learn.microsoft.com/en-us/mem/intune/protect/create-conditional-access-intune), [Conditional Access grant controls](https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-grant), and [report-only mode](https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-insights-reporting).

## 5. Configure the application

Copy `.env.example` to `.env` for local Compose, then set these values:

| Variable | Value |
| --- | --- |
| `ENTRA_TENANT_ID` | Directory (tenant) ID from the app registration overview |
| `ENTRA_CLIENT_ID` | Application (client) ID from the app registration overview |
| `ENTRA_CLIENT_SECRET` | Client secret value; server-side only |
| `ENTRA_REDIRECT_URL` | Exact Web callback registered in Entra |
| `ENTRA_POST_LOGOUT_REDIRECT_URL` | Cube base URL registered/allowed for sign-out return, such as `http://localhost:8080/` locally |
| `SESSION_SECRET` | At least 32 random bytes for Express session signing |
| `COOKIE_SECURE` | `false` for local HTTP; `true` behind production HTTPS |
| `COOKIE_DOMAIN` | Leave unset locally; use a shared parent such as `.yourdomain.com` for production subdomains |
| `AUTH_ALLOWED_RETURN_ORIGINS` | Comma-separated Cube, CDEX, and BILS origins; the local default is in `.env.example` |
| `CUBE_PUBLIC_URL` | Public Cube URL used for app-host sign-in redirects; local default is `http://localhost:8080` |

Start the suite with:

```powershell
docker compose up --build
```

For production, use HTTPS callback and post-logout URLs, set `COOKIE_SECURE=true`, and inject secrets through the deployment secret manager. The gateway treats production app hosts as HTTPS and local `localhost` as HTTP for forwarded scheme handling. Keep the identity service private behind Nginx. Do not publish MSAL tokens or the session cookie to frontend JavaScript.

The current session is server-side in PostgreSQL, has an eight-hour maximum, and cannot outlive the Entra ID token used at sign-in. The service does not store refresh tokens; users sign in again after expiry.

## 6. Verify sign-in and device access

- A directly assigned CGSI employee can sign in and returns to Cube.
- An unassigned tenant account is rejected by Entra before an application session is issued.
- The sign-in logs show the CGSI enterprise application and expected Conditional Access result.
- A compliant managed device passes the policy after it has checked in with Intune.
- A device without an assigned compliance policy or with a failed policy does not pass once the Conditional Access policy is On.
- CRM and Billing access still requires an OpenFGA app relationship; successful Entra sign-in alone does not grant those modules.
- Production session cookies are HttpOnly, Secure, and SameSite=Lax.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `AADSTS50011` redirect URI mismatch | The registered Web redirect must exactly equal `ENTRA_REDIRECT_URL`; check scheme, port, host, and callback path. |
| `AADSTS50105` or user not assigned | Verify **Assignment required?** is enabled and the user is directly assigned or is a direct member of an assigned group. Nested groups do not cascade for enterprise-app assignment. |
| Entra sign-in says device is not compliant | Confirm Intune enrollment, policy assignment, platform support, last device sync, and the **no compliance policy = Not compliant** setting. Check the Conditional Access tab in sign-in logs. |
| Conditional Access blocks a test employee | Review users/groups and target resource, confirm at least one compliant device, use report-only while diagnosing, and preserve break-glass exclusions. |
| Sign-in starts but the callback fails | Confirm the identity-service logs, tenant/client values, secret expiry, callback URL, and that the callback returns through the same public origin that started login. |
| Local session database reports password authentication failed for `cgsi_admin` | `POSTGRES_PASSWORD` only initializes a new Postgres volume. An existing `cgsi_postgres_data` volume keeps the old database role password. Either restore the matching `.env` value or update the role without deleting data: run `docker compose exec -it postgres psql -U cgsi_admin -d cgsi`, enter `\password cgsi_admin` at the `psql` prompt, set the password to the value in `.env`, then run `docker compose up -d --force-recreate openfga-migrate openfga identity-service`. The OpenFGA URI expects a URL-safe database password. |

If a Conditional Access report-only policy includes device compliance on macOS, iOS, or Android, Microsoft notes that evaluation can prompt for a device certificate even though report-only mode does not enforce the policy. Review the platform-specific guidance before broad rollout.

## Future Microsoft Graph or Intune integrations

If a later feature needs Microsoft Graph (for example, group synchronization, user provisioning, or device inventory), add a separate, explicitly scoped downstream API integration with the minimum delegated/application permissions, admin consent where required, token caching, and its own threat review. Do not reuse the sign-in-only OIDC scopes as Graph authorization. The current backend has no Graph API client and no Intune API permission.
