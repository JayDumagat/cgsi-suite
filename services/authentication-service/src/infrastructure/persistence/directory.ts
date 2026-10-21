import type { Pool } from "pg";
import { withSpan } from "../../platform/telemetry.js";
import type {
  EmployeeDirectoryProfile,
  EmployeeDirectoryPage,
  EmployeeDirectoryQuery,
  EntraEmployeeProfile,
  EmploymentStatus,
  ProvisionedEmployee,
} from "../../modules/directory/domain/employee.js";
import { mayAuthenticate } from "../../modules/directory/domain/employee.js";

export class DirectoryRepository {
  constructor(private readonly pool: Pool) {}

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

          const summaryResult = await client.query<{
            total_employees: number;
            active_employees: number;
            inactive_employees: number;
            departments: number;
          }>(
            `SELECT COUNT(*)::int AS total_employees,
                    COUNT(*) FILTER (WHERE employment_status = 'active')::int AS active_employees,
                    COUNT(*) FILTER (WHERE employment_status <> 'active')::int AS inactive_employees,
                    COUNT(DISTINCT org_unit_id)::int AS departments
               FROM directory.employees`,
          );

          const normalizedSearch = query.search.trim().toLowerCase();
          const countResult = await client.query<{ total: number }>(
            `SELECT COUNT(*)::int AS total
               FROM directory.employees AS employee
              WHERE $1 = ''
                 OR position($1 in lower(employee.display_name)) > 0
                 OR position($1 in lower(employee.work_email)) > 0
                 OR EXISTS (
                      SELECT 1 FROM directory.org_units AS org_unit
                       WHERE org_unit.id = employee.org_unit_id
                         AND position($1 in lower(org_unit.display_name)) > 0
                    )`,
            [normalizedSearch],
          );

          const offset = (query.page - 1) * query.pageSize;
          const employeesResult = await client.query<{
            id: string;
            display_name: string;
            work_email: string;
            department: string | null;
            employment_status: EmploymentStatus;
          }>(
            `SELECT employee.id::text AS id,
                    employee.display_name,
                    employee.work_email,
                    org_unit.display_name AS department,
                    employee.employment_status
               FROM directory.employees AS employee
               LEFT JOIN directory.org_units AS org_unit ON org_unit.id = employee.org_unit_id
              WHERE $1 = ''
                 OR position($1 in lower(employee.display_name)) > 0
                 OR position($1 in lower(employee.work_email)) > 0
                 OR position($1 in lower(COALESCE(org_unit.display_name, ''))) > 0
              ORDER BY lower(employee.display_name), employee.id
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
              workEmail: employee.work_email,
              department: employee.department,
              employmentStatus: employee.employment_status,
            })),
            page: query.page,
            pageSize: query.pageSize,
            total: countResult.rows[0]?.total ?? 0,
            summary: {
              totalEmployees: summary.total_employees,
              activeEmployees: summary.active_employees,
              inactiveEmployees: summary.inactive_employees,
              departments: summary.departments,
            },
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

      const existing = await client.query<{
        id: string;
        email: string;
        display_name: string;
        employment_status: EmploymentStatus;
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

        const membership = await client.query<{ group_id: string }>(
          `INSERT INTO iam.employee_groups (employee_id, group_id, source, reason)
           SELECT $1, id, 'system', 'Initial membership from verified Entra sign-in.'
             FROM iam.groups WHERE group_key = 'all-employees' AND status = 'active'
           RETURNING group_id`,
          [employeeId],
        );
        if (!membership.rowCount) {
          throw new Error("baseline_employee_group_missing");
        }

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
      employment_status: EmploymentStatus;
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
