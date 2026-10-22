import type {
  EmployeeDirectoryProfile,
  EmployeeMasterInput,
  EmployeeMasterRecord,
  EmployeeDirectoryPage,
  EmployeeDirectoryQuery,
  EntraEmployeeProfile,
  ProvisionedEmployee,
} from "../domain/employee.js";

export interface EmployeeDirectory {
  provisionEntraEmployee(profile: EntraEmployeeProfile): Promise<ProvisionedEmployee>;
  getActiveProfile(employeeId: string): Promise<EmployeeDirectoryProfile | null>;
  listEmployees(query: EmployeeDirectoryQuery, requestedByEmployeeId: string): Promise<EmployeeDirectoryPage>;
  getEmployeeRecord(employeeId: string, requestedByEmployeeId: string): Promise<EmployeeMasterRecord>;
  createEmployeeRecord(input: EmployeeMasterInput, requestedByEmployeeId: string): Promise<EmployeeMasterRecord>;
  updateEmployeeRecord(employeeId: string, input: EmployeeMasterInput, requestedByEmployeeId: string): Promise<EmployeeMasterRecord>;
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

  createEmployeeRecord(input: EmployeeMasterInput, requestedByEmployeeId: string): Promise<EmployeeMasterRecord> {
    return this.directory.createEmployeeRecord(input, requestedByEmployeeId);
  }

  updateEmployeeRecord(employeeId: string, input: EmployeeMasterInput, requestedByEmployeeId: string): Promise<EmployeeMasterRecord> {
    return this.directory.updateEmployeeRecord(employeeId, input, requestedByEmployeeId);
  }
}
