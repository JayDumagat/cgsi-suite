import type {
  AuthTransaction,
  ProvisionedEmployeeIdentity,
  VerifiedEmployeeIdentity,
} from "./contracts.js";

export interface AuthenticationProvider {
  readonly isConfigured: boolean;
  generatePkceCodes(): Promise<{ challenge: string; verifier: string }>;
  authorizationUrl(transaction: AuthTransaction, codeChallenge: string): Promise<string>;
  redeemAuthorizationCode(code: string, codeVerifier: string, nonce: string): Promise<Record<string, unknown>>;
  logoutUrl(): string | null;
}

export interface DirectoryProvisioner {
  provision(profile: VerifiedEmployeeIdentity): Promise<ProvisionedEmployeeIdentity>;
}

export interface BaselineAccessProvisioner {
  ensureBaselineAccess(employeeId: string): Promise<void>;
}
