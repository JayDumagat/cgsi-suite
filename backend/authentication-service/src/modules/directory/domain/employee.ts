export type EmploymentStatus = "active" | "on_leave" | "disabled" | "offboarded";
export type DirectoryAccountStatus = "active" | "disabled" | "offboarded";
export type EmploymentType = "full_time" | "part_time" | "contractor" | "temporary" | "intern";
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

export type EmployeeEducationHistoryInput = Omit<EmployeeEducationHistoryEntry, "id">;

export interface EmployeeActivityEntry {
  id: string;
  occurredAt: string;
  actorName: string | null;
  action: "created" | "updated";
  changedFields: string[];
}

export interface EmployeeAttendanceLeaveDetails {
  workSchedule: string | null;
  weeklyHours: number | null;
  annualLeaveEntitlementDays: number | null;
  annualLeaveUsedDays: number | null;
}

export type PayrollFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";

export interface EmployeePayrollDetails {
  baseSalary: string | null;
  currency: string | null;
  payFrequency: PayrollFrequency | null;
  payGrade: string | null;
  taxId: string | null;
  sssNumber: string | null;
  philhealthNumber: string | null;
  pagibigNumber: string | null;
}

export interface EmployeeMedicalDetails {
  allergies: string | null;
  medicalConditions: string | null;
  currentMedications: string | null;
  healthInsuranceProvider: string | null;
  healthInsurancePolicyNumber: string | null;
}

export interface EmployeeHrDetails {
  attendanceAndLeave: EmployeeAttendanceLeaveDetails;
  payroll: EmployeePayrollDetails;
  medical: EmployeeMedicalDetails;
  family: EmployeeFamilyDetails;
}

export interface PayrollRunComponent {
  name: string;
  amount: number;
  hours?: number | null;
}

export interface PayrollRunInput {
  periodStart: string;
  periodEnd: string;
  payDate: string;
}

export interface PayrollRunItemInput {
  basePay: number;
  earnings: PayrollRunComponent[];
  deductions: PayrollRunComponent[];
  contributions: PayrollRunComponent[];
  notes: string | null;
}

export interface PayrollRunItem extends PayrollRunItemInput {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  department: string | null;
  payFrequency: PayrollFrequency | null;
  overtimeHours: number;
  earningTotal: number;
  deductionTotal: number;
  contributionTotal: number;
  grossPay: number;
  netPay: number;
}

export interface PayrollRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  currency: string;
  status: "draft" | "processed";
  employeeCount: number;
  excludedEmployeeCount: number;
  grossTotal: number;
  deductionTotal: number;
  contributionTotal: number;
  netTotal: number;
  createdAt: string;
  processedAt: string | null;
  items: PayrollRunItem[];
}

export interface PayrollRunsReport {
  runs: PayrollRun[];
}

export interface EmployeeFamilyPerson {
  firstName: string | null;
  middleInitial: string | null;
  lastName: string | null;
  birthDate: string | null;
  nationality: string | null;
}

export interface EmployeeFamilyChild extends EmployeeFamilyPerson {
  gender: "female" | "male" | null;
}

export interface EmployeeFamilyDetails {
  spouse: EmployeeFamilyPerson;
  mother: EmployeeFamilyPerson;
  father: EmployeeFamilyPerson;
  children: EmployeeFamilyChild[];
}

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

export interface EmployeeAttendanceRecord extends Omit<AttendanceRecordInput, "status"> {
  id: string | null;
  employeeId: string;
  displayName: string;
  employeeNumber: string | null;
  workEmail: string;
  department: string | null;
  jobTitle: string | null;
  workSchedule: string | null;
  status: AttendanceRecordStatus | null;
  hoursWorked: number | null;
  overtimeHours: number | null;
  regularHours: number | null;
  timesheetEntryId: string | null;
}

export interface AttendanceDailySummary {
  employeeCount: number;
  recordedCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  onLeaveCount: number;
}

export interface AttendanceDailyReport {
  date: string;
  summary: AttendanceDailySummary;
  items: EmployeeAttendanceRecord[];
}

export interface AttendanceMonthlyStatistics {
  year: number;
  months: Array<{
    month: number;
    averageClockIn: number | null;
    averageClockOut: number | null;
  }>;
}

export interface TimesheetEntryInput {
  clockIn: string | null;
  clockOut: string | null;
  regularHours: number;
  overtimeHours: number;
  breakMinutes: number;
  notes: string | null;
}

export interface EmployeeTimesheetEntry extends TimesheetEntryInput {
  id: string | null;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  department: string | null;
  jobTitle: string | null;
}

export interface TimesheetDailyReport {
  date: string;
  items: EmployeeTimesheetEntry[];
}

export type LeaveRequestStatus = "pending" | "approved" | "rejected";
export type EmployeeLeaveType = "annual" | "sick" | "emergency" | "parental" | "unpaid" | "other";

export interface EmployeeLeaveRequestInput {
  employeeId: string;
  leaveType: EmployeeLeaveType;
  startDate: string;
  endDate: string;
  requestedDays: number;
  reason: string;
}

export interface EmployeeLeaveDecisionInput {
  status: "approved" | "rejected";
  decisionNote: string | null;
}

export interface EmployeeLeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  department: string | null;
  leaveType: EmployeeLeaveType;
  startDate: string;
  endDate: string;
  requestedDays: number;
  reason: string;
  status: LeaveRequestStatus;
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

export class EmployeeLeaveRequestError extends Error {
  constructor(readonly code: "overlap" | "not_pending") {
    super(code);
    this.name = "EmployeeLeaveRequestError";
  }
}

export class PayrollRunError extends Error {
  constructor(readonly code:
    | "duplicate_period"
    | "not_found"
    | "not_draft"
    | "no_payroll_profiles"
    | "mixed_currencies"
    | "negative_net_pay"
  ) {
    super(code);
    this.name = "PayrollRunError";
  }
}

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
  sortBy: "employeeNumber" | "displayName" | "workEmail" | "department" | "jobTitle" | "employmentType" | "employmentStatus" | "hireDate";
  sortOrder: "asc" | "desc";
}

export interface EmployeeDirectoryItem {
  id: string;
  positionId: string | null;
  displayName: string;
  employeeNumber: string | null;
  workEmail: string;
  department: string | null;
  jobTitle: string | null;
  managerEmployeeId: string | null;
  employmentType: EmploymentType;
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
  positionId: string | null;
  employeeNumber: string | null;
  displayName: string;
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
  nationality: string | null;
  religion: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  emergencyContactEmail: string | null;
  emergencyContactAddress: string | null;
  educationLevel: string | null;
  educationInstitution: string | null;
  educationField: string | null;
  graduationYear: number | null;
  educationHistory: EmployeeEducationHistoryEntry[];
  workEmail: string;
  department: string | null;
  managerName: string | null;
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
  updatedAt: string;
}

export interface EmployeeMasterInput {
  positionId: string | null;
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
  nationality: string | null;
  religion: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  emergencyContactEmail: string | null;
  emergencyContactAddress: string | null;
  educationLevel: string | null;
  educationInstitution: string | null;
  educationField: string | null;
  graduationYear: number | null;
  educationHistory?: EmployeeEducationHistoryInput[] | undefined;
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

export class EmployeeRecordError extends Error {
  constructor(readonly code: "forbidden" | "not_found" | "duplicate_employee_number" | "duplicate_work_email" | "invalid_manager" | "invalid_position") {
    super(code);
    this.name = "EmployeeRecordError";
  }
}

export function mayAuthenticate(status: DirectoryAccountStatus): boolean {
  return status === "active";
}
