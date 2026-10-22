export type EmploymentStatus = "active" | "on_leave" | "disabled" | "offboarded";
export type DirectoryAccountStatus = "active" | "disabled" | "offboarded";
export type EmploymentType = "full_time" | "part_time" | "contractor" | "temporary" | "intern";

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
  sortBy: "employeeNumber" | "displayName" | "workEmail" | "department" | "jobTitle" | "employmentStatus" | "hireDate";
  sortOrder: "asc" | "desc";
}

export interface EmployeeDirectoryItem {
  id: string;
  displayName: string;
  employeeNumber: string | null;
  workEmail: string;
  department: string | null;
  jobTitle: string | null;
  hireDate: string | null;
  employmentStatus: EmploymentStatus;
}

export interface EmployeeDirectorySummary {
  totalEmployees: number;
  onLeaveEmployees: number;
  newHires: number;
  averageTenureYears: number | null;
}

export interface EmployeeDirectoryPage {
  items: EmployeeDirectoryItem[];
  page: number;
  pageSize: number;
  total: number;
  summary: EmployeeDirectorySummary;
  permissions: {
    canManageEmployees: boolean;
    canCreateEmployees: boolean;
  };
}

export interface EmployeeMasterRecord {
  id: string;
  employeeNumber: string | null;
  displayName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  preferredName: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  educationLevel: string | null;
  educationInstitution: string | null;
  educationField: string | null;
  graduationYear: number | null;
  workEmail: string;
  department: string | null;
  managerName: string | null;
  managerWorkEmail: string | null;
  jobTitle: string | null;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  hireDate: string | null;
  terminationDate: string | null;
  workPhone: string | null;
  workLocation: string | null;
  updatedAt: string;
}

export interface EmployeeMasterInput {
  employeeNumber: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  preferredName: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  educationLevel: string | null;
  educationInstitution: string | null;
  educationField: string | null;
  graduationYear: number | null;
  workEmail: string;
  department: string | null;
  managerWorkEmail: string | null;
  jobTitle: string | null;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  hireDate: string | null;
  terminationDate: string | null;
  workPhone: string | null;
  workLocation: string | null;
}

export class EmployeeRecordError extends Error {
  constructor(readonly code: "forbidden" | "not_found" | "duplicate_employee_number" | "duplicate_work_email" | "invalid_manager") {
    super(code);
    this.name = "EmployeeRecordError";
  }
}

export function mayAuthenticate(status: DirectoryAccountStatus): boolean {
  return status === "active";
}
