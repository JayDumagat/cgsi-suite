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

export interface EmployeeDirectoryQuery {
  search: string;
  page: number;
  pageSize: number;
}

export interface EmployeeDirectoryItem {
  id: string;
  displayName: string;
  workEmail: string;
  department: string | null;
  employmentStatus: EmploymentStatus;
}

export interface EmployeeDirectorySummary {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  departments: number;
}

export interface EmployeeDirectoryPage {
  items: EmployeeDirectoryItem[];
  page: number;
  pageSize: number;
  total: number;
  summary: EmployeeDirectorySummary;
}

export function mayAuthenticate(status: EmploymentStatus): boolean {
  return status === "active";
}
