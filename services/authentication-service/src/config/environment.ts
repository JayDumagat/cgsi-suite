export interface AuthenticationConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  authorizationUrl: string;
  provisioningToken: string;
  sessionSecret: string;
  cookieSecure: boolean;
  cookieDomain: string;
  allowedReturnOrigins: string[];
  sessionMaxAgeSeconds: number;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AuthenticationConfig {
  const config: AuthenticationConfig = {
    tenantId: environment.ENTRA_TENANT_ID?.trim() ?? "",
    clientId: environment.ENTRA_CLIENT_ID?.trim() ?? "",
    clientSecret: environment.ENTRA_CLIENT_SECRET ?? "",
    redirectUri: environment.ENTRA_REDIRECT_URL?.trim() ?? "",
    postLogoutRedirectUri: environment.ENTRA_POST_LOGOUT_REDIRECT_URL?.trim() || "http://localhost:8080/",
    authorizationUrl: environment.AUTHORIZATION_SERVICE_URL?.trim() || "http://authorization-service:8083",
    provisioningToken: environment.IDENTITY_PROVISIONING_TOKEN ?? "",
    sessionSecret: environment.SESSION_SECRET ?? "",
    cookieSecure: environment.COOKIE_SECURE === "true",
    cookieDomain: environment.COOKIE_DOMAIN?.trim() ?? "",
    allowedReturnOrigins: (environment.AUTH_ALLOWED_RETURN_ORIGINS ?? "http://localhost:8080")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    sessionMaxAgeSeconds: 8 * 60 * 60,
  };

  if (config.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  if (!config.redirectUri && config.tenantId && config.clientId && config.clientSecret) {
    throw new Error("ENTRA_REDIRECT_URL is required when Entra is configured");
  }
  if (config.redirectUri) {
    validateRedirectUrl(config.redirectUri, "ENTRA_REDIRECT_URL");
  }
  validateRedirectUrl(config.postLogoutRedirectUri, "ENTRA_POST_LOGOUT_REDIRECT_URL");
  for (const origin of config.allowedReturnOrigins) {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.origin !== origin || parsedOrigin.pathname !== "/" || parsedOrigin.search || parsedOrigin.hash) {
      throw new Error("AUTH_ALLOWED_RETURN_ORIGINS must contain comma-separated origins only");
    }
  }

  return config;
}

export const config = loadConfig();

function validateRedirectUrl(value: string, setting: string): void {
  const redirectUrl = new URL(value);
  if (redirectUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(redirectUrl.hostname)) {
    throw new Error(`${setting} must use HTTPS outside localhost`);
  }
}
