CREATE TABLE huma.employee_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES huma.employees(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'late', 'absent', 'on_leave')),
  clock_in time,
  clock_out time,
  break_minutes integer NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 1440),
  notes text,
  created_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  updated_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, attendance_date),
  CHECK (status NOT IN ('absent', 'on_leave') OR (clock_in IS NULL AND clock_out IS NULL))
);

CREATE INDEX employee_attendance_records_date_idx
  ON huma.employee_attendance_records (attendance_date, employee_id);

GRANT SELECT, INSERT, UPDATE ON huma.employee_attendance_records TO cgsi_identity;
