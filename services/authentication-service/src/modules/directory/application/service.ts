import type {
  EmployeeDirectoryProfile,
  EmployeeDirectoryPage,
  EmployeeDirectoryQuery,
  EntraEmployeeProfile,
  ProvisionedEmployee,
} from "../domain/employee.js";

export interface EmployeeDirectory {
  provisionEntraEmployee(profile: EntraEmployeeProfile): Promise<ProvisionedEmployee>;
  getActiveProfile(employeeId: string): Promise<EmployeeDirectoryProfile | null>;
  listEmployees(query: EmployeeDirectoryQuery, requestedByEmployeeId: string): Promise<EmployeeDirectoryPage>;
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
}
