export interface OrganizationDepartment {
  id: string;
  name: string;
  code: string | null;
  headEmployeeId: string | null;
  positions: OrganizationPosition[];
}

export interface OrganizationPosition {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  jobLevel: string | null;
}

export interface OrganizationBranch {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  managerEmployeeId: string | null;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  code: string | null;
  departments: OrganizationDepartment[];
  branches: OrganizationBranch[];
}

export interface OrganizationStructure {
  organizations: OrganizationRecord[];
}

export interface OrganizationInput {
  name: string;
  code: string | null;
}

export interface DepartmentInput {
  name: string;
  code: string | null;
  headEmployeeId: string | null;
}

export interface BranchInput {
  name: string;
  code: string | null;
  address: string | null;
  managerEmployeeId: string | null;
}

export interface PositionInput {
  name: string;
  code: string | null;
  description: string | null;
  jobLevel: string | null;
}

export class OrganizationManagementError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "department_not_found"
      | "duplicate_name"
      | "invalid_assignee",
  ) {
    super(code);
    this.name = "OrganizationManagementError";
  }
}
