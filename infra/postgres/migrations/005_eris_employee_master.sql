CREATE TABLE IF NOT EXISTS huma.employee_records (
  employee_id uuid PRIMARY KEY REFERENCES directory.employees(id) ON DELETE RESTRICT,
  preferred_name text,
  job_title text,
  employment_type text NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'contractor', 'temporary', 'intern')),
  hire_date date,
  termination_date date,
  work_phone text,
  work_location text,
  created_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  updated_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (termination_date IS NULL OR hire_date IS NULL OR termination_date >= hire_date),
  CHECK (preferred_name IS NULL OR length(trim(preferred_name)) BETWEEN 1 AND 200),
  CHECK (job_title IS NULL OR length(trim(job_title)) <= 120),
  CHECK (work_phone IS NULL OR length(trim(work_phone)) <= 50),
  CHECK (work_location IS NULL OR length(trim(work_location)) <= 120)
);

INSERT INTO huma.employee_records (employee_id)
SELECT id FROM directory.employees
ON CONFLICT (employee_id) DO NOTHING;

GRANT USAGE ON SCHEMA huma TO cgsi_identity;
GRANT SELECT, INSERT, UPDATE ON huma.employee_records TO cgsi_identity;
GRANT INSERT ON directory.org_units TO cgsi_identity;
GRANT SELECT ON iam.employee_roles TO cgsi_identity;
