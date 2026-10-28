import type { Pool, PoolClient } from "../../../node_modules/@types/pg/index.js";
import { withSpan } from "../../platform/telemetry.js";
import { EmployeeMasterRepository, hasEmployeePermission } from "./employee-records.js";
import type {
  EmployeeDirectoryProfile,
  EmployeeDirectoryPage,
  EmployeeDirectoryQuery,
  EntraEmployeeProfile,
  EmploymentType,
  EmploymentStatus,
  DirectoryAccountStatus,
  ProvisionedEmployee,
} from "../../modules/directory/domain/employee.js";
import { EmployeeRecordError } from "../../modules/directory/domain/employee.js";
import {
  OrganizationManagementError,
  type BranchInput,
  type DepartmentInput,
  type OrganizationInput,
  type PositionInput,
  type PositionUpdateInput,
  type OrganizationRecord,
  type OrganizationStructure,
} from "../../modules/directory/domain/organization.js";
import { mayAuthenticate } from "../../modules/directory/domain/employee.js";

const directorySortExpressions = {
  employeeNumber: "lower(COALESCE(employee.employee_number, ''))",
  displayName: "lower(employee.display_name)",
  workEmail: "lower(employee.work_email)",
  department: "lower(COALESCE(role_department.display_name, employee.department, ''))",
  jobTitle: "lower(COALESCE(role_position.display_name, employee.job_title, ''))",
  employmentType: "employee.employment_type",
  employmentStatus: "employee.employment_status",
  hireDate: "employee.hire_date",
} as const;

export class DirectoryRepository extends EmployeeMasterRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async getOrganizationStructure(
    requestedByEmployeeId: string,
  ): Promise<OrganizationStructure> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      if (!(await hasEmployeePermission(client, requestedByEmployeeId, "hris.employee.read"))) {
        throw new EmployeeRecordError("forbidden");
      }
      const organizations = await client.query<{
        id: string;
        unit_code: string | null;
        display_name: string;
      }>(
        [
          "SELECT id::text AS id, unit_code, display_name",
          "  FROM directory.org_units",
          " WHERE source = 'eris' AND parent_id IS NULL",
          " ORDER BY lower(display_name), id",
        ].join("\n"),
      );
      const organizationIds = organizations.rows.map((organization) => organization.id);
      const departments = organizationIds.length
        ? await client.query<{
            id: string;
            parent_id: string;
            unit_type: string | null;
            unit_code: string | null;
            display_name: string;
            address: string | null;
            branch_manager_employee_id: string | null;
            department_head_employee_id: string | null;
          }>(
            [
              "SELECT id::text AS id, parent_id::text AS parent_id, unit_type, unit_code, display_name,",
              "       address, branch_manager_employee_id::text, department_head_employee_id::text",
              "  FROM directory.org_units",
              " WHERE source = 'eris' AND parent_id = ANY($1::uuid[])",
              " ORDER BY lower(display_name), id",
            ].join("\n"),
            [organizationIds],
          )
        : { rows: [] };
      const departmentIds = departments.rows
        .filter((unit) => unit.unit_type === "department")
        .map((department) => department.id);
      const positions = departmentIds.length
        ? await client.query<{
            id: string;
            parent_id: string;
            unit_code: string | null;
            display_name: string;
            description: string | null;
            job_level: string | null;
          }>(
            [
              "SELECT id::text AS id, parent_id::text AS parent_id, unit_code, display_name, description, job_level",
              "  FROM directory.org_units",
              " WHERE source = 'eris' AND unit_type = 'position' AND parent_id = ANY($1::uuid[])",
              " ORDER BY lower(display_name), id",
            ].join("\n"),
            [departmentIds],
          )
        : { rows: [] };

      await client.query("COMMIT");
      return {
        organizations: organizations.rows.map((organization) => ({
          id: organization.id,
          name: organization.display_name,
          code: organization.unit_code,
          departments: departments.rows
            .filter((department) => department.parent_id === organization.id && department.unit_type === "department")
            .map((department) => ({
              id: department.id,
              name: department.display_name,
              code: department.unit_code,
              headEmployeeId: department.department_head_employee_id,
              positions: positions.rows
                .filter((position) => position.parent_id === department.id)
                .map((position) => ({
                  id: position.id,
                  name: position.display_name,
                  code: position.unit_code,
                  description: position.description,
                  jobLevel: position.job_level,
                })),
            })),
          branches: departments.rows
            .filter((branch) => branch.parent_id === organization.id && branch.unit_type === "branch")
            .map((branch) => ({
              id: branch.id,
              name: branch.display_name,
              code: branch.unit_code,
              address: branch.address,
              managerEmployeeId: branch.branch_manager_employee_id,
            })),
        })),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async createOrganization(
    input: OrganizationInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<{
        id: string;
        unit_code: string | null;
        display_name: string;
      }>(
        [
          "INSERT INTO directory.org_units (unit_code, display_name, source, unit_type)",
          "VALUES ($1, $2, 'eris', 'organization')",
          "RETURNING id::text AS id, unit_code, display_name",
        ].join("\n"),
        [input.code, input.name],
      );
      const organization = inserted.rows[0]!;
      await auditOrganizationChange(
        client,
        requestedByEmployeeId,
        "eris.organization.create",
        "organization",
        organization.id,
        { name: organization.display_name, code: organization.unit_code },
      );
      await client.query("COMMIT");
      return {
        id: organization.id,
        name: organization.display_name,
        code: organization.unit_code,
        departments: [],
        branches: [],
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (isUniqueViolation(error)) {
        throw new OrganizationManagementError("duplicate_name");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async createDepartment(
    organizationId: string,
    input: DepartmentInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["departments"][number]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const organization = await client.query<{ id: string }>(
        [
          "SELECT id::text AS id FROM directory.org_units",
          " WHERE id = $1 AND source = 'eris' AND parent_id IS NULL",
        ].join("\n"),
        [organizationId],
      );
      if (!organization.rows[0]) {
        throw new OrganizationManagementError("not_found");
      }
      await requireAssignableEmployee(client, input.headEmployeeId);

      const inserted = await client.query<{
        id: string;
        unit_code: string | null;
        display_name: string;
        department_head_employee_id: string | null;
      }>(
        [
          "INSERT INTO directory.org_units (parent_id, unit_code, display_name, source, unit_type, department_head_employee_id)",
          "VALUES ($1, $2, $3, 'eris', 'department', $4)",
          "RETURNING id::text AS id, unit_code, display_name, department_head_employee_id::text",
        ].join("\n"),
        [organizationId, input.code, input.name, input.headEmployeeId],
      );
      const department = inserted.rows[0]!;
      await auditOrganizationChange(
        client,
        requestedByEmployeeId,
        "eris.department.create",
        "department",
        department.id,
        {
          name: department.display_name,
          code: department.unit_code,
          organizationId,
          headEmployeeId: input.headEmployeeId,
        },
      );
      await client.query("COMMIT");
      return {
        id: department.id,
        name: department.display_name,
        code: department.unit_code,
        headEmployeeId: department.department_head_employee_id,
        positions: [],
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (isUniqueViolation(error)) {
        throw new OrganizationManagementError("duplicate_name");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async createBranch(
    organizationId: string,
    input: BranchInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["branches"][number]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const organization = await client.query<{ id: string }>(
        [
          "SELECT id::text AS id FROM directory.org_units",
          " WHERE id = $1 AND source = 'eris' AND parent_id IS NULL",
        ].join("\n"),
        [organizationId],
      );
      if (!organization.rows[0]) {
        throw new OrganizationManagementError("not_found");
      }
      await requireAssignableEmployee(client, input.managerEmployeeId);

      const inserted = await client.query<{
        id: string;
        unit_code: string | null;
        display_name: string;
        address: string | null;
        branch_manager_employee_id: string | null;
      }>(
        [
          "INSERT INTO directory.org_units (parent_id, unit_code, display_name, source, unit_type, address, branch_manager_employee_id)",
          "VALUES ($1, $2, $3, 'eris', 'branch', $4, $5)",
          "RETURNING id::text AS id, unit_code, display_name, address, branch_manager_employee_id::text",
        ].join("\n"),
        [organizationId, input.code, input.name, input.address, input.managerEmployeeId],
      );
      const branch = inserted.rows[0]!;
      await auditOrganizationChange(
        client,
        requestedByEmployeeId,
        "eris.branch.create",
        "branch",
        branch.id,
        {
          name: branch.display_name,
          code: branch.unit_code,
          organizationId,
          address: branch.address,
          managerEmployeeId: branch.branch_manager_employee_id,
        },
      );
      await client.query("COMMIT");
      return {
        id: branch.id,
        name: branch.display_name,
        code: branch.unit_code,
        address: branch.address,
        managerEmployeeId: branch.branch_manager_employee_id,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (isUniqueViolation(error)) {
        throw new OrganizationManagementError("duplicate_name");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async createPosition(
    organizationId: string,
    departmentId: string,
    input: PositionInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["departments"][number]["positions"][number]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const department = await client.query<{ id: string }>(
        [
          "SELECT department.id::text AS id",
          "  FROM directory.org_units AS department",
          "  JOIN directory.org_units AS organization ON organization.id = department.parent_id",
          " WHERE department.id = $1 AND department.parent_id = $2",
          "   AND department.source = 'eris' AND department.unit_type = 'department'",
          "   AND organization.source = 'eris' AND organization.parent_id IS NULL",
        ].join("\n"),
        [departmentId, organizationId],
      );
      if (!department.rows[0]) {
        throw new OrganizationManagementError("department_not_found");
      }

      const inserted = await client.query<{
        id: string;
        unit_code: string | null;
        display_name: string;
        description: string | null;
        job_level: string | null;
      }>(
        [
          "INSERT INTO directory.org_units (parent_id, unit_code, display_name, source, unit_type, description, job_level)",
          "VALUES ($1, $2, $3, 'eris', 'position', $4, $5)",
          "RETURNING id::text AS id, unit_code, display_name, description, job_level",
        ].join("\n"),
        [departmentId, input.code, input.name, input.description, input.jobLevel],
      );
      const position = inserted.rows[0]!;
      await auditOrganizationChange(
        client,
        requestedByEmployeeId,
        "eris.position.create",
        "position",
        position.id,
        {
          name: position.display_name,
          code: position.unit_code,
          description: position.description,
          jobLevel: position.job_level,
          organizationId,
          departmentId,
        },
      );
      await client.query("COMMIT");
      return {
        id: position.id,
        name: position.display_name,
        code: position.unit_code,
        description: position.description,
        jobLevel: position.job_level,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (isUniqueViolation(error)) {
        throw new OrganizationManagementError("duplicate_name");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updateBranch(
    organizationId: string,
    branchId: string,
    input: BranchInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["branches"][number]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await requireOrganization(client, organizationId);
      await requireAssignableEmployee(client, input.managerEmployeeId);
      const updated = await client.query<{
        id: string;
        unit_code: string | null;
        display_name: string;
        address: string | null;
        branch_manager_employee_id: string | null;
      }>(
        [
          "UPDATE directory.org_units AS branch",
          "   SET unit_code = $3, display_name = $4, address = $5, branch_manager_employee_id = $6",
          " WHERE branch.id = $1 AND branch.parent_id = $2",
          "   AND branch.source = 'eris' AND branch.unit_type = 'branch'",
          "RETURNING id::text AS id, unit_code, display_name, address, branch_manager_employee_id::text",
        ].join("\n"),
        [branchId, organizationId, input.code, input.name, input.address, input.managerEmployeeId],
      );
      const branch = updated.rows[0];
      if (!branch) throw new OrganizationManagementError("not_found");
      await auditOrganizationChange(
        client,
        requestedByEmployeeId,
        "eris.branch.update",
        "branch",
        branch.id,
        {
          name: branch.display_name,
          code: branch.unit_code,
          organizationId,
          address: branch.address,
          managerEmployeeId: branch.branch_manager_employee_id,
        },
      );
      await client.query("COMMIT");
      return {
        id: branch.id,
        name: branch.display_name,
        code: branch.unit_code,
        address: branch.address,
        managerEmployeeId: branch.branch_manager_employee_id,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (isUniqueViolation(error)) {
        throw new OrganizationManagementError("duplicate_name");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updateDepartment(
    organizationId: string,
    departmentId: string,
    input: DepartmentInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["departments"][number]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await requireOrganization(client, organizationId);
      await requireAssignableEmployee(client, input.headEmployeeId);
      const updated = await client.query<{
        id: string;
        unit_code: string | null;
        display_name: string;
        department_head_employee_id: string | null;
      }>(
        [
          "UPDATE directory.org_units AS department",
          "   SET unit_code = $3, display_name = $4, department_head_employee_id = $5",
          " WHERE department.id = $1 AND department.parent_id = $2",
          "   AND department.source = 'eris' AND department.unit_type = 'department'",
          "RETURNING id::text AS id, unit_code, display_name, department_head_employee_id::text",
        ].join("\n"),
        [departmentId, organizationId, input.code, input.name, input.headEmployeeId],
      );
      const department = updated.rows[0];
      if (!department) throw new OrganizationManagementError("department_not_found");
      const positions = await client.query<{
        id: string;
        unit_code: string | null;
        display_name: string;
        description: string | null;
        job_level: string | null;
      }>(
        [
          "SELECT id::text AS id, unit_code, display_name, description, job_level",
          "  FROM directory.org_units",
          " WHERE source = 'eris' AND unit_type = 'position' AND parent_id = $1",
          " ORDER BY lower(display_name), id",
        ].join("\n"),
        [departmentId],
      );
      await auditOrganizationChange(
        client,
        requestedByEmployeeId,
        "eris.department.update",
        "department",
        department.id,
        {
          name: department.display_name,
          code: department.unit_code,
          organizationId,
          headEmployeeId: department.department_head_employee_id,
        },
      );
      await client.query("COMMIT");
      return {
        id: department.id,
        name: department.display_name,
        code: department.unit_code,
        headEmployeeId: department.department_head_employee_id,
        positions: positions.rows.map((position) => ({
          id: position.id,
          name: position.display_name,
          code: position.unit_code,
          description: position.description,
          jobLevel: position.job_level,
        })),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (isUniqueViolation(error)) {
        throw new OrganizationManagementError("duplicate_name");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePosition(
    organizationId: string,
    departmentId: string,
    positionId: string,
    input: PositionUpdateInput,
    requestedByEmployeeId: string,
  ): Promise<OrganizationRecord["departments"][number]["positions"][number]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const source = await client.query<{ id: string }>(
        [
          "SELECT job_position.id::text AS id",
          "  FROM directory.org_units AS job_position",
          "  JOIN directory.org_units AS department ON department.id = job_position.parent_id",
          "  JOIN directory.org_units AS organization ON organization.id = department.parent_id",
          " WHERE job_position.id = $1 AND department.id = $2 AND organization.id = $3",
          "   AND job_position.source = 'eris' AND job_position.unit_type = 'position'",
          "   AND department.source = 'eris' AND department.unit_type = 'department'",
          "   AND organization.source = 'eris' AND organization.parent_id IS NULL",
        ].join("\n"),
        [positionId, departmentId, organizationId],
      );
      if (!source.rows[0]) throw new OrganizationManagementError("position_not_found");
      const destination = await client.query<{ id: string }>(
        [
          "SELECT id::text AS id FROM directory.org_units",
          " WHERE id = $1 AND parent_id = $2 AND source = 'eris' AND unit_type = 'department'",
        ].join("\n"),
        [input.targetDepartmentId, organizationId],
      );
      if (!destination.rows[0]) throw new OrganizationManagementError("department_not_found");
      const updated = await client.query<{
        id: string;
        unit_code: string | null;
        display_name: string;
        description: string | null;
        job_level: string | null;
      }>(
        [
          "UPDATE directory.org_units AS job_position",
          "   SET parent_id = $2, unit_code = $3, display_name = $4, description = $5, job_level = $6",
          " WHERE job_position.id = $1 AND job_position.parent_id = $7",
          "   AND job_position.source = 'eris' AND job_position.unit_type = 'position'",
          "RETURNING id::text AS id, unit_code, display_name, description, job_level",
        ].join("\n"),
        [positionId, input.targetDepartmentId, input.code, input.name, input.description, input.jobLevel, departmentId],
      );
      const position = updated.rows[0];
      if (!position) throw new OrganizationManagementError("position_not_found");
      await auditOrganizationChange(
        client,
        requestedByEmployeeId,
        "eris.position.update",
        "position",
        position.id,
        {
          name: position.display_name,
          code: position.unit_code,
          description: position.description,
          jobLevel: position.job_level,
          organizationId,
          departmentId,
          targetDepartmentId: input.targetDepartmentId,
        },
      );
      await client.query("COMMIT");
      return {
        id: position.id,
        name: position.display_name,
        code: position.unit_code,
        description: position.description,
        jobLevel: position.job_level,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (isUniqueViolation(error)) {
        throw new OrganizationManagementError("duplicate_name");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async listEmployees(
    query: EmployeeDirectoryQuery,
    requestedByEmployeeId: string,
  ): Promise<EmployeeDirectoryPage> {
    return withSpan(
      "directory.list_eris_employees",
      { "db.system": "postgresql", "db.operation": "select" },
      async () => {
        const client = await this.pool.connect();
        try {
          await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
          if (!(await hasEmployeePermission(client, requestedByEmployeeId, "hris.employee.read"))) {
            throw new EmployeeRecordError("forbidden");
          }
          const canCreateEmployees = await hasEmployeePermission(
            client,
            requestedByEmployeeId,
            "hris.employee.create",
          );

          const summaryResult = await client.query<{
            total_employees: number;
            on_leave_employees: number;
            new_hires: number;
            average_tenure_years: number | null;
          }>(
            `SELECT COUNT(*)::int AS total_employees,
                    COUNT(*) FILTER (
                      WHERE employee.employment_status = 'on_leave'
                    )::int AS on_leave_employees,
                    COUNT(*) FILTER (
                      WHERE employee.employment_status IN ('active', 'on_leave')
                        AND employee.hire_date BETWEEN CURRENT_DATE - 29 AND CURRENT_DATE
                        AND (employee.termination_date IS NULL OR employee.termination_date >= CURRENT_DATE)
                    )::int AS new_hires,
                    ROUND(
                      AVG((CURRENT_DATE - employee.hire_date)::numeric / 365.25) FILTER (
                        WHERE employee.employment_status IN ('active', 'on_leave')
                          AND employee.hire_date <= CURRENT_DATE
                          AND (employee.termination_date IS NULL OR employee.termination_date >= CURRENT_DATE)
                      ),
                      1
                    )::double precision AS average_tenure_years
               FROM huma.employees AS employee`,
          );

          const normalizedSearch = query.search.trim().toLowerCase();
          const countResult = await client.query<{ total: number }>(
            `SELECT COUNT(*)::int AS total
               FROM huma.employees AS employee
               LEFT JOIN directory.org_units AS role_position
                 ON role_position.id = employee.position_id AND role_position.source = 'eris' AND role_position.unit_type = 'position'
               LEFT JOIN directory.org_units AS role_department ON role_department.id = role_position.parent_id
              WHERE $1 = ''
                 OR position($1 in lower(employee.display_name)) > 0
                 OR position($1 in lower(employee.work_email)) > 0
                 OR position($1 in lower(COALESCE(employee.employee_number, ''))) > 0
                 OR position($1 in lower(COALESCE(role_department.display_name, employee.department, ''))) > 0
                 OR position($1 in lower(COALESCE(role_position.display_name, employee.job_title, ''))) > 0`,
            [normalizedSearch],
          );

          const offset = (query.page - 1) * query.pageSize;
          const employeesResult = await client.query<{
            id: string;
            employee_number: string | null;
            display_name: string;
            work_email: string;
            department: string | null;
            job_title: string | null;
            position_id: string | null;
            employment_type: EmploymentType;
            hire_date: string | null;
            employment_status: EmploymentStatus;
            manager_employee_id: string | null;
          }>(
            `SELECT employee.id::text AS id,
                    employee.employee_number,
                    employee.display_name,
                    employee.work_email,
                    COALESCE(role_department.display_name, employee.department) AS department,
                    COALESCE(role_position.display_name, employee.job_title) AS job_title,
                    employee.position_id::text AS position_id,
                    employee.manager_employee_id::text AS manager_employee_id,
                    employee.employment_type,
                    employee.hire_date::text AS hire_date,
                    employee.employment_status
               FROM huma.employees AS employee
               LEFT JOIN directory.org_units AS role_position
                 ON role_position.id = employee.position_id AND role_position.source = 'eris' AND role_position.unit_type = 'position'
               LEFT JOIN directory.org_units AS role_department ON role_department.id = role_position.parent_id
              WHERE $1 = ''
                 OR position($1 in lower(employee.display_name)) > 0
                 OR position($1 in lower(employee.work_email)) > 0
                 OR position($1 in lower(COALESCE(employee.employee_number, ''))) > 0
                 OR position($1 in lower(COALESCE(role_department.display_name, employee.department, ''))) > 0
                 OR position($1 in lower(COALESCE(role_position.display_name, employee.job_title, ''))) > 0
              ORDER BY ${directorySortExpressions[query.sortBy]} ${query.sortOrder.toUpperCase()}${query.sortBy === "hireDate" ? " NULLS LAST" : ""},
                       lower(employee.display_name), employee.id
              LIMIT $2 OFFSET $3`,
            [normalizedSearch, query.pageSize, offset],
          );

          await client.query(
            `INSERT INTO audit.events
               (actor_type, actor_employee_id, action, outcome, target_type, target_id, source, details)
             VALUES ('employee', $1, 'eris.employee_directory.read', 'success',
                     'employee_directory', 'directory', 'eris', $2::jsonb)`,
            [
              requestedByEmployeeId,
              JSON.stringify({
                resultCount: employeesResult.rowCount ?? 0,
                page: query.page,
                pageSize: query.pageSize,
              }),
            ],
          );

          await client.query("COMMIT");
          const summary = summaryResult.rows[0]!;
          return {
            items: employeesResult.rows.map((employee) => ({
              id: employee.id,
              positionId: employee.position_id,
              displayName: employee.display_name,
              employeeNumber: employee.employee_number,
              workEmail: employee.work_email,
              department: employee.department,
              jobTitle: employee.job_title,
              managerEmployeeId: employee.manager_employee_id,
              employmentType: employee.employment_type,
              hireDate: employee.hire_date,
              employmentStatus: employee.employment_status,
            })),
            page: query.page,
            pageSize: query.pageSize,
            total: countResult.rows[0]?.total ?? 0,
            summary: {
              totalEmployees: summary.total_employees,
              onLeaveEmployees: summary.on_leave_employees,
              newHires: summary.new_hires,
              averageTenureYears: summary.average_tenure_years,
            },
            permissions: { canManageEmployees: false, canCreateEmployees },
          };
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
      },
    );
  }

  async provisionEntraEmployee(profile: EntraEmployeeProfile): Promise<ProvisionedEmployee> {
    return withSpan("directory.provision_employee", { "db.system": "postgresql", "db.operation": "upsert" }, () =>
      this.provisionEntraEmployeeTransaction(profile),
    );
  }

  private async provisionEntraEmployeeTransaction(profile: EntraEmployeeProfile): Promise<ProvisionedEmployee> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('entra:' || $1 || ':' || $2, 0))",
        [profile.tenantId, profile.objectId],
      );
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('employee_email:' || lower($1), 0))",
        [profile.email],
      );

      const existing = await client.query<{
        id: string;
        email: string;
        display_name: string;
        employment_status: DirectoryAccountStatus;
      }>(
        `SELECT employee.id, employee.work_email AS email, employee.display_name,
                employee.employment_status
           FROM directory.external_identities AS identity
           JOIN directory.employees AS employee ON employee.id = identity.employee_id
          WHERE identity.provider = 'entra' AND identity.tenant_id = $1 AND identity.subject = $2
          FOR UPDATE OF employee`,
        [profile.tenantId, profile.objectId],
      );

      let employee: ProvisionedEmployee;
      if (existing.rowCount) {
        const row = existing.rows[0]!;
        const active = mayAuthenticate(row.employment_status);
        if (active) {
          await client.query(
            `UPDATE directory.employees
                SET display_name = $1, work_email = $2, profile_source = 'entra',
                    profile_synced_at = now(), updated_at = now()
              WHERE id = $3 AND employment_status = 'active'`,
            [profile.displayName, profile.email.toLowerCase(), row.id],
          );
        }
        await client.query(
          `UPDATE directory.external_identities
              SET last_authenticated_at = now()
            WHERE provider = 'entra' AND tenant_id = $1 AND subject = $2`,
          [profile.tenantId, profile.objectId],
        );
        await client.query(
          `INSERT INTO audit.events
             (actor_type, actor_employee_id, action, outcome, target_type, target_id, source)
           VALUES ('employee', $1, 'identity.sign_in', $2, 'employee', $1::uuid::text, 'entra')`,
          [row.id, active ? "success" : "denied"],
        );
        employee = {
          employeeId: row.id,
          objectId: profile.objectId,
          email: active ? profile.email.toLowerCase() : row.email,
          displayName: active ? profile.displayName : row.display_name,
          active,
        };
      } else {
        const preexisting = await client.query<{
          id: string;
          email: string;
          display_name: string;
          employment_status: DirectoryAccountStatus;
        }>(
          [
            "SELECT id, work_email AS email, display_name, employment_status",
            "  FROM directory.employees",
            " WHERE lower(work_email) = lower($1)",
            " ORDER BY (employment_status = 'offboarded'), created_at",
            " LIMIT 1 FOR UPDATE",
          ].join("\n"),
          [profile.email],
        );

        if (preexisting.rows.length > 1) {
          throw new Error("ambiguous_employee_email_link");
        }
        if (preexisting.rowCount) {
          const row = preexisting.rows[0]!;
          const active = mayAuthenticate(row.employment_status);
          if (active) {
            await client.query(
              [
                "UPDATE directory.employees",
                "   SET display_name = $1, work_email = $2, profile_source = 'entra',",
                "       profile_synced_at = now(), updated_at = now()",
                " WHERE id = $3 AND employment_status = 'active'",
              ].join("\n"),
              [profile.displayName, profile.email.toLowerCase(), row.id],
            );
          }

          if (row.employment_status !== "offboarded") {
            await client.query(
              [
                "INSERT INTO directory.external_identities",
                "  (employee_id, provider, tenant_id, subject, last_authenticated_at)",
                "VALUES ($1, 'entra', $2, $3, now())",
              ].join("\n"),
              [row.id, profile.tenantId, profile.objectId],
            );
            await ensureBaselineEmployeeGroup(client, row.id, profile.objectId);
            await client.query(
              [
                "INSERT INTO audit.events",
                "  (actor_type, actor_employee_id, action, outcome, target_type, target_id, source)",
                "VALUES ('employee', $1, 'directory.employee.identity_linked', 'success', 'employee', $1::uuid::text, 'entra')",
              ].join("\n"),
              [row.id],
            );
          }
          await client.query(
            [
              "INSERT INTO audit.events",
              "  (actor_type, actor_employee_id, action, outcome, target_type, target_id, source)",
              "VALUES ('employee', $1, 'identity.sign_in', $2, 'employee', $1::uuid::text, 'entra')",
            ].join("\n"),
            [row.id, active ? "success" : "denied"],
          );
          employee = {
            employeeId: row.id,
            objectId: profile.objectId,
            email: active ? profile.email.toLowerCase() : row.email,
            displayName: active ? profile.displayName : row.display_name,
            active,
          };
          await client.query("COMMIT");
          return employee;
        }

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO directory.employees
             (display_name, work_email, employment_status, profile_source, profile_synced_at)
           VALUES ($1, $2, 'active', 'entra', now())
           RETURNING id`,
          [profile.displayName, profile.email.toLowerCase()],
        );
        const employeeId = inserted.rows[0]!.id;
        await client.query(
          `INSERT INTO directory.external_identities
             (employee_id, provider, tenant_id, subject, last_authenticated_at)
           VALUES ($1, 'entra', $2, $3, now())`,
          [employeeId, profile.tenantId, profile.objectId],
        );

        await ensureBaselineEmployeeGroup(client, employeeId, profile.objectId, false);

        await client.query(
          `INSERT INTO audit.events
             (actor_type, actor_employee_id, action, outcome, target_type, target_id, source)
           VALUES ('employee', $1, 'directory.employee.provisioned', 'success', 'employee', $1::uuid::text, 'entra'),
                  ('employee', $1, 'identity.sign_in', 'success', 'employee', $1::uuid::text, 'entra')`,
          [employeeId],
        );
        await client.query(
          `INSERT INTO platform.outbox_events
             (aggregate_type, aggregate_id, event_type, payload)
           VALUES ('employee', $1, 'authorization.employee_group.ensure',
                   jsonb_build_object('objectId', $2::text, 'groupKey', 'all-employees'))`,
          [employeeId, profile.objectId],
        );
        employee = {
          employeeId,
          objectId: profile.objectId,
          email: profile.email.toLowerCase(),
          displayName: profile.displayName,
          active: true,
        };
      }

      await client.query("COMMIT");
      return employee;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getActiveProfile(employeeId: string): Promise<EmployeeDirectoryProfile | null> {
    return withSpan("directory.read_employee_profile", { "db.system": "postgresql", "db.operation": "select" }, async () => {
    const result = await this.pool.query<{
      email: string;
      display_name: string;
      employment_status: DirectoryAccountStatus;
    }>(
      `SELECT work_email AS email, display_name, employment_status
         FROM directory.employees WHERE id = $1`,
      [employeeId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      email: row.email,
      displayName: row.display_name,
      active: mayAuthenticate(row.employment_status),
    };
    });
  }
}

async function auditOrganizationChange(
  client: PoolClient,
  actorEmployeeId: string,
  action: string,
  targetType: "organization" | "department" | "branch" | "position",
  targetId: string,
  details: Record<string, string | null>,
): Promise<void> {
  await client.query(
    [
      "INSERT INTO audit.events",
      "  (actor_type, actor_employee_id, action, outcome, target_type, target_id, source, details)",
      "VALUES ('employee', $1, $2, 'success', $3, $4, 'eris', $5::jsonb)",
    ].join("\n"),
    [actorEmployeeId, action, targetType, targetId, JSON.stringify(details)],
  );
}

async function requireAssignableEmployee(
  client: PoolClient,
  employeeId: string | null,
): Promise<void> {
  if (!employeeId) return;
  const employee = await client.query<{ id: string }>(
    "SELECT id::text AS id FROM huma.employees WHERE id = $1 AND employment_status IN ('active', 'on_leave')",
    [employeeId],
  );
  if (!employee.rows[0]) {
    throw new OrganizationManagementError("invalid_assignee");
  }
}

async function requireOrganization(client: PoolClient, organizationId: string): Promise<void> {
  const organization = await client.query<{ id: string }>(
    [
      "SELECT id::text AS id FROM directory.org_units",
      " WHERE id = $1 AND source = 'eris' AND parent_id IS NULL AND unit_type = 'organization'",
    ].join("\n"),
    [organizationId],
  );
  if (!organization.rows[0]) throw new OrganizationManagementError("not_found");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function ensureBaselineEmployeeGroup(
  client: PoolClient,
  employeeId: string,
  objectId: string,
  enqueue = true,
): Promise<void> {
  const group = await client.query<{ id: string }>(
    "SELECT id::text AS id FROM iam.groups WHERE group_key = 'all-employees' AND status = 'active'",
  );
  if (!group.rows[0]) throw new Error("baseline_employee_group_missing");
  await client.query(
    [
      "INSERT INTO iam.employee_groups (employee_id, group_id, source, reason)",
      "VALUES ($1, $2, 'system', 'Initial membership from verified Entra sign-in.')",
      "ON CONFLICT DO NOTHING",
    ].join("\n"),
    [employeeId, group.rows[0].id],
  );
  if (!enqueue) return;
  await client.query(
    [
      "INSERT INTO platform.outbox_events",
      "  (aggregate_type, aggregate_id, event_type, payload)",
      "VALUES ('employee', $1, 'authorization.employee_group.ensure',",
      "        jsonb_build_object('objectId', $2::text, 'groupKey', 'all-employees'))",
    ].join("\n"),
    [employeeId, objectId],
  );
}

