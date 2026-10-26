export type EmploymentStatus =
  "active" | "on_leave" | "disabled" | "offboarded";
export type EmploymentType =
  "full_time" | "part_time" | "contractor" | "temporary" | "intern";
export type BloodType =
  | "a_positive"
  | "a_negative"
  | "b_positive"
  | "b_negative"
  | "ab_positive"
  | "ab_negative"
  | "o_positive"
  | "o_negative";
export type MaritalStatus =
  | "single"
  | "married"
  | "separated"
  | "divorced"
  | "widowed"
  | "domestic_partner"
  | "other";

export interface EmployeeEducationHistoryEntry {
  id: string;
  educationLevel: string | null;
  institution: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  graduationYear: number | null;
}

export interface EmployeeActivityEntry {
  id: string;
  occurredAt: string;
  actorName: string | null;
  action: "created" | "updated";
  changedFields: string[];
}

export type EmployeePayFrequency =
  "weekly" | "biweekly" | "semimonthly" | "monthly";
export type AttendanceRecordStatus =
  | "present"
  | "late"
  | "absent"
  | "on_leave"
  | "sick_leave"
  | "half_day_sick_leave"
  | "vacation_leave"
  | "half_day_vacation_leave"
  | "official_business"
  | "nuptial"
  | "bereavement";

export interface AttendanceRecordInput {
  status: AttendanceRecordStatus;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  notes: string | null;
}

export interface EmployeeAttendanceRecord extends Omit<
  AttendanceRecordInput,
  "status"
> {
  id: string | null;
  employeeId: string;
  displayName: string;
  employeeNumber: string | null;
  workEmail: string;
  department: string | null;
  jobTitle: string | null;
  status: AttendanceRecordStatus | null;
  hoursWorked: number | null;
}

export interface AttendanceDailyReport {
  date: string;
  summary: {
    employeeCount: number;
    recordedCount: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    onLeaveCount: number;
  };
  items: EmployeeAttendanceRecord[];
}

export interface EmployeeHrDetails {
  attendanceAndLeave: {
    workSchedule: string | null;
    weeklyHours: number | null;
    annualLeaveEntitlementDays: number | null;
    annualLeaveUsedDays: number | null;
  };
  payroll: {
    baseSalary: string | null;
    currency: string | null;
    payFrequency: EmployeePayFrequency | null;
    payGrade: string | null;
    taxId: string | null;
    sssNumber: string | null;
    philhealthNumber: string | null;
    pagibigNumber: string | null;
  };
  medical: {
    allergies: string | null;
    medicalConditions: string | null;
    currentMedications: string | null;
    healthInsuranceProvider: string | null;
    healthInsurancePolicyNumber: string | null;
  };
}

export type EmployeeLeaveType =
  "annual" | "sick" | "emergency" | "parental" | "unpaid" | "other";
export type EmployeeLeaveRequestStatus = "pending" | "approved" | "rejected";

export interface EmployeeLeaveRequestInput {
  employeeId: string;
  leaveType: EmployeeLeaveType;
  startDate: string;
  endDate: string;
  requestedDays: number;
  reason: string;
}

export interface EmployeeLeaveRequest extends EmployeeLeaveRequestInput {
  id: string;
  employeeName: string;
  employeeNumber: string | null;
  department: string | null;
  status: EmployeeLeaveRequestStatus;
  decisionNote: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decidedByName: string | null;
}

export interface EmployeeLeaveManagementReport {
  summary: {
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    onLeaveTodayCount: number;
  };
  items: EmployeeLeaveRequest[];
}

export type EmployeeEducationHistoryInput = Omit<
  EmployeeEducationHistoryEntry,
  "id"
>;
export type EmployeeSortKey =
  | "employeeNumber"
  | "displayName"
  | "workEmail"
  | "department"
  | "jobTitle"
  | "employmentType"
  | "employmentStatus"
  | "hireDate";

export interface EmployeeDirectoryItem {
  id: string;
  employeeNumber: string | null;
  displayName: string;
  workEmail: string;
  department: string | null;
  jobTitle: string | null;
  managerEmployeeId: string | null;
  employmentType: EmploymentType;
  hireDate: string | null;
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

export interface OrganizationStructureResponse {
  organizations: OrganizationRecord[];
  permissions: {
    canManageOrganization: boolean;
  };
}

export interface EmployeeMasterRecord extends EmployeeDirectoryItem {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  preferredName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  bloodType: BloodType | null;
  maritalStatus: MaritalStatus | null;
  permanentAddress: string | null;
  currentAddress: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  emergencyContactEmail: string | null;
  educationLevel: string | null;
  educationInstitution: string | null;
  educationField: string | null;
  graduationYear: number | null;
  educationHistory: EmployeeEducationHistoryEntry[];
  managerName: string | null;
  managerWorkEmail: string | null;
  employmentType: EmploymentType;
  isProbationary: boolean | null;
  regularizationDate: string | null;
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
  gender: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  bloodType: BloodType | null;
  maritalStatus: MaritalStatus | null;
  permanentAddress: string | null;
  currentAddress: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  emergencyContactEmail: string | null;
  educationLevel: string | null;
  educationInstitution: string | null;
  educationField: string | null;
  graduationYear: number | null;
  educationHistory?: EmployeeEducationHistoryInput[];
  workEmail: string;
  department: string | null;
  managerWorkEmail: string | null;
  jobTitle: string | null;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  isProbationary: boolean | null;
  regularizationDate: string | null;
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

export async function getOrganizationStructure(
  signal?: AbortSignal,
): Promise<OrganizationStructureResponse> {
  return requestJson<OrganizationStructureResponse>(
    "/api/eris/organizations",
    signal,
  );
}

export async function createOrganization(input: {
  name: string;
  code: string | null;
}): Promise<OrganizationRecord> {
  return requestJson<OrganizationRecord>("/api/eris/organizations", undefined, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createDepartment(
  organizationId: string,
  input: { name: string; code: string | null; headEmployeeId: string | null },
): Promise<OrganizationDepartment> {
  return requestJson<OrganizationDepartment>(
    `/api/eris/organizations/${encodeURIComponent(organizationId)}/departments`,
    undefined,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function createBranch(
  organizationId: string,
  input: {
    name: string;
    code: string | null;
    address: string | null;
    managerEmployeeId: string | null;
  },
): Promise<OrganizationBranch> {
  return requestJson<OrganizationBranch>(
    `/api/eris/organizations/${encodeURIComponent(organizationId)}/branches`,
    undefined,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function createPosition(
  organizationId: string,
  departmentId: string,
  input: {
    name: string;
    code: string | null;
    description: string | null;
    jobLevel: string | null;
  },
): Promise<OrganizationPosition> {
  return requestJson<OrganizationPosition>(
    `/api/eris/organizations/${encodeURIComponent(organizationId)}/departments/${encodeURIComponent(departmentId)}/positions`,
    undefined,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function getAttendanceReport(
  date: string,
  query: string,
  signal?: AbortSignal,
): Promise<AttendanceDailyReport> {
  const search = new URLSearchParams({ date, q: query });
  return requestJson<AttendanceDailyReport>(
    `/api/eris/attendance?${search.toString()}`,
    signal,
  );
}

export async function updateAttendanceRecord(
  employeeId: string,
  date: string,
  input: AttendanceRecordInput,
): Promise<EmployeeAttendanceRecord> {
  return requestJson<EmployeeAttendanceRecord>(
    `/api/eris/attendance/${encodeURIComponent(employeeId)}/${encodeURIComponent(date)}`,
    undefined,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function getLeaveManagementReport(
  signal?: AbortSignal,
): Promise<EmployeeLeaveManagementReport> {
  return requestJson<EmployeeLeaveManagementReport>(
    "/api/eris/leave-requests",
    signal,
  );
}

export async function createLeaveRequest(
  input: EmployeeLeaveRequestInput,
): Promise<EmployeeLeaveRequest> {
  return requestJson<EmployeeLeaveRequest>(
    "/api/eris/leave-requests",
    undefined,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function decideLeaveRequest(
  requestId: string,
  input: { status: "approved" | "rejected"; decisionNote: string | null },
): Promise<EmployeeLeaveRequest> {
  return requestJson<EmployeeLeaveRequest>(
    `/api/eris/leave-requests/${encodeURIComponent(requestId)}/decision`,
    undefined,
    { method: "PUT", body: JSON.stringify(input) },
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

export async function getEmployeeActivity(
  employeeId: string,
  signal?: AbortSignal,
): Promise<EmployeeActivityEntry[]> {
  return requestJson<EmployeeActivityEntry[]>(
    `/api/eris/employees/${encodeURIComponent(employeeId)}/activity`,
    signal,
  );
}

export async function getEmployeeHrDetails(
  employeeId: string,
  signal?: AbortSignal,
): Promise<EmployeeHrDetails> {
  return requestJson<EmployeeHrDetails>(
    `/api/eris/employees/${encodeURIComponent(employeeId)}/hr-details`,
    signal,
  );
}

export async function updateEmployeeHrDetails(
  employeeId: string,
  details: EmployeeHrDetails,
): Promise<EmployeeHrDetails> {
  return requestJson<EmployeeHrDetails>(
    `/api/eris/employees/${encodeURIComponent(employeeId)}/hr-details`,
    undefined,
    {
      method: "PUT",
      body: JSON.stringify(details),
    },
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

export async function updateEmployee(
  employeeId: string,
  input: EmployeeMasterInput,
): Promise<EmployeeMasterRecord> {
  return requestJson<EmployeeMasterRecord>(
    `/api/eris/employees/${encodeURIComponent(employeeId)}`,
    undefined,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
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
