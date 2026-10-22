export type EmploymentStatus = "active" | "on_leave" | "disabled" | "offboarded";
export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contractor"
  | "temporary"
  | "intern";
export type EmployeeSortKey =
  | "employeeNumber"
  | "displayName"
  | "workEmail"
  | "department"
  | "jobTitle"
  | "employmentStatus";

export interface EmployeeDirectoryItem {
  id: string;
  employeeNumber: string | null;
  displayName: string;
  workEmail: string;
  department: string | null;
  jobTitle: string | null;
  employmentStatus: EmploymentStatus;
}

export interface EmployeeDirectoryResponse {
  items: EmployeeDirectoryItem[];
  page: number;
  pageSize: number;
  total: number;
  summary: {
    totalEmployees: number;
    onLeaveEmployees: number;
    newHires: number;
    averageTenureYears: number | null;
  };
  permissions: {
    canManageEmployees: boolean;
    canCreateEmployees: boolean;
  };
}

export interface EmployeeMasterRecord extends EmployeeDirectoryItem {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  preferredName: string | null;
  managerName: string | null;
  managerWorkEmail: string | null;
  employmentType: EmploymentType;
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

export class EmployeeDirectoryRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
    this.name = "EmployeeDirectoryRequestError";
  }
}

export async function listEmployees(
  options: {
    query: string;
    page: number;
    pageSize: number;
    sortBy: EmployeeSortKey;
    sortOrder: "asc" | "desc";
  },
  signal?: AbortSignal,
): Promise<EmployeeDirectoryResponse> {
  const search = new URLSearchParams({
    q: options.query,
    page: String(options.page),
    pageSize: String(options.pageSize),
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
  });
  return requestJson<EmployeeDirectoryResponse>(
    `/api/eris/employees?${search.toString()}`,
    signal,
  );
}

export async function getEmployee(
  employeeId: string,
  signal?: AbortSignal,
): Promise<EmployeeMasterRecord> {
  return requestJson<EmployeeMasterRecord>(
    `/api/eris/employees/${encodeURIComponent(employeeId)}`,
    signal,
  );
}

export async function createEmployee(
  input: EmployeeMasterInput,
): Promise<EmployeeMasterRecord> {
  return requestJson<EmployeeMasterRecord>("/api/eris/employees", undefined, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function requestJson<T>(
  url: string,
  signal?: AbortSignal,
  options: Pick<RequestInit, "method" | "body"> = {},
): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    signal,
    ...options,
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const code =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "request_failed";
    throw new EmployeeDirectoryRequestError(response.status, code);
  }

  return payload as T;
}
