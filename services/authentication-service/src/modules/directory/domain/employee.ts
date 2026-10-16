export type EmploymentStatus = "active" | "disabled" | "offboarded";

export interface EntraEmployeeProfile {
  tenantId: string;
  objectId: string;
  email: string;
  displayName: string;
}

export interface ProvisionedEmployee {
  employeeId: string;
  objectId: string;
  email: string;
  displayName: string;
  active: boolean;
}

export interface EmployeeDirectoryProfile {
  email: string;
  displayName: string;
  active: boolean;
}

export function mayAuthenticate(status: EmploymentStatus): boolean {
  return status === "active";
}
