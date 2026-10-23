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
import { mayAuthenticate } from "../../modules/directory/domain/employee.js";

const directorySortExpressions = {
  employeeNumber: "lower(COALESCE(employee.employee_number, ''))",
  displayName: "lower(employee.display_name)",
  workEmail: "lower(employee.work_email)",
  department: "lower(COALESCE(employee.department, ''))",
  jobTitle: "lower(COALESCE(employee.job_title, ''))",
  employmentType: "employee.employment_type",
  employmentStatus: "employee.employment_status",
  hireDate: "employee.hire_date",
} as const;

export class DirectoryRepository extends EmployeeMasterRepository {
  constructor(pool: Pool) {
    super(pool);
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
              WHERE $1 = ''
                 OR position($1 in lower(employee.display_name)) > 0
                 OR position($1 in lower(employee.work_email)) > 0
                 OR position($1 in lower(COALESCE(employee.employee_number, ''))) > 0
                 OR position($1 in lower(COALESCE(employee.department, ''))) > 0
                 OR position($1 in lower(COALESCE(employee.job_title, ''))) > 0`,
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
            employment_type: EmploymentType;
            hire_date: string | null;
            employment_status: EmploymentStatus;
          }>(
            `SELECT employee.id::text AS id,
                    employee.employee_number,
                    employee.display_name,
                    employee.work_email,
                    employee.department,
                    employee.job_title,
                    employee.employment_type,
                    employee.hire_date::text AS hire_date,
                    employee.employment_status
               FROM huma.employees AS employee
              WHERE $1 = ''
                 OR position($1 in lower(employee.display_name)) > 0
                 OR position($1 in lower(employee.work_email)) > 0
                 OR position($1 in lower(COALESCE(employee.employee_number, ''))) > 0
                 OR position($1 in lower(COALESCE(employee.department, ''))) > 0
                 OR position($1 in lower(COALESCE(employee.job_title, ''))) > 0
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
              displayName: employee.display_name,
              employeeNumber: employee.employee_number,
              workEmail: employee.work_email,
              department: employee.department,
              jobTitle: employee.job_title,
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

