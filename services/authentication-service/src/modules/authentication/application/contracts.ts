export interface AuthTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  createdAt: number;
}

export interface AuthenticatedUser {
  employeeId: string;
  oid: string;
  expiresAt: number;
  email?: string;
  name?: string;
}

export interface VerifiedEmployeeIdentity {
  tenantId: string;
  objectId: string;
  email: string;
  displayName: string;
}

export interface ProvisionedEmployeeIdentity {
  employeeId: string;
  active: boolean;
}

export interface EmployeeSessionProfile {
  email: string;
  displayName: string;
  active: boolean;
}
