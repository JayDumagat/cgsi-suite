import type {
  EmployeeDirectoryProfile,
  EmployeeActivityEntry,
  EmployeeLeaveDecisionInput,
  EmployeeLeaveManagementReport,
  EmployeeLeaveRequest,
  EmployeeLeaveRequestInput,
  AttendanceDailyReport,
  AttendanceMonthlyStatistics,
  AttendanceRecordInput,
  EmployeeTimesheetEntry,
  EmployeeHrDetails,
  EmployeeMasterInput,
  EmployeeMasterRecord,
  EmployeeDirectoryPage,
  EmployeeDirectoryQuery,
  EntraEmployeeProfile,
  ProvisionedEmployee,
  TimesheetDailyReport,
  TimesheetEntryInput,
  PayrollRun,
  PayrollRunInput,
  PayrollRunItemInput,
  PayrollRunsReport,
} from "../domain/employee.js";
import type {
  BranchInput,
  DepartmentInput,
  OrganizationInput,
  PositionInput,
  PositionUpdateInput,
  OrganizationRecord,
  OrganizationStructure,
} from "../domain/organization.js";

export interface EmployeeDirectory {
  provisionEntraEmployee(profile: EntraEmployeeProfile): Promise<ProvisionedEmployee>;
  getActiveProfile(employeeId: string): Promise<EmployeeDirectoryProfile | null>;
  listEmployees(query: EmployeeDirectoryQuery, requestedByEmployeeId: string): Promise<EmployeeDirectoryPage>;
  getEmployeeRecord(employeeId: string, requestedByEmployeeId: string): Promise<EmployeeMasterRecord>;
  getEmployeeActivity(employeeId: string, requestedByEmployeeId: string): Promise<EmployeeActivityEntry[]>;
  getEmployeeHrDetails(employeeId: string, requestedByEmployeeId: string): Promise<EmployeeHrDetails>;
  updateEmployeeHrDetails(employeeId: string, details: EmployeeHrDetails, requestedByEmployeeId: string): Promise<EmployeeHrDetails>;
  getAttendanceReport(date: string, search: string, requestedByEmployeeId: string): Promise<AttendanceDailyReport>;
  getAttendanceMonthlyStatistics(year: number, requestedByEmployeeId: string): Promise<AttendanceMonthlyStatistics>;
  getTimesheetReport(date: string, requestedByEmployeeId: string): Promise<TimesheetDailyReport>;
  saveTimesheetEntry(
    employeeId: string,
    date: string,
    input: TimesheetEntryInput,
    requestedByEmployeeId: string,
  ): Promise<EmployeeTimesheetEntry>;
  updateAttendanceRecord(
    employeeId: string,
    date: string,
    input: AttendanceRecordInput,
    requestedByEmployeeId: string,
  ): Promise<AttendanceDailyReport["items"][number]>;
  deleteAttendanceRecord(
    employeeId: string,
    date: string,
    requestedByEmployeeId: string,
  ): Promise<void>;
  getLeaveManagementReport(requestedByEmployeeId: string): Promise<EmployeeLeaveManagementReport>;
  createLeaveRequest(input: EmployeeLeaveRequestInput, requestedByEmployeeId: string): Promise<EmployeeLeaveRequest>;
  decideLeaveRequest(
    requestId: string,
    input: EmployeeLeaveDecisionInput,
    requestedByEmployeeId: string,
  ): Promise<EmployeeLeaveRequest>;
  getPayrollRunsReport(requestedByEmployeeId: string): Promise<PayrollRunsReport>;
  createPayrollRun(input: PayrollRunInput, requestedByEmployeeId: string): Promise<PayrollRun>;
  updatePayrollRunItem(
    runId: string,
    itemId: string,
    input: PayrollRunItemInput,
    requestedByEmployeeId: string,
  ): Promise<PayrollRun>;
  processPayrollRun(runId: string, requestedByEmployeeId: string): Promise<PayrollRun>;
  createEmployeeRecord(input: EmployeeMasterInput, requestedByEmployeeId: string): Promise<EmployeeMasterRecord>;
  updateEmployeeRecord(employeeId: string, input: EmployeeMasterInput, requestedByEmployeeId: string): Promise<EmployeeMasterRecord>;
  getOrganizationStructure(requestedByEmployeeId: string): Promise<OrganizationStructure>;
  createOrganization(input: OrganizationInput, requestedByEmployeeId: string): Promise<OrganizationRecord>;
  createDepartment(
    organizationId: string,
    input: DepartmentInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["departments"][number]>;
  createBranch(
    organizationId: string,
    input: BranchInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["branches"][number]>;
  createPosition(
    organizationId: string,
    departmentId: string,
    input: PositionInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["departments"][number]["positions"][number]>;
  updateBranch(
    organizationId: string,
    branchId: string,
    input: BranchInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["branches"][number]>;
  updateDepartment(
    organizationId: string,
    departmentId: string,
    input: DepartmentInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["departments"][number]>;
  updatePosition(
    organizationId: string,
    departmentId: string,
    positionId: string,
    input: PositionUpdateInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["departments"][number]["positions"][number]>;
}

export class EmployeeDirectoryService {
  constructor(private readonly directory: EmployeeDirectory) {}

  provisionFromVerifiedEntra(profile: EntraEmployeeProfile): Promise<ProvisionedEmployee> {
    return this.directory.provisionEntraEmployee(profile);
  }

  readActiveProfile(employeeId: string): Promise<EmployeeDirectoryProfile | null> {
    return this.directory.getActiveProfile(employeeId);
  }

  listEmployees(query: EmployeeDirectoryQuery, requestedByEmployeeId: string): Promise<EmployeeDirectoryPage> {
    return this.directory.listEmployees(query, requestedByEmployeeId);
  }

  getEmployeeRecord(employeeId: string, requestedByEmployeeId: string): Promise<EmployeeMasterRecord> {
    return this.directory.getEmployeeRecord(employeeId, requestedByEmployeeId);
  }

  getEmployeeActivity(employeeId: string, requestedByEmployeeId: string): Promise<EmployeeActivityEntry[]> {
    return this.directory.getEmployeeActivity(employeeId, requestedByEmployeeId);
  }

  getEmployeeHrDetails(employeeId: string, requestedByEmployeeId: string): Promise<EmployeeHrDetails> {
    return this.directory.getEmployeeHrDetails(employeeId, requestedByEmployeeId);
  }

  updateEmployeeHrDetails(
    employeeId: string,
    details: EmployeeHrDetails,
    requestedByEmployeeId: string,
  ): Promise<EmployeeHrDetails> {
    return this.directory.updateEmployeeHrDetails(employeeId, details, requestedByEmployeeId);
  }

  getAttendanceReport(date: string, search: string, requestedByEmployeeId: string): Promise<AttendanceDailyReport> {
    return this.directory.getAttendanceReport(date, search, requestedByEmployeeId);
  }

  getAttendanceMonthlyStatistics(
    year: number,
    requestedByEmployeeId: string,
  ): Promise<AttendanceMonthlyStatistics> {
    return this.directory.getAttendanceMonthlyStatistics(year, requestedByEmployeeId);
  }

  getTimesheetReport(date: string, requestedByEmployeeId: string): Promise<TimesheetDailyReport> {
    return this.directory.getTimesheetReport(date, requestedByEmployeeId);
  }

  saveTimesheetEntry(
    employeeId: string,
    date: string,
    input: TimesheetEntryInput,
    requestedByEmployeeId: string,
  ): Promise<EmployeeTimesheetEntry> {
    return this.directory.saveTimesheetEntry(employeeId, date, input, requestedByEmployeeId);
  }

  updateAttendanceRecord(
    employeeId: string,
    date: string,
    input: AttendanceRecordInput,
    requestedByEmployeeId: string,
  ): Promise<AttendanceDailyReport["items"][number]> {
    return this.directory.updateAttendanceRecord(employeeId, date, input, requestedByEmployeeId);
  }

  deleteAttendanceRecord(
    employeeId: string,
    date: string,
    requestedByEmployeeId: string,
  ): Promise<void> {
    return this.directory.deleteAttendanceRecord(employeeId, date, requestedByEmployeeId);
  }

  getLeaveManagementReport(requestedByEmployeeId: string): Promise<EmployeeLeaveManagementReport> {
    return this.directory.getLeaveManagementReport(requestedByEmployeeId);
  }

  createLeaveRequest(input: EmployeeLeaveRequestInput, requestedByEmployeeId: string): Promise<EmployeeLeaveRequest> {
    return this.directory.createLeaveRequest(input, requestedByEmployeeId);
  }

  decideLeaveRequest(
    requestId: string,
    input: EmployeeLeaveDecisionInput,
    requestedByEmployeeId: string,
  ): Promise<EmployeeLeaveRequest> {
    return this.directory.decideLeaveRequest(requestId, input, requestedByEmployeeId);
  }

  getPayrollRunsReport(requestedByEmployeeId: string): Promise<PayrollRunsReport> {
    return this.directory.getPayrollRunsReport(requestedByEmployeeId);
  }

  createPayrollRun(input: PayrollRunInput, requestedByEmployeeId: string): Promise<PayrollRun> {
    return this.directory.createPayrollRun(input, requestedByEmployeeId);
  }

  updatePayrollRunItem(
    runId: string,
    itemId: string,
    input: PayrollRunItemInput,
    requestedByEmployeeId: string,
  ): Promise<PayrollRun> {
    return this.directory.updatePayrollRunItem(runId, itemId, input, requestedByEmployeeId);
  }

  processPayrollRun(runId: string, requestedByEmployeeId: string): Promise<PayrollRun> {
    return this.directory.processPayrollRun(runId, requestedByEmployeeId);
  }

  createEmployeeRecord(input: EmployeeMasterInput, requestedByEmployeeId: string): Promise<EmployeeMasterRecord> {
    return this.directory.createEmployeeRecord(input, requestedByEmployeeId);
  }

  updateEmployeeRecord(employeeId: string, input: EmployeeMasterInput, requestedByEmployeeId: string): Promise<EmployeeMasterRecord> {
    return this.directory.updateEmployeeRecord(employeeId, input, requestedByEmployeeId);
  }

  getOrganizationStructure(requestedByEmployeeId: string): Promise<OrganizationStructure> {
    return this.directory.getOrganizationStructure(requestedByEmployeeId);
  }

  createOrganization(
    input: OrganizationInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord> {
    return this.directory.createOrganization(input, requestedByEmployeeId);
  }

  createDepartment(
    organizationId: string,
    input: DepartmentInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["departments"][number]> {
    return this.directory.createDepartment(organizationId, input, requestedByEmployeeId);
  }

  createBranch(
    organizationId: string,
    input: BranchInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["branches"][number]> {
    return this.directory.createBranch(organizationId, input, requestedByEmployeeId);
  }

  createPosition(
    organizationId: string,
    departmentId: string,
    input: PositionInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["departments"][number]["positions"][number]> {
    return this.directory.createPosition(
      organizationId,
      departmentId,
      input,
      requestedByEmployeeId,
    );
  }

  updateBranch(
    organizationId: string,
    branchId: string,
    input: BranchInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["branches"][number]> {
    return this.directory.updateBranch(organizationId, branchId, input, requestedByEmployeeId);
  }

  updateDepartment(
    organizationId: string,
    departmentId: string,
    input: DepartmentInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["departments"][number]> {
    return this.directory.updateDepartment(organizationId, departmentId, input, requestedByEmployeeId);
  }

  updatePosition(
    organizationId: string,
    departmentId: string,
    positionId: string,
    input: PositionUpdateInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["departments"][number]["positions"][number]> {
    return this.directory.updatePosition(
      organizationId,
      departmentId,
      positionId,
      input,
      requestedByEmployeeId,
    );
  }
}
