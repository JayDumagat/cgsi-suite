CREATE TABLE huma.employee_timesheet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES huma.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  regular_hours numeric(6, 2) NOT NULL DEFAULT 0 CHECK (regular_hours BETWEEN 0 AND 24),
  overtime_hours numeric(6, 2) NOT NULL DEFAULT 0 CHECK (overtime_hours BETWEEN 0 AND 24),
  break_minutes integer NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 1440),
  notes text,
  created_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  updated_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);

CREATE INDEX employee_timesheet_entries_date_idx
  ON huma.employee_timesheet_entries (work_date, employee_id);

GRANT SELECT, INSERT, UPDATE ON huma.employee_timesheet_entries TO cgsi_identity;
