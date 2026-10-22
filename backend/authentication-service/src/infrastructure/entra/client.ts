import { ConfidentialClientApplication, CryptoProvider } from "@azure/msal-node";
import { config } from "../../config/environment.js";
import type { AuthTransaction } from "../../modules/authentication/application/contracts.js";

const scopes = ["openid", "profile", "email"];

export class EntraClient {
  readonly #application: ConfidentialClientApplication | null;
  readonly #cryptoProvider = new CryptoProvider();
  readonly #authority: string;

  constructor() {
    this.#authority = config.tenantId ? `https://login.microsoftonline.com/${config.tenantId}` : "";
    this.#application = config.tenantId && config.clientId && config.clientSecret
      ? new ConfidentialClientApplication({
          auth: {
            clientId: config.clientId,
            authority: this.#authority,
            clientSecret: config.clientSecret,
          },
        })
      : null;
  }

  get isConfigured(): boolean {
    return this.#application !== null;
  }

  async generatePkceCodes(): Promise<{ challenge: string; verifier: string }> {
    return this.#cryptoProvider.generatePkceCodes();
  }

  async authorizationUrl(transaction: AuthTransaction, codeChallenge: string): Promise<string> {
    if (!this.#application) {
      throw new Error("Microsoft Entra sign-in is not configured");
    }
    return this.#application.getAuthCodeUrl({
      scopes,
      redirectUri: config.redirectUri,
      responseMode: "query",
      state: transaction.state,
      nonce: transaction.nonce,
      codeChallenge,
      codeChallengeMethod: "S256",
    });
  }

  async redeemAuthorizationCode(code: string, codeVerifier: string, nonce: string): Promise<Record<string, unknown>> {
    if (!this.#application) {
      throw new Error("Microsoft Entra sign-in is not configured");
    }
    const result = await this.#application.acquireTokenByCode({
      code,
      scopes,
      redirectUri: config.redirectUri,
      codeVerifier,
      nonce,
    });
    return (result.idTokenClaims ?? {}) as Record<string, unknown>;
  }

  logoutUrl(): string | null {
    if (!this.#authority) {
      return null;
    }
    const logoutUrl = new URL(`${this.#authority}/oauth2/v2.0/logout`);
    logoutUrl.searchParams.set("post_logout_redirect_uri", config.postLogoutRedirectUri);
    return logoutUrl.toString();
  }
}
