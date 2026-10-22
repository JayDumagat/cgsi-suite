import type { Pool, PoolClient } from "../../../node_modules/@types/pg/index.js";
import {
  EmployeeRecordError,
  type EmployeeMasterInput,
  type EmployeeMasterRecord,
  type EmploymentStatus,
  type EmploymentType,
} from "../../modules/directory/domain/employee.js";

interface EmployeeMasterRow {
  id: string;
  employee_number: string | null;
  display_name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  preferred_name: string | null;
  personal_email: string | null;
  personal_phone: string | null;
  education_level: string | null;
  education_institution: string | null;
  education_field: string | null;
  graduation_year: number | null;
  work_email: string;
  department: string | null;
  manager_name: string | null;
  manager_work_email: string | null;
  job_title: string | null;
  employment_type: EmploymentType;
  employment_status: EmploymentStatus;
  hire_date: string | null;
  termination_date: string | null;
  work_phone: string | null;
  work_location: string | null;
  updated_at: Date;
}

const employeeMasterSelect = [
  "SELECT employee.id::text AS id, employee.employee_number, employee.display_name,",
  "       employee.first_name, employee.middle_name, employee.last_name, employee.suffix,",
  "       employee.preferred_name, employee.personal_email, employee.personal_phone,",
  "       employee.education_level, employee.education_institution, employee.education_field,",
  "       employee.graduation_year, employee.work_email, employee.department,",
  "       manager.display_name AS manager_name, manager.work_email AS manager_work_email,",
  "       employee.job_title, employee.employment_type, employee.employment_status,",
  "       employee.hire_date::text, employee.termination_date::text,",
  "       employee.work_phone, employee.work_location, employee.updated_at",
  "  FROM huma.employees AS employee",
  "  LEFT JOIN huma.employees AS manager ON manager.id = employee.manager_employee_id",
].join("\n");

export class EmployeeMasterRepository {
  constructor(protected readonly pool: Pool) {}

  async getEmployeeRecord(
    employeeId: string,
    requestedByEmployeeId: string,
  ): Promise<EmployeeMasterRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.read");
      const result = await client.query<EmployeeMasterRow>(
        employeeMasterSelect + " WHERE employee.id = $1",
        [employeeId],
      );
      const row = result.rows[0];
      if (!row) throw new EmployeeRecordError("not_found");
      await client.query(
        [
          "INSERT INTO audit.events",
          "  (actor_type, actor_employee_id, action, outcome, target_type, target_id, source)",
          "VALUES ('employee', $1, 'eris.employee_record.read', 'success', 'employee', $2, 'eris')",
        ].join("\n"),
        [requestedByEmployeeId, employeeId],
      );
      await client.query("COMMIT");
      return toEmployeeMaster(row);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async createEmployeeRecord(
    input: EmployeeMasterInput,
    requestedByEmployeeId: string,
  ): Promise<EmployeeMasterRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.create");
      await lockEmployeeIdentifiers(client, input);
      await ensureUniqueEmployeeEmail(client, input.workEmail);
      await ensureUniqueEmployeeNumber(client, input.employeeNumber);
      const managerId = await resolveManager(client, input.managerWorkEmail, null);
      const displayName = composeDisplayName(input);
      const inserted = await client.query<{ id: string }>(
        [
          "INSERT INTO huma.employees",
          "  (employee_number, first_name, middle_name, last_name, suffix, display_name, preferred_name,",
          "   personal_email, personal_phone, education_level, education_institution, education_field, graduation_year,",
          "   work_email, department, manager_employee_id, job_title, employment_type,",
          "   employment_status, hire_date, termination_date, work_phone, work_location,",
          "   created_by_employee_id, updated_by_employee_id)",
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $24)",
          "RETURNING id::text AS id",
        ].join("\n"),
        [
          input.employeeNumber,
          input.firstName,
          input.middleName,
          input.lastName,
          input.suffix,
          displayName,
          input.preferredName,
          input.personalEmail,
          input.personalPhone,
          input.educationLevel,
          input.educationInstitution,
          input.educationField,
          input.graduationYear,
          input.workEmail.toLowerCase(),
          input.department,
          managerId,
          input.jobTitle,
          input.employmentType,
          input.employmentStatus,
          input.hireDate,
          input.terminationDate,
          input.workPhone,
          input.workLocation,
          requestedByEmployeeId,
        ],
      );
      const employeeId = inserted.rows[0]!.id;
      await auditEmployeeChange(
        client,
        requestedByEmployeeId,
        employeeId,
        "eris.employee_record.create",
        Object.keys(input),
      );
      const record = await client.query<EmployeeMasterRow>(
        employeeMasterSelect + " WHERE employee.id = $1",
        [employeeId],
      );
      await client.query("COMMIT");
      return toEmployeeMaster(record.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateEmployeeRecord(
    employeeId: string,
    input: EmployeeMasterInput,
    requestedByEmployeeId: string,
  ): Promise<EmployeeMasterRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.update");
      const current = await client.query<{ id: string }>(
        "SELECT id::text AS id FROM huma.employees WHERE id = $1 FOR UPDATE",
        [employeeId],
      );
      if (!current.rowCount) throw new EmployeeRecordError("not_found");
      await lockEmployeeIdentifiers(client, input);
      await ensureUniqueEmployeeEmail(client, input.workEmail, employeeId);
      await ensureUniqueEmployeeNumber(client, input.employeeNumber, employeeId);
      const managerId = await resolveManager(client, input.managerWorkEmail, employeeId);
      const displayName = composeDisplayName(input);
      await client.query(
        [
          "UPDATE huma.employees",
          "   SET employee_number = $1, first_name = $2, middle_name = $3, last_name = $4, suffix = $5,",
          "       display_name = $6, preferred_name = $7, personal_email = $8, personal_phone = $9,",
          "       education_level = $10, education_institution = $11, education_field = $12, graduation_year = $13,",
          "       work_email = $14, department = $15, manager_employee_id = $16, job_title = $17,",
          "       employment_type = $18, employment_status = $19, hire_date = $20, termination_date = $21,",
          "       work_phone = $22, work_location = $23, updated_by_employee_id = $24, updated_at = now()",
          " WHERE id = $25",
        ].join("\n"),
        [
          input.employeeNumber,
          input.firstName,
          input.middleName,
          input.lastName,
          input.suffix,
          displayName,
          input.preferredName,
          input.personalEmail,
          input.personalPhone,
          input.educationLevel,
          input.educationInstitution,
          input.educationField,
          input.graduationYear,
          input.workEmail.toLowerCase(),
          input.department,
          managerId,
          input.jobTitle,
          input.employmentType,
          input.employmentStatus,
          input.hireDate,
          input.terminationDate,
          input.workPhone,
          input.workLocation,
          requestedByEmployeeId,
          employeeId,
        ],
      );
      await auditEmployeeChange(
        client,
        requestedByEmployeeId,
        employeeId,
        "eris.employee_record.update",
        Object.keys(input),
      );
      const record = await client.query<EmployeeMasterRow>(
        employeeMasterSelect + " WHERE employee.id = $1",
        [employeeId],
      );
      await client.query("COMMIT");
      return toEmployeeMaster(record.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function hasEmployeePermission(
  client: PoolClient,
  employeeId: string,
  permissionKey: string,
): Promise<boolean> {
  const result = await client.query<{ allowed: boolean }>(
    [
      "WITH assigned_roles AS (",
      "  SELECT role_key, scope_type, scope_id FROM iam.employee_roles",
      "   WHERE employee_id = $1 AND revoked_at IS NULL",
      "     AND (expires_at IS NULL OR expires_at > now())",
      "  UNION",
      "  SELECT group_role.role_key, group_role.scope_type, group_role.scope_id",
      "    FROM iam.employee_groups AS membership",
      "    JOIN iam.group_roles AS group_role ON group_role.group_id = membership.group_id",
      "   WHERE membership.employee_id = $1 AND membership.revoked_at IS NULL",
      "     AND (membership.expires_at IS NULL OR membership.expires_at > now())",
      "     AND group_role.revoked_at IS NULL",
      "     AND (group_role.expires_at IS NULL OR group_role.expires_at > now())",
      ")",
      "SELECT EXISTS (",
      "  SELECT 1 FROM assigned_roles AS assigned",
      "  JOIN iam.role_permissions AS role_permission USING (role_key)",
      "  WHERE role_permission.permission_key = $2",
      "    AND assigned.scope_type = 'app' AND assigned.scope_id IN ('*', 'eris')",
      ") AS allowed",
    ].join("\n"),
    [employeeId, permissionKey],
  );
  return result.rows[0]?.allowed === true;
}

async function requireEmployeePermission(
  client: PoolClient,
  employeeId: string,
  permissionKey: string,
): Promise<void> {
  if (!(await hasEmployeePermission(client, employeeId, permissionKey))) {
    throw new EmployeeRecordError("forbidden");
  }
}

async function lockEmployeeIdentifiers(client: PoolClient, input: EmployeeMasterInput): Promise<void> {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('hris_employee_email:' || lower($1), 0))",
    [input.workEmail],
  );
  if (input.employeeNumber) {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('hris_employee_number:' || lower($1), 0))",
      [input.employeeNumber],
    );
  }
}

async function ensureUniqueEmployeeEmail(
  client: PoolClient,
  workEmail: string,
  exceptEmployeeId?: string,
): Promise<void> {
  const result = await client.query<{ exists: boolean }>(
    [
      "SELECT EXISTS (SELECT 1 FROM huma.employees",
      " WHERE lower(work_email) = lower($1)",
      "   AND ($2::uuid IS NULL OR id <> $2::uuid)) AS exists",
    ].join("\n"),
    [workEmail, exceptEmployeeId ?? null],
  );
  if (result.rows[0]?.exists) throw new EmployeeRecordError("duplicate_work_email");
}

async function ensureUniqueEmployeeNumber(
  client: PoolClient,
  employeeNumber: string | null,
  exceptEmployeeId?: string,
): Promise<void> {
  if (!employeeNumber) return;
  const result = await client.query<{ exists: boolean }>(
    [
      "SELECT EXISTS (SELECT 1 FROM huma.employees",
      " WHERE lower(employee_number) = lower($1)",
      "   AND ($2::uuid IS NULL OR id <> $2::uuid)) AS exists",
    ].join("\n"),
    [employeeNumber, exceptEmployeeId ?? null],
  );
  if (result.rows[0]?.exists) throw new EmployeeRecordError("duplicate_employee_number");
}

async function resolveManager(
  client: PoolClient,
  managerWorkEmail: string | null,
  employeeId: string | null,
): Promise<string | null> {
  const email = managerWorkEmail?.trim().toLowerCase();
  if (!email) return null;
  const manager = await client.query<{ id: string }>(
    [
      "SELECT id::text AS id FROM huma.employees",
      " WHERE lower(work_email) = $1 AND employment_status IN ('active', 'on_leave')",
      "   AND ($2::uuid IS NULL OR id <> $2::uuid)",
      " LIMIT 1",
    ].join("\n"),
    [email, employeeId],
  );
  if (!manager.rows[0]) throw new EmployeeRecordError("invalid_manager");
  return manager.rows[0].id;
}

async function auditEmployeeChange(
  client: PoolClient,
  actorEmployeeId: string,
  employeeId: string,
  action: string,
  changedFields: string[],
): Promise<void> {
  await client.query(
    [
      "INSERT INTO audit.events",
      "  (actor_type, actor_employee_id, action, outcome, target_type, target_id, source, details)",
      "VALUES ('employee', $1, $2, 'success', 'employee', $3, 'eris', $4::jsonb)",
    ].join("\n"),
    [actorEmployeeId, action, employeeId, JSON.stringify({ changedFields })],
  );
}

function toEmployeeMaster(row: EmployeeMasterRow): EmployeeMasterRecord {
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    displayName: row.display_name,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    suffix: row.suffix,
    preferredName: row.preferred_name,
    personalEmail: row.personal_email,
    personalPhone: row.personal_phone,
    educationLevel: row.education_level,
    educationInstitution: row.education_institution,
    educationField: row.education_field,
    graduationYear: row.graduation_year,
    workEmail: row.work_email,
    department: row.department,
    managerName: row.manager_name,
    managerWorkEmail: row.manager_work_email,
    jobTitle: row.job_title,
    employmentType: row.employment_type,
    employmentStatus: row.employment_status,
    hireDate: row.hire_date,
    terminationDate: row.termination_date,
    workPhone: row.work_phone,
    workLocation: row.work_location,
    updatedAt: row.updated_at.toISOString(),
  };
}

function composeDisplayName(input: EmployeeMasterInput): string {
  return [
    input.preferredName?.trim() || input.firstName.trim(),
    input.lastName.trim(),
    input.suffix?.trim(),
  ].filter(Boolean).join(" ");
}
