import type { Pool, PoolClient } from "../../../node_modules/@types/pg/index.js";
import {
  type AttendanceRecordStatus,
  EmployeeRecordError,
  EmployeeLeaveRequestError,
  type EmployeeLeaveDecisionInput,
  type EmployeeLeaveManagementReport,
  type EmployeeLeaveRequest,
  type EmployeeLeaveRequestInput,
  type AttendanceDailyReport,
  type AttendanceMonthlyStatistics,
  type AttendanceRecordInput,
  type EmployeeActivityEntry,
  type EmployeeAttendanceRecord,
  type EmployeeTimesheetEntry,
  type EmployeeHrDetails,
  type EmployeeEducationHistoryEntry,
  type EmployeeEducationHistoryInput,
  type EmployeeMasterInput,
  type EmployeeMasterRecord,
  type TimesheetDailyReport,
  type TimesheetEntryInput,
  type EmploymentStatus,
  type EmploymentType,
} from "../../modules/directory/domain/employee.js";

interface EmployeeMasterRow {
  id: string;
  position_id: string | null;
  employee_number: string | null;
  display_name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  preferred_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  blood_type: EmployeeMasterRecord["bloodType"];
  marital_status: EmployeeMasterRecord["maritalStatus"];
  permanent_address: string | null;
  current_address: string | null;
  nationality: string | null;
  religion: string | null;
  personal_email: string | null;
  personal_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_email: string | null;
  emergency_contact_address: string | null;
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
  is_probationary: boolean | null;
  regularization_date: string | null;
  hire_date: string | null;
  termination_date: string | null;
  work_phone: string | null;
  work_location: string | null;
  updated_at: Date;
}

interface EmployeeEducationHistoryRow {
  id: string;
  education_level: string | null;
  institution: string | null;
  field_of_study: string | null;
  start_year: number | null;
  graduation_year: number | null;
}

interface EmployeeActivityRow {
  id: string;
  occurred_at: Date;
  actor_name: string | null;
  action: EmployeeActivityEntry["action"];
  changed_fields: unknown;
}

interface EmployeeFamilyMemberRow {
  relationship: "spouse" | "mother" | "father" | "child";
  child_number: number | null;
  first_name: string | null;
  middle_initial: string | null;
  last_name: string | null;
  gender: "female" | "male" | null;
  birth_date: string | null;
  nationality: string | null;
}

interface EmployeeAttendanceRow {
  id: string | null;
  employee_id: string;
  display_name: string;
  employee_number: string | null;
  work_email: string;
  department: string | null;
  job_title: string | null;
  work_schedule: string | null;
  status: AttendanceRecordStatus | null;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number | null;
  notes: string | null;
  hours_worked: number | null;
}

interface EmployeeLeaveRequestRow {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_number: string | null;
  department: string | null;
  leave_type: EmployeeLeaveRequest["leaveType"];
  start_date: string;
  end_date: string;
  requested_days: number | string;
  reason: string;
  status: EmployeeLeaveRequest["status"];
  decision_note: string | null;
  requested_at: Date;
  decided_at: Date | null;
  decided_by_name: string | null;
}

const employeeAttendanceSelect = [
  "SELECT record.id::text AS id, employee.id::text AS employee_id, employee.display_name,",
  "       employee.employee_number, employee.work_email, employee.department, employee.job_title,",
  "       attendance_details.work_schedule,",
  "       COALESCE(record.status, CASE WHEN employee.employment_status = 'on_leave' THEN 'on_leave' END) AS status,",
  "       to_char(merged.clock_in, 'HH24:MI') AS clock_in, to_char(merged.clock_out, 'HH24:MI') AS clock_out,",
  "       merged.break_minutes::int AS break_minutes, merged.notes,",
  "       CASE WHEN merged.clock_in IS NULL OR merged.clock_out IS NULL THEN NULL",
  "            ELSE GREATEST(0::numeric, ROUND((EXTRACT(EPOCH FROM (merged.clock_out - merged.clock_in +",
  "              CASE WHEN merged.clock_out < merged.clock_in THEN interval '24 hours' ELSE interval '0' END))",
  "              / 3600.0 - merged.break_minutes / 60.0)::numeric, 2))::double precision",
  "       END AS hours_worked",
  "  FROM huma.employees AS employee",
  "  LEFT JOIN huma.employee_attendance_records AS record",
  "    ON record.employee_id = employee.id AND record.attendance_date = $1::date",
  "  LEFT JOIN huma.employee_timesheet_entries AS timesheet",
  "    ON timesheet.employee_id = employee.id AND timesheet.work_date = $1::date",
  "  LEFT JOIN huma.employee_attendance_leave_details AS attendance_details",
  "    ON attendance_details.employee_id = employee.id",
  "  LEFT JOIN LATERAL (",
  "    SELECT CASE WHEN timesheet.id IS NOT NULL THEN timesheet.clock_in ELSE record.clock_in END AS clock_in,",
  "           CASE WHEN timesheet.id IS NOT NULL THEN timesheet.clock_out ELSE record.clock_out END AS clock_out,",
  "           CASE WHEN timesheet.id IS NOT NULL THEN COALESCE(timesheet.break_minutes, 0) ELSE COALESCE(record.break_minutes, 0) END AS break_minutes,",
  "           CASE WHEN timesheet.id IS NOT NULL THEN timesheet.notes ELSE record.notes END AS notes",
  "  ) AS merged ON TRUE",
].join("\n");

const employeeMasterSelect = [
  "SELECT employee.id::text AS id, employee.employee_number, employee.display_name,",
  "       employee.first_name, employee.middle_name, employee.last_name, employee.suffix,",
  "       employee.preferred_name, employee.gender, employee.date_of_birth::text AS date_of_birth,",
  "       employee.place_of_birth, employee.blood_type, employee.marital_status,",
  "       employee.permanent_address, employee.current_address,",
  "       employee.nationality, employee.religion,",
  "       employee.personal_email, employee.personal_phone,",
  "       employee.emergency_contact_name, employee.emergency_contact_relationship,",
  "       employee.emergency_contact_phone, employee.emergency_contact_email, employee.emergency_contact_address,",
  "       employee.education_level, employee.education_institution, employee.education_field,",
  "       employee.graduation_year, employee.work_email, COALESCE(role_department.display_name, employee.department) AS department,",
  "       manager.display_name AS manager_name, manager.work_email AS manager_work_email,",
  "       COALESCE(role_position.display_name, employee.job_title) AS job_title, employee.position_id::text AS position_id,",
  "       employee.employment_type, employee.employment_status,",
  "       employee.is_probationary, employee.regularization_date::text AS regularization_date,",
  "       employee.hire_date::text, employee.termination_date::text,",
  "       employee.work_phone, employee.work_location, employee.updated_at",
  "  FROM huma.employees AS employee",
  "  LEFT JOIN huma.employees AS manager ON manager.id = employee.manager_employee_id",
  "  LEFT JOIN directory.org_units AS role_position ON role_position.id = employee.position_id AND role_position.source = 'eris' AND role_position.unit_type = 'position'",
  "  LEFT JOIN directory.org_units AS role_department ON role_department.id = role_position.parent_id",
].join("\n");

const employeeLeaveRequestSelect = [
  "SELECT request.id::text AS id, employee.id::text AS employee_id, employee.display_name AS employee_name,",
  "       employee.employee_number, employee.department, request.leave_type,",
  "       request.start_date::text, request.end_date::text, request.requested_days, request.reason,",
  "       request.status, request.decision_note, request.requested_at, request.decided_at,",
  "       decision_maker.display_name AS decided_by_name",
  "  FROM huma.employee_leave_requests AS request",
  "  JOIN huma.employees AS employee ON employee.id = request.employee_id",
  "  LEFT JOIN directory.employees AS decision_maker ON decision_maker.id = request.decided_by_employee_id",
].join("\n");

export class EmployeeMasterRepository {
  constructor(protected readonly pool: Pool) {}

  async getAttendanceReport(
    date: string,
    search: string,
    requestedByEmployeeId: string,
  ): Promise<AttendanceDailyReport> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.read");
      const normalizedSearch = search.trim().toLowerCase();
      const result = await client.query<EmployeeAttendanceRow>(
        [
          employeeAttendanceSelect,
          " WHERE employee.employment_status IN ('active', 'on_leave')",
          "   AND (employee.hire_date IS NULL OR employee.hire_date <= $1::date)",
          "   AND (employee.termination_date IS NULL OR employee.termination_date >= $1::date)",
          "   AND ($2 = '' OR position($2 in lower(employee.display_name)) > 0",
          "        OR position($2 in lower(employee.work_email)) > 0",
          "        OR position($2 in lower(COALESCE(employee.employee_number, ''))) > 0",
          "        OR position($2 in lower(COALESCE(employee.department, ''))) > 0",
          "        OR position($2 in lower(COALESCE(employee.job_title, ''))) > 0)",
          " ORDER BY lower(employee.department) NULLS LAST, lower(employee.display_name), employee.id",
        ].join("\n"),
        [date, normalizedSearch],
      );
      await client.query(
        [
          "INSERT INTO audit.events",
          "  (actor_type, actor_employee_id, action, outcome, target_type, target_id, source, details)",
          "VALUES ('employee', $1, 'eris.attendance.read', 'success', 'attendance_day', $2, 'eris', $3::jsonb)",
        ].join("\n"),
        [requestedByEmployeeId, date, JSON.stringify({ resultCount: result.rowCount ?? 0 })],
      );
      await client.query("COMMIT");

      const items = result.rows.map(toEmployeeAttendanceRecord);
      const summaryStatuses = items.map((item) =>
        statusFromClockTimes(item.status, item.clockIn, item.workSchedule),
      );
      return {
        date,
        summary: {
          employeeCount: items.length,
          recordedCount: items.filter((item) =>
            item.id !== null || item.clockIn !== null || item.clockOut !== null,
          ).length,
          presentCount: summaryStatuses.filter((status) => status === "present").length,
          lateCount: summaryStatuses.filter((status) => status === "late").length,
          absentCount: summaryStatuses.filter((status) => status === "absent").length,
          onLeaveCount: summaryStatuses.filter((status) =>
            [
              "on_leave",
              "sick_leave",
              "half_day_sick_leave",
              "vacation_leave",
              "half_day_vacation_leave",
              "nuptial",
              "bereavement",
            ].includes(status ?? ""),
          ).length,
        },
        items,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getAttendanceMonthlyStatistics(
    year: number,
    requestedByEmployeeId: string,
  ): Promise<AttendanceMonthlyStatistics> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.read");
      const result = await client.query<{
        month: number;
        average_clock_in: string | null;
        average_clock_out: string | null;
      }>(
        [
          "WITH months AS (SELECT generate_series(1, 12)::int AS month),",
          "attendance_times AS (",
          "  SELECT record.attendance_date AS work_date, record.clock_in, record.clock_out",
          "    FROM huma.employee_attendance_records AS record",
          "   WHERE record.attendance_date >= make_date($1::int, 1, 1)",
          "     AND record.attendance_date < make_date($1::int + 1, 1, 1)",
          "     AND NOT EXISTS (SELECT 1 FROM huma.employee_timesheet_entries AS entry",
          "                      WHERE entry.employee_id = record.employee_id AND entry.work_date = record.attendance_date)",
          "  UNION ALL",
          "  SELECT entry.work_date, entry.clock_in, entry.clock_out",
          "    FROM huma.employee_timesheet_entries AS entry",
          "   WHERE entry.work_date >= make_date($1::int, 1, 1)",
          "     AND entry.work_date < make_date($1::int + 1, 1, 1)",
          "),",
          "monthly_averages AS (",
          "  SELECT EXTRACT(MONTH FROM work_date)::int AS month,",
          "         AVG(EXTRACT(HOUR FROM clock_in) * 60 + EXTRACT(MINUTE FROM clock_in)) AS average_clock_in,",
          "         AVG(EXTRACT(HOUR FROM clock_out) * 60 + EXTRACT(MINUTE FROM clock_out)) AS average_clock_out",
          "    FROM attendance_times",
          "   GROUP BY EXTRACT(MONTH FROM work_date)",
          ")",
          "SELECT months.month, monthly_averages.average_clock_in::text,",
          "       monthly_averages.average_clock_out::text",
          "  FROM months LEFT JOIN monthly_averages USING (month)",
          " ORDER BY months.month",
        ].join("\n"),
        [year],
      );
      await client.query(
        [
          "INSERT INTO audit.events",
          "  (actor_type, actor_employee_id, action, outcome, target_type, target_id, source, details)",
          "VALUES ('employee', $1, 'eris.attendance_statistics.read', 'success', 'attendance_year', $2, 'eris', $3::jsonb)",
        ].join("\n"),
        [requestedByEmployeeId, String(year), JSON.stringify({ monthCount: result.rowCount ?? 0 })],
      );
      await client.query("COMMIT");

      return {
        year,
        months: result.rows.map((row) => ({
          month: Number(row.month),
          averageClockIn:
            row.average_clock_in === null ? null : Number(row.average_clock_in),
          averageClockOut:
            row.average_clock_out === null ? null : Number(row.average_clock_out),
        })),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getTimesheetReport(
    date: string,
    requestedByEmployeeId: string,
  ): Promise<TimesheetDailyReport> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.read");
      const result = await client.query<{
        id: string | null;
        employee_id: string;
        display_name: string;
        employee_number: string | null;
        department: string | null;
        job_title: string | null;
        clock_in: string | null;
        clock_out: string | null;
        regular_hours: string | number;
        overtime_hours: string | number;
        break_minutes: number;
        notes: string | null;
      }>(
        [
          "SELECT entry.id::text, employee.id::text AS employee_id, employee.display_name,",
          "       employee.employee_number, employee.department, employee.job_title,",
          "       to_char(entry.clock_in, 'HH24:MI') AS clock_in,",
          "       to_char(entry.clock_out, 'HH24:MI') AS clock_out,",
          "       COALESCE(entry.regular_hours, 0)::text AS regular_hours,",
          "       COALESCE(entry.overtime_hours, 0)::text AS overtime_hours,",
          "       COALESCE(entry.break_minutes, 0)::int AS break_minutes, entry.notes",
          "  FROM huma.employees AS employee",
          "  LEFT JOIN huma.employee_timesheet_entries AS entry",
          "    ON entry.employee_id = employee.id AND entry.work_date = $1::date",
          " WHERE employee.employment_status IN ('active', 'on_leave')",
          "   AND (employee.hire_date IS NULL OR employee.hire_date <= $1::date)",
          "   AND (employee.termination_date IS NULL OR employee.termination_date >= $1::date)",
          " ORDER BY lower(employee.department) NULLS LAST, lower(employee.display_name), employee.id",
        ].join("\n"),
        [date],
      );
      await client.query(
        [
          "INSERT INTO audit.events",
          "  (actor_type, actor_employee_id, action, outcome, target_type, target_id, source, details)",
          "VALUES ('employee', $1, 'eris.timesheet.read', 'success', 'timesheet_day', $2, 'eris', $3::jsonb)",
        ].join("\n"),
        [requestedByEmployeeId, date, JSON.stringify({ resultCount: result.rowCount ?? 0 })],
      );
      await client.query("COMMIT");

      return {
        date,
        items: result.rows.map((row) => ({
          id: row.id,
          employeeId: row.employee_id,
          employeeName: row.display_name,
          employeeNumber: row.employee_number,
          department: row.department,
          jobTitle: row.job_title,
          clockIn: row.clock_in,
          clockOut: row.clock_out,
          regularHours: Number(row.regular_hours),
          overtimeHours: Number(row.overtime_hours),
          breakMinutes: row.break_minutes,
          notes: row.notes,
        })),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveTimesheetEntry(
    employeeId: string,
    date: string,
    input: TimesheetEntryInput,
    requestedByEmployeeId: string,
  ): Promise<EmployeeTimesheetEntry> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.read");
      const employee = await client.query<{
        id: string;
        display_name: string;
        employee_number: string | null;
        department: string | null;
        job_title: string | null;
      }>(
        [
          "SELECT id::text, display_name, employee_number, department, job_title",
          "  FROM huma.employees",
          " WHERE id = $1 AND employment_status IN ('active', 'on_leave')",
          "   AND (hire_date IS NULL OR hire_date <= $2::date)",
          "   AND (termination_date IS NULL OR termination_date >= $2::date)",
          " FOR UPDATE",
        ].join("\n"),
        [employeeId, date],
      );
      const employeeRow = employee.rows[0];
      if (!employeeRow) throw new EmployeeRecordError("not_found");

      const current = await client.query<{
        id: string;
        clock_in: string | null;
        clock_out: string | null;
        regular_hours: string | number;
        overtime_hours: string | number;
        break_minutes: number;
        notes: string | null;
      }>(
        [
          "SELECT id::text, to_char(clock_in, 'HH24:MI') AS clock_in,",
          "       to_char(clock_out, 'HH24:MI') AS clock_out,",
          "       regular_hours::text, overtime_hours::text, break_minutes, notes",
          "  FROM huma.employee_timesheet_entries",
          " WHERE employee_id = $1 AND work_date = $2::date",
          " FOR UPDATE",
        ].join("\n"),
        [employeeId, date],
      );
      const previous = current.rows[0];
      const changedFields: string[] = [];
      if (!previous || previous.clock_in !== input.clockIn) changedFields.push("clockIn");
      if (!previous || previous.clock_out !== input.clockOut) changedFields.push("clockOut");
      if (!previous || Number(previous.regular_hours) !== input.regularHours) changedFields.push("regularHours");
      if (!previous || Number(previous.overtime_hours) !== input.overtimeHours) changedFields.push("overtimeHours");
      if (!previous || previous.break_minutes !== input.breakMinutes) changedFields.push("breakMinutes");
      if (!previous || previous.notes !== input.notes) changedFields.push("timesheetNotes");

      const saved = await client.query<{ id: string }>(
        [
          "INSERT INTO huma.employee_timesheet_entries",
          "  (employee_id, work_date, clock_in, clock_out, regular_hours, overtime_hours, break_minutes, notes, created_by_employee_id, updated_by_employee_id, updated_at)",
          "VALUES ($1, $2::date, $3::time, $4::time, $5, $6, $7, $8, $9, $9, now())",
          "ON CONFLICT (employee_id, work_date) DO UPDATE SET",
          "  clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out,",
          "  regular_hours = EXCLUDED.regular_hours, overtime_hours = EXCLUDED.overtime_hours,",
          "  break_minutes = EXCLUDED.break_minutes, notes = EXCLUDED.notes,",
          "  updated_by_employee_id = EXCLUDED.updated_by_employee_id, updated_at = now()",
          "RETURNING id::text",
        ].join("\n"),
        [
          employeeId,
          date,
          input.clockIn,
          input.clockOut,
          input.regularHours,
          input.overtimeHours,
          input.breakMinutes,
          input.notes,
          requestedByEmployeeId,
        ],
      );
      if (changedFields.length > 0) {
        await auditEmployeeChange(
          client,
          requestedByEmployeeId,
          employeeId,
          "eris.timesheet_entry.update",
          changedFields,
        );
      }
      await client.query("COMMIT");

      return {
        id: saved.rows[0]!.id,
        employeeId: employeeRow.id,
        employeeName: employeeRow.display_name,
        employeeNumber: employeeRow.employee_number,
        department: employeeRow.department,
        jobTitle: employeeRow.job_title,
        ...input,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateAttendanceRecord(
    employeeId: string,
    date: string,
    input: AttendanceRecordInput,
    requestedByEmployeeId: string,
  ): Promise<EmployeeAttendanceRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.read");
      const employee = await client.query<{
        id: string;
        display_name: string;
        employee_number: string | null;
        work_email: string;
        department: string | null;
        job_title: string | null;
      }>(
        [
          "SELECT id::text, display_name, employee_number, work_email, department, job_title",
          "  FROM huma.employees",
          " WHERE id = $1 AND employment_status IN ('active', 'on_leave')",
          "   AND (hire_date IS NULL OR hire_date <= $2::date)",
          "   AND (termination_date IS NULL OR termination_date >= $2::date)",
          " FOR UPDATE",
        ].join("\n"),
        [employeeId, date],
      );
      const employeeRow = employee.rows[0];
      if (!employeeRow) throw new EmployeeRecordError("not_found");
      const schedule = await client.query<{ work_schedule: string | null }>(
        "SELECT work_schedule FROM huma.employee_attendance_leave_details WHERE employee_id = $1",
        [employeeId],
      );

      const current = await client.query<{
        id: string;
        status: AttendanceRecordStatus;
        clock_in: string | null;
        clock_out: string | null;
        break_minutes: number;
        notes: string | null;
      }>(
        [
          "SELECT id::text, status, to_char(clock_in, 'HH24:MI') AS clock_in,",
          "       to_char(clock_out, 'HH24:MI') AS clock_out, break_minutes, notes",
          "  FROM huma.employee_attendance_records",
          " WHERE employee_id = $1 AND attendance_date = $2::date",
          " FOR UPDATE",
        ].join("\n"),
        [employeeId, date],
      );
      const previous = current.rows[0];
      const changedFields: string[] = [];
      if (!previous || previous.status !== input.status) changedFields.push("attendanceStatus");
      if (!previous || previous.clock_in !== input.clockIn) changedFields.push("clockIn");
      if (!previous || previous.clock_out !== input.clockOut) changedFields.push("clockOut");
      if (!previous || previous.break_minutes !== input.breakMinutes) changedFields.push("breakMinutes");
      if (!previous || previous.notes !== input.notes) changedFields.push("attendanceNotes");

      const saved = await client.query<{ id: string }>(
        [
          "INSERT INTO huma.employee_attendance_records",
          "  (employee_id, attendance_date, status, clock_in, clock_out, break_minutes, notes, created_by_employee_id, updated_by_employee_id, updated_at)",
          "VALUES ($1, $2::date, $3, $4::time, $5::time, $6, $7, $8, $8, now())",
          "ON CONFLICT (employee_id, attendance_date) DO UPDATE SET",
          "  status = EXCLUDED.status, clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out,",
          "  break_minutes = EXCLUDED.break_minutes, notes = EXCLUDED.notes,",
          "  updated_by_employee_id = EXCLUDED.updated_by_employee_id, updated_at = now()",
          "RETURNING id::text",
        ].join("\n"),
        [employeeId, date, input.status, input.clockIn, input.clockOut, input.breakMinutes, input.notes, requestedByEmployeeId],
      );
      if (changedFields.length > 0) {
        await auditEmployeeChange(client, requestedByEmployeeId, employeeId, "eris.attendance_record.update", changedFields);
      }
      await client.query("COMMIT");

      return {
        id: saved.rows[0]!.id,
        employeeId: employeeRow.id,
        displayName: employeeRow.display_name,
        employeeNumber: employeeRow.employee_number,
        workEmail: employeeRow.work_email,
        department: employeeRow.department,
        jobTitle: employeeRow.job_title,
        workSchedule: schedule.rows[0]?.work_schedule ?? null,
        status: input.status,
        clockIn: input.clockIn,
        clockOut: input.clockOut,
        breakMinutes: input.breakMinutes,
        notes: input.notes,
        hoursWorked: calculateAttendanceHours(input.clockIn, input.clockOut, input.breakMinutes),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getLeaveManagementReport(requestedByEmployeeId: string): Promise<EmployeeLeaveManagementReport> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.read");
      const summary = await client.query<{
        pending_count: number;
        approved_count: number;
        rejected_count: number;
        on_leave_today_count: number;
      }>(
        [
          "SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,",
          "       COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_count,",
          "       COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_count,",
          "       COUNT(DISTINCT employee_id) FILTER (WHERE status = 'approved'",
          "         AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE)::int AS on_leave_today_count",
          "  FROM huma.employee_leave_requests",
        ].join("\n"),
      );
      const requests = await client.query<EmployeeLeaveRequestRow>(
        [
          employeeLeaveRequestSelect,
          " ORDER BY CASE request.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,",
          "          request.start_date DESC, request.requested_at DESC",
        ].join("\n"),
      );
      await client.query(
        [
          "INSERT INTO audit.events",
          "  (actor_type, actor_employee_id, action, outcome, target_type, target_id, source, details)",
          "VALUES ('employee', $1, 'eris.leave_requests.read', 'success', 'leave_management', $1, 'eris', $2::jsonb)",
        ].join("\n"),
        [requestedByEmployeeId, JSON.stringify({ resultCount: requests.rowCount ?? 0 })],
      );
      await client.query("COMMIT");
      const counts = summary.rows[0]!;
      return {
        summary: {
          pendingCount: counts.pending_count,
          approvedCount: counts.approved_count,
          rejectedCount: counts.rejected_count,
          onLeaveTodayCount: counts.on_leave_today_count,
        },
        items: requests.rows.map(toEmployeeLeaveRequest),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async createLeaveRequest(
    input: EmployeeLeaveRequestInput,
    requestedByEmployeeId: string,
  ): Promise<EmployeeLeaveRequest> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.read");
      const employee = await client.query<{ id: string }>(
        "SELECT id::text FROM huma.employees WHERE id = $1 AND employment_status IN ('active', 'on_leave') FOR UPDATE",
        [input.employeeId],
      );
      if (!employee.rows[0]) throw new EmployeeRecordError("not_found");

      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('employee_leave:' || $1::text, 0))",
        [input.employeeId],
      );
      const overlap = await client.query<{ exists: boolean }>(
        [
          "SELECT EXISTS (SELECT 1 FROM huma.employee_leave_requests",
          " WHERE employee_id = $1 AND status IN ('pending', 'approved')",
          "   AND start_date <= $3::date AND end_date >= $2::date) AS exists",
        ].join("\n"),
        [input.employeeId, input.startDate, input.endDate],
      );
      if (overlap.rows[0]?.exists) throw new EmployeeLeaveRequestError("overlap");

      const created = await client.query<{ id: string }>(
        [
          "INSERT INTO huma.employee_leave_requests",
          "  (employee_id, leave_type, start_date, end_date, requested_days, reason, requested_by_employee_id)",
          "VALUES ($1, $2, $3::date, $4::date, $5, $6, $7)",
          "RETURNING id::text",
        ].join("\n"),
        [input.employeeId, input.leaveType, input.startDate, input.endDate, input.requestedDays, input.reason, requestedByEmployeeId],
      );
      await auditEmployeeChange(client, requestedByEmployeeId, input.employeeId, "eris.leave_request.create", [
        "leaveType", "startDate", "endDate", "requestedDays", "reason",
      ]);
      const saved = await client.query<EmployeeLeaveRequestRow>(
        employeeLeaveRequestSelect + " WHERE request.id = $1",
        [created.rows[0]!.id],
      );
      await client.query("COMMIT");
      return toEmployeeLeaveRequest(saved.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async decideLeaveRequest(
    requestId: string,
    input: EmployeeLeaveDecisionInput,
    requestedByEmployeeId: string,
  ): Promise<EmployeeLeaveRequest> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.read");
      const current = await client.query<{ employee_id: string; status: EmployeeLeaveRequest["status"] }>(
        "SELECT employee_id::text, status FROM huma.employee_leave_requests WHERE id = $1 FOR UPDATE",
        [requestId],
      );
      const currentRequest = current.rows[0];
      if (!currentRequest) throw new EmployeeRecordError("not_found");
      if (currentRequest.status !== "pending") throw new EmployeeLeaveRequestError("not_pending");

      await client.query(
        [
          "UPDATE huma.employee_leave_requests",
          "   SET status = $2, decision_note = $3, decided_by_employee_id = $4, decided_at = now(), updated_at = now()",
          " WHERE id = $1",
        ].join("\n"),
        [requestId, input.status, input.decisionNote, requestedByEmployeeId],
      );
      await auditEmployeeChange(client, requestedByEmployeeId, currentRequest.employee_id, "eris.leave_request.decide", [
        "leaveRequestStatus", "decisionNote",
      ]);
      const saved = await client.query<EmployeeLeaveRequestRow>(
        employeeLeaveRequestSelect + " WHERE request.id = $1",
        [requestId],
      );
      await client.query("COMMIT");
      return toEmployeeLeaveRequest(saved.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

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
      const educationHistory = await loadEducationHistory(client, employeeId);
      await client.query("COMMIT");
      return toEmployeeMaster(row, educationHistory);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getEmployeeActivity(
    employeeId: string,
    requestedByEmployeeId: string,
  ): Promise<EmployeeActivityEntry[]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.read");
      const employee = await client.query("SELECT 1 FROM huma.employees WHERE id = $1", [employeeId]);
      if (!employee.rows[0]) throw new EmployeeRecordError("not_found");

      const result = await client.query<EmployeeActivityRow>(
        [
          "SELECT event.id::text AS id, event.occurred_at, actor.display_name AS actor_name,",
          "       CASE event.action",
          "         WHEN 'eris.employee_record.create' THEN 'created'",
          "         ELSE 'updated'",
          "       END AS action,",
          "       event.details -> 'changedFields' AS changed_fields",
          "  FROM audit.events AS event",
          "  LEFT JOIN directory.employees AS actor ON actor.id = event.actor_employee_id",
          " WHERE event.target_type = 'employee' AND event.target_id = $1",
          "   AND event.action IN (",
          "     'eris.employee_record.create', 'eris.employee_record.update',",
          "     'eris.employee_hr_details.update'",
          "   )",
          "   AND event.outcome = 'success'",
          " ORDER BY event.occurred_at DESC",
          " LIMIT 50",
        ].join("\n"),
        [employeeId],
      );
      await client.query("COMMIT");
      return result.rows.map((entry) => ({
        id: entry.id,
        occurredAt: entry.occurred_at.toISOString(),
        actorName: entry.actor_name,
        action: entry.action,
        changedFields: Array.isArray(entry.changed_fields)
          ? entry.changed_fields.filter((field): field is string => typeof field === "string")
          : [],
      }));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getEmployeeHrDetails(
    employeeId: string,
    requestedByEmployeeId: string,
  ): Promise<EmployeeHrDetails> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.read");
      await requireHrisEmployee(client, employeeId);
      const details = await loadEmployeeHrDetails(client, employeeId);
      await client.query(
        [
          "INSERT INTO audit.events",
          "  (actor_type, actor_employee_id, action, outcome, target_type, target_id, source)",
          "VALUES ('employee', $1, 'eris.employee_hr_details.read', 'success', 'employee', $2, 'eris')",
        ].join("\n"),
        [requestedByEmployeeId, employeeId],
      );
      await client.query("COMMIT");
      return details;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateEmployeeHrDetails(
    employeeId: string,
    details: EmployeeHrDetails,
    requestedByEmployeeId: string,
  ): Promise<EmployeeHrDetails> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await requireEmployeePermission(client, requestedByEmployeeId, "hris.employee.read");
      await requireHrisEmployee(client, employeeId);

      await client.query(
        [
          "INSERT INTO huma.employee_attendance_leave_details",
          "  (employee_id, work_schedule, weekly_hours, annual_leave_entitlement_days, annual_leave_used_days, updated_by_employee_id, updated_at)",
          "VALUES ($1, $2, $3, $4, $5, $6, now())",
          "ON CONFLICT (employee_id) DO UPDATE SET",
          "  work_schedule = EXCLUDED.work_schedule, weekly_hours = EXCLUDED.weekly_hours,",
          "  annual_leave_entitlement_days = EXCLUDED.annual_leave_entitlement_days,",
          "  annual_leave_used_days = EXCLUDED.annual_leave_used_days,",
          "  updated_by_employee_id = EXCLUDED.updated_by_employee_id, updated_at = now()",
        ].join("\n"),
        [
          employeeId,
          details.attendanceAndLeave.workSchedule,
          details.attendanceAndLeave.weeklyHours,
          details.attendanceAndLeave.annualLeaveEntitlementDays,
          details.attendanceAndLeave.annualLeaveUsedDays,
          requestedByEmployeeId,
        ],
      );
      await client.query(
        [
          "INSERT INTO huma.employee_payroll_details",
          "  (employee_id, base_salary, currency, pay_frequency, pay_grade, tax_id, sss_number, philhealth_number, pagibig_number, updated_by_employee_id, updated_at)",
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())",
          "ON CONFLICT (employee_id) DO UPDATE SET",
          "  base_salary = EXCLUDED.base_salary, currency = EXCLUDED.currency, pay_frequency = EXCLUDED.pay_frequency,",
          "  pay_grade = EXCLUDED.pay_grade, tax_id = EXCLUDED.tax_id, sss_number = EXCLUDED.sss_number,",
          "  philhealth_number = EXCLUDED.philhealth_number, pagibig_number = EXCLUDED.pagibig_number,",
          "  updated_by_employee_id = EXCLUDED.updated_by_employee_id, updated_at = now()",
        ].join("\n"),
        [
          employeeId,
          details.payroll.baseSalary,
          details.payroll.currency,
          details.payroll.payFrequency,
          details.payroll.payGrade,
          details.payroll.taxId,
          details.payroll.sssNumber,
          details.payroll.philhealthNumber,
          details.payroll.pagibigNumber,
          requestedByEmployeeId,
        ],
      );
      await client.query(
        [
          "INSERT INTO huma.employee_medical_details",
          "  (employee_id, allergies, medical_conditions, current_medications, health_insurance_provider, health_insurance_policy_number, updated_by_employee_id, updated_at)",
          "VALUES ($1, $2, $3, $4, $5, $6, $7, now())",
          "ON CONFLICT (employee_id) DO UPDATE SET",
          "  allergies = EXCLUDED.allergies, medical_conditions = EXCLUDED.medical_conditions,",
          "  current_medications = EXCLUDED.current_medications,",
          "  health_insurance_provider = EXCLUDED.health_insurance_provider,",
          "  health_insurance_policy_number = EXCLUDED.health_insurance_policy_number,",
          "  updated_by_employee_id = EXCLUDED.updated_by_employee_id, updated_at = now()",
        ].join("\n"),
        [
          employeeId,
          details.medical.allergies,
          details.medical.medicalConditions,
          details.medical.currentMedications,
          details.medical.healthInsuranceProvider,
          details.medical.healthInsurancePolicyNumber,
          requestedByEmployeeId,
        ],
      );
      await replaceEmployeeFamilyMembers(client, employeeId, details.family);
      await auditEmployeeChange(client, requestedByEmployeeId, employeeId, "eris.employee_hr_details.update", [
        "workSchedule",
        "weeklyHours",
        "annualLeaveEntitlementDays",
        "annualLeaveUsedDays",
        "baseSalary",
        "currency",
        "payFrequency",
        "payGrade",
        "taxId",
        "sssNumber",
        "philhealthNumber",
        "pagibigNumber",
        "allergies",
        "medicalConditions",
        "currentMedications",
        "healthInsuranceProvider",
        "healthInsurancePolicyNumber",
        "familyDetails",
      ]);

      const updated = await loadEmployeeHrDetails(client, employeeId);
      await client.query("COMMIT");
      return updated;
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
      const organizationPosition = await resolveOrganizationPosition(client, input.positionId);
      const department = organizationPosition?.departmentName ?? input.department;
      const jobTitle = organizationPosition?.name ?? input.jobTitle;
      const displayName = composeDisplayName(input);
      const inserted = await client.query<{ id: string }>(
        [
          "INSERT INTO huma.employees",
          "  (employee_number, first_name, middle_name, last_name, suffix, display_name, preferred_name,",
          "   personal_email, personal_phone, education_level, education_institution, education_field, graduation_year,",
          "   work_email, department, manager_employee_id, job_title, employment_type,",
          "   employment_status, hire_date, termination_date, is_probationary, regularization_date, work_phone, work_location,",
          "   gender, date_of_birth, place_of_birth, blood_type, marital_status, permanent_address, current_address,",
          "   emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_email,",
          "   nationality, religion, emergency_contact_address, position_id,",
          "   created_by_employee_id, updated_by_employee_id)",
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $41)",
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
          department,
          managerId,
          jobTitle,
          input.employmentType,
          input.employmentStatus,
          input.hireDate,
          input.terminationDate,
          input.isProbationary,
          input.regularizationDate,
          input.workPhone,
          input.workLocation,
          input.gender,
          input.dateOfBirth,
          input.placeOfBirth,
          input.bloodType,
          input.maritalStatus,
          input.permanentAddress,
          input.currentAddress,
          input.emergencyContactName,
          input.emergencyContactRelationship,
          input.emergencyContactPhone,
          input.emergencyContactEmail,
          input.nationality,
          input.religion,
          input.emergencyContactAddress,
          input.positionId,
          requestedByEmployeeId,
        ],
      );
      const employeeId = inserted.rows[0]!.id;
      await replaceEducationHistory(client, employeeId, input);
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
      const educationHistory = await loadEducationHistory(client, employeeId);
      await client.query("COMMIT");
      return toEmployeeMaster(record.rows[0]!, educationHistory);
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
      const current = await client.query<{ id: string }>(
        "SELECT id::text AS id FROM huma.employees WHERE id = $1 FOR UPDATE",
        [employeeId],
      );
      if (!current.rowCount) throw new EmployeeRecordError("not_found");
      await lockEmployeeIdentifiers(client, input);
      await ensureUniqueEmployeeEmail(client, input.workEmail, employeeId);
      await ensureUniqueEmployeeNumber(client, input.employeeNumber, employeeId);
      const managerId = await resolveManager(client, input.managerWorkEmail, employeeId);
      const organizationPosition = await resolveOrganizationPosition(client, input.positionId);
      const department = organizationPosition?.departmentName ?? input.department;
      const jobTitle = organizationPosition?.name ?? input.jobTitle;
      const displayName = composeDisplayName(input);
      await client.query(
        [
          "UPDATE huma.employees",
          "   SET employee_number = $1, first_name = $2, middle_name = $3, last_name = $4, suffix = $5,",
          "       display_name = $6, preferred_name = $7, personal_email = $8, personal_phone = $9,",
          "       education_level = $10, education_institution = $11, education_field = $12, graduation_year = $13,",
          "       work_email = $14, department = $15, manager_employee_id = $16, job_title = $17,",
          "       employment_type = $18, employment_status = $19, hire_date = $20, termination_date = $21,",
          "       is_probationary = $22, regularization_date = $23, work_phone = $24, work_location = $25,",
          "       gender = $26, date_of_birth = $27, place_of_birth = $28, blood_type = $29, marital_status = $30,",
          "       permanent_address = $31, current_address = $32, emergency_contact_name = $33,",
          "       emergency_contact_relationship = $34, emergency_contact_phone = $35, emergency_contact_email = $36,",
          "       nationality = $37, religion = $38, emergency_contact_address = $39, position_id = $40,",
          "       updated_by_employee_id = $41, updated_at = now()",
          " WHERE id = $42",
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
          department,
          managerId,
          jobTitle,
          input.employmentType,
          input.employmentStatus,
          input.hireDate,
          input.terminationDate,
          input.isProbationary,
          input.regularizationDate,
          input.workPhone,
          input.workLocation,
          input.gender,
          input.dateOfBirth,
          input.placeOfBirth,
          input.bloodType,
          input.maritalStatus,
          input.permanentAddress,
          input.currentAddress,
          input.emergencyContactName,
          input.emergencyContactRelationship,
          input.emergencyContactPhone,
          input.emergencyContactEmail,
          input.nationality,
          input.religion,
          input.emergencyContactAddress,
          input.positionId,
          requestedByEmployeeId,
          employeeId,
        ],
      );
      await replaceEducationHistory(client, employeeId, input);
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
      const educationHistory = await loadEducationHistory(client, employeeId);
      await client.query("COMMIT");
      return toEmployeeMaster(record.rows[0]!, educationHistory);
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

async function requireHrisEmployee(client: PoolClient, employeeId: string): Promise<void> {
  const employee = await client.query("SELECT 1 FROM huma.employees WHERE id = $1", [employeeId]);
  if (!employee.rows[0]) throw new EmployeeRecordError("not_found");
}

async function loadEmployeeHrDetails(
  client: PoolClient,
  employeeId: string,
): Promise<EmployeeHrDetails> {
  const attendance = await client.query<{
    work_schedule: string | null;
    weekly_hours: string | null;
    annual_leave_entitlement_days: string | null;
    annual_leave_used_days: string | null;
  }>(
    [
      "SELECT work_schedule, weekly_hours::text, annual_leave_entitlement_days::text, annual_leave_used_days::text",
      "  FROM huma.employee_attendance_leave_details WHERE employee_id = $1",
    ].join("\n"),
    [employeeId],
  );
  const payroll = await client.query<{
    base_salary: string | null;
    currency: string | null;
    pay_frequency: EmployeeHrDetails["payroll"]["payFrequency"];
    pay_grade: string | null;
    tax_id: string | null;
    sss_number: string | null;
    philhealth_number: string | null;
    pagibig_number: string | null;
  }>(
    [
      "SELECT base_salary::text, currency, pay_frequency, pay_grade, tax_id, sss_number, philhealth_number, pagibig_number",
      "  FROM huma.employee_payroll_details WHERE employee_id = $1",
    ].join("\n"),
    [employeeId],
  );
  const medical = await client.query<{
    allergies: string | null;
    medical_conditions: string | null;
    current_medications: string | null;
    health_insurance_provider: string | null;
    health_insurance_policy_number: string | null;
  }>(
    [
      "SELECT allergies, medical_conditions, current_medications, health_insurance_provider, health_insurance_policy_number",
      "  FROM huma.employee_medical_details WHERE employee_id = $1",
    ].join("\n"),
    [employeeId],
  );
  const family = await client.query<EmployeeFamilyMemberRow>(
    [
      "SELECT relationship, child_number::int, first_name, middle_initial, last_name, gender,",
      "       birth_date::text AS birth_date, nationality",
      "  FROM huma.employee_family_members WHERE employee_id = $1",
      " ORDER BY relationship, child_number NULLS FIRST",
    ].join("\n"),
    [employeeId],
  );
  const attendanceRow = attendance.rows[0];
  const payrollRow = payroll.rows[0];
  const medicalRow = medical.rows[0];
  const familyPersonFor = (relationship: EmployeeFamilyMemberRow["relationship"], childNumber?: number) => {
    const member = family.rows.find((row) =>
      row.relationship === relationship && (relationship !== "child" || row.child_number === childNumber),
    );
    return {
      firstName: member?.first_name ?? null,
      middleInitial: member?.middle_initial ?? null,
      lastName: member?.last_name ?? null,
      birthDate: member?.birth_date ?? null,
      nationality: member?.nationality ?? null,
    };
  };

  return {
    attendanceAndLeave: {
      workSchedule: attendanceRow?.work_schedule ?? null,
      weeklyHours: attendanceRow?.weekly_hours === null || attendanceRow?.weekly_hours === undefined
        ? null
        : Number(attendanceRow.weekly_hours),
      annualLeaveEntitlementDays: attendanceRow?.annual_leave_entitlement_days === null || attendanceRow?.annual_leave_entitlement_days === undefined
        ? null
        : Number(attendanceRow.annual_leave_entitlement_days),
      annualLeaveUsedDays: attendanceRow?.annual_leave_used_days === null || attendanceRow?.annual_leave_used_days === undefined
        ? null
        : Number(attendanceRow.annual_leave_used_days),
    },
    payroll: {
      baseSalary: payrollRow?.base_salary ?? null,
      currency: payrollRow?.currency ?? null,
      payFrequency: payrollRow?.pay_frequency ?? null,
      payGrade: payrollRow?.pay_grade ?? null,
      taxId: payrollRow?.tax_id ?? null,
      sssNumber: payrollRow?.sss_number ?? null,
      philhealthNumber: payrollRow?.philhealth_number ?? null,
      pagibigNumber: payrollRow?.pagibig_number ?? null,
    },
    medical: {
      allergies: medicalRow?.allergies ?? null,
      medicalConditions: medicalRow?.medical_conditions ?? null,
      currentMedications: medicalRow?.current_medications ?? null,
      healthInsuranceProvider: medicalRow?.health_insurance_provider ?? null,
      healthInsurancePolicyNumber: medicalRow?.health_insurance_policy_number ?? null,
    },
    family: {
      spouse: familyPersonFor("spouse"),
      mother: familyPersonFor("mother"),
      father: familyPersonFor("father"),
      children: Array.from({ length: 4 }, (_, index) => ({
        ...familyPersonFor("child", index + 1),
        gender: family.rows.find((row) => row.relationship === "child" && row.child_number === index + 1)?.gender ?? null,
      })),
    },
  };
}

async function replaceEmployeeFamilyMembers(
  client: PoolClient,
  employeeId: string,
  family: EmployeeHrDetails["family"],
): Promise<void> {
  await client.query("DELETE FROM huma.employee_family_members WHERE employee_id = $1", [employeeId]);

  const members: Array<{
    relationship: EmployeeFamilyMemberRow["relationship"];
    childNumber: number | null;
    firstName: string | null;
    middleInitial: string | null;
    lastName: string | null;
    gender: "female" | "male" | null;
    birthDate: string | null;
    nationality: string | null;
  }> = [
    { relationship: "spouse", childNumber: null, ...family.spouse, gender: null },
    { relationship: "mother", childNumber: null, ...family.mother, gender: null },
    { relationship: "father", childNumber: null, ...family.father, gender: null },
    ...family.children.map((child, index) => ({
      relationship: "child" as const,
      childNumber: index + 1,
      ...child,
    })),
  ];

  for (const member of members) {
    if (![
      member.firstName,
      member.middleInitial,
      member.lastName,
      member.gender,
      member.birthDate,
      member.nationality,
    ].some((value) => value !== null && value !== "")) continue;

    await client.query(
      [
        "INSERT INTO huma.employee_family_members",
        "  (employee_id, relationship, child_number, first_name, middle_initial, last_name, gender, birth_date, nationality, updated_at)",
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, now())",
      ].join("\n"),
      [
        employeeId,
        member.relationship,
        member.childNumber,
        member.firstName,
        member.middleInitial,
        member.lastName,
        member.gender,
        member.birthDate,
        member.nationality,
      ],
    );
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

async function resolveOrganizationPosition(
  client: PoolClient,
  positionId: string | null,
): Promise<{ name: string; departmentName: string } | null> {
  if (!positionId) return null;
  const result = await client.query<{ name: string; department_name: string }>(
    [
      "SELECT job_position.display_name AS name, department.display_name AS department_name",
      "  FROM directory.org_units AS job_position",
      "  JOIN directory.org_units AS department ON department.id = job_position.parent_id",
      "  JOIN directory.org_units AS organization ON organization.id = department.parent_id",
      " WHERE job_position.id = $1 AND job_position.source = 'eris' AND job_position.unit_type = 'position'",
      "   AND department.source = 'eris' AND department.unit_type = 'department'",
      "   AND organization.source = 'eris' AND organization.unit_type = 'organization'",
    ].join("\n"),
    [positionId],
  );
  const position = result.rows[0];
  if (!position) throw new EmployeeRecordError("invalid_position");
  return { name: position.name, departmentName: position.department_name };
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

function toEmployeeAttendanceRecord(row: EmployeeAttendanceRow): EmployeeAttendanceRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    displayName: row.display_name,
    employeeNumber: row.employee_number,
    workEmail: row.work_email,
    department: row.department,
    jobTitle: row.job_title,
    workSchedule: row.work_schedule,
    status: row.status,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    breakMinutes: row.break_minutes ?? 0,
    notes: row.notes,
    hoursWorked: row.hours_worked === null ? null : Number(row.hours_worked),
  };
}

function toEmployeeLeaveRequest(row: EmployeeLeaveRequestRow): EmployeeLeaveRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeNumber: row.employee_number,
    department: row.department,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    requestedDays: Number(row.requested_days),
    reason: row.reason,
    status: row.status,
    decisionNote: row.decision_note,
    requestedAt: row.requested_at.toISOString(),
    decidedAt: row.decided_at?.toISOString() ?? null,
    decidedByName: row.decided_by_name,
  };
}

function calculateAttendanceHours(
  clockIn: string | null,
  clockOut: string | null,
  breakMinutes: number,
): number | null {
  if (!clockIn || !clockOut) return null;
  const startHours = Number(clockIn.slice(0, 2));
  const startMinutes = Number(clockIn.slice(3, 5));
  const endHours = Number(clockOut.slice(0, 2));
  const endMinutes = Number(clockOut.slice(3, 5));
  const start = startHours * 60 + startMinutes;
  let end = endHours * 60 + endMinutes;
  if (end < start) end += 24 * 60;
  return Math.max(0, Math.round(((end - start - breakMinutes) / 60) * 100) / 100);
}

function statusFromClockTimes(
  status: AttendanceRecordStatus | null,
  clockIn: string | null,
  workSchedule: string | null,
): AttendanceRecordStatus | null {
  if (
    status === "sick_leave" ||
    status === "half_day_sick_leave" ||
    status === "vacation_leave" ||
    status === "half_day_vacation_leave" ||
    status === "nuptial" ||
    status === "bereavement" ||
    status === "official_business"
  ) return status;

  if (clockIn) {
    const actualMatch = /^(\d{2}):(\d{2})$/.exec(clockIn);
    const scheduleMatch = workSchedule
      ? /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i.exec(workSchedule)
      : null;
    if (actualMatch) {
      const actualMinutes = Number(actualMatch[1]) * 60 + Number(actualMatch[2]);
      let scheduledMinutes: number | null = null;
      if (scheduleMatch) {
        let scheduledHours = Number(scheduleMatch[1]);
        const scheduleMinutes = Number(scheduleMatch[2] ?? 0);
        const meridiem = scheduleMatch[3]?.toLowerCase().replaceAll(".", "");
        if (meridiem === "am" && scheduledHours === 12) scheduledHours = 0;
        if (meridiem === "pm" && scheduledHours < 12) scheduledHours += 12;
        if (scheduledHours <= 23 && scheduleMinutes <= 59) {
          scheduledMinutes = scheduledHours * 60 + scheduleMinutes;
        }
      }
      return scheduledMinutes !== null && actualMinutes > scheduledMinutes
        ? "late"
        : "present";
    }
  }

  return status;
}

async function loadEducationHistory(
  client: PoolClient,
  employeeId: string,
): Promise<EmployeeEducationHistoryEntry[]> {
  const result = await client.query<EmployeeEducationHistoryRow>(
    [
      "SELECT id::text AS id, education_level, institution, field_of_study, start_year, graduation_year",
      "  FROM huma.employee_education_history",
      " WHERE employee_id = $1",
      " ORDER BY graduation_year DESC NULLS LAST, start_year DESC NULLS LAST, sort_order ASC, created_at ASC",
    ].join("\n"),
    [employeeId],
  );
  return result.rows.map((entry) => ({
    id: entry.id,
    educationLevel: entry.education_level,
    institution: entry.institution,
    fieldOfStudy: entry.field_of_study,
    startYear: entry.start_year,
    graduationYear: entry.graduation_year,
  }));
}

async function replaceEducationHistory(
  client: PoolClient,
  employeeId: string,
  input: EmployeeMasterInput,
): Promise<void> {
  const hasLegacyEducation = Boolean(
    input.educationLevel || input.educationInstitution || input.educationField || input.graduationYear,
  );
  const entries = input.educationHistory ?? (hasLegacyEducation
    ? [{
        educationLevel: input.educationLevel,
        institution: input.educationInstitution,
        fieldOfStudy: input.educationField,
        startYear: null,
        graduationYear: input.graduationYear,
      }]
    : undefined);
  if (!entries) return;

  await client.query(
    "DELETE FROM huma.employee_education_history WHERE employee_id = $1",
    [employeeId],
  );

  for (const [sortOrder, entry] of entries.entries()) {
    await insertEducationHistoryEntry(client, employeeId, entry, sortOrder);
  }
}

async function insertEducationHistoryEntry(
  client: PoolClient,
  employeeId: string,
  entry: EmployeeEducationHistoryInput,
  sortOrder: number,
): Promise<void> {
  await client.query(
    [
      "INSERT INTO huma.employee_education_history",
      "  (employee_id, education_level, institution, field_of_study, start_year, graduation_year, sort_order)",
      "VALUES ($1, $2, $3, $4, $5, $6, $7)",
    ].join("\n"),
    [
      employeeId,
      entry.educationLevel,
      entry.institution,
      entry.fieldOfStudy,
      entry.startYear,
      entry.graduationYear,
      sortOrder,
    ],
  );
}

function toEmployeeMaster(
  row: EmployeeMasterRow,
  educationHistory: EmployeeEducationHistoryEntry[],
): EmployeeMasterRecord {
  return {
    id: row.id,
    positionId: row.position_id,
    employeeNumber: row.employee_number,
    displayName: row.display_name,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    suffix: row.suffix,
    preferredName: row.preferred_name,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    placeOfBirth: row.place_of_birth,
    bloodType: row.blood_type,
    maritalStatus: row.marital_status,
    permanentAddress: row.permanent_address,
    currentAddress: row.current_address,
    nationality: row.nationality,
    religion: row.religion,
    personalEmail: row.personal_email,
    personalPhone: row.personal_phone,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactRelationship: row.emergency_contact_relationship,
    emergencyContactPhone: row.emergency_contact_phone,
    emergencyContactEmail: row.emergency_contact_email,
    emergencyContactAddress: row.emergency_contact_address,
    educationLevel: row.education_level,
    educationInstitution: row.education_institution,
    educationField: row.education_field,
    graduationYear: row.graduation_year,
    educationHistory,
    workEmail: row.work_email,
    department: row.department,
    managerName: row.manager_name,
    managerWorkEmail: row.manager_work_email,
    jobTitle: row.job_title,
    employmentType: row.employment_type,
    employmentStatus: row.employment_status,
    isProbationary: row.is_probationary,
    regularizationDate: row.regularization_date,
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
