CREATE TABLE huma.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number text,
  display_name text NOT NULL,
  preferred_name text,
  work_email text NOT NULL,
  department text,
  manager_employee_id uuid REFERENCES huma.employees(id) ON DELETE SET NULL,
  job_title text,
  employment_type text NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'contractor', 'temporary', 'intern')),
  employment_status text NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active', 'on_leave', 'disabled', 'offboarded')),
  hire_date date,
  termination_date date,
  work_phone text,
  work_location text,
  linked_directory_employee_id uuid UNIQUE REFERENCES directory.employees(id) ON DELETE SET NULL,
  created_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  updated_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT huma_employees_employee_number_valid
    CHECK (employee_number IS NULL OR length(trim(employee_number)) BETWEEN 1 AND 50),
  CONSTRAINT huma_employees_display_name_nonempty
    CHECK (length(trim(display_name)) > 0),
  CONSTRAINT huma_employees_work_email_nonempty
    CHECK (length(trim(work_email)) > 0),
  CONSTRAINT huma_employees_department_length
    CHECK (department IS NULL OR length(trim(department)) <= 120),
  CONSTRAINT huma_employees_preferred_name_length
    CHECK (preferred_name IS NULL OR length(trim(preferred_name)) BETWEEN 1 AND 200),
  CONSTRAINT huma_employees_job_title_length
    CHECK (job_title IS NULL OR length(trim(job_title)) <= 120),
  CONSTRAINT huma_employees_work_phone_length
    CHECK (work_phone IS NULL OR length(trim(work_phone)) <= 50),
  CONSTRAINT huma_employees_work_location_length
    CHECK (work_location IS NULL OR length(trim(work_location)) <= 120),
  CONSTRAINT huma_employees_dates_valid
    CHECK (termination_date IS NULL OR hire_date IS NULL OR termination_date >= hire_date)
);

WITH eligible_employees AS (
  SELECT employee.id,
         employee.employee_number,
         employee.display_name,
         record.preferred_name,
         employee.work_email,
         org_unit.display_name AS department,
         record.job_title,
         COALESCE(record.employment_type, 'full_time') AS employment_type,
         employee.employment_status,
         record.hire_date,
         record.termination_date,
         record.work_phone,
         record.work_location,
         employee.manager_employee_id,
         record.created_by_employee_id,
         record.updated_by_employee_id,
         employee.created_at,
         GREATEST(employee.updated_at, COALESCE(record.updated_at, employee.updated_at)) AS updated_at
    FROM directory.employees AS employee
    LEFT JOIN huma.employee_records AS record ON record.employee_id = employee.id
    LEFT JOIN directory.org_units AS org_unit ON org_unit.id = employee.org_unit_id
   WHERE employee.profile_source = 'hris'
      OR employee.employee_number IS NOT NULL
      OR employee.org_unit_id IS NOT NULL
      OR employee.manager_employee_id IS NOT NULL
      OR employee.employment_status = 'on_leave'
      OR record.preferred_name IS NOT NULL
      OR record.job_title IS NOT NULL
      OR record.employment_type <> 'full_time'
      OR record.hire_date IS NOT NULL
      OR record.termination_date IS NOT NULL
      OR record.work_phone IS NOT NULL
      OR record.work_location IS NOT NULL
)
INSERT INTO huma.employees (
  id, employee_number, display_name, preferred_name, work_email, department,
  job_title, employment_type, employment_status, hire_date, termination_date,
  work_phone, work_location, linked_directory_employee_id, created_by_employee_id,
  updated_by_employee_id, created_at, updated_at
)
SELECT id, employee_number, display_name, preferred_name, work_email, department,
       job_title, employment_type, employment_status, hire_date, termination_date,
       work_phone, work_location, id, created_by_employee_id, updated_by_employee_id,
       created_at, updated_at
  FROM eligible_employees;

UPDATE huma.employees AS hris_employee
   SET manager_employee_id = manager.id
  FROM directory.employees AS app_employee
  JOIN huma.employees AS manager
    ON manager.linked_directory_employee_id = app_employee.manager_employee_id
 WHERE hris_employee.linked_directory_employee_id = app_employee.id;

CREATE UNIQUE INDEX huma_employees_employee_number_unique
  ON huma.employees (lower(employee_number)) WHERE employee_number IS NOT NULL;
CREATE INDEX huma_employees_work_email_idx ON huma.employees (lower(work_email));
CREATE INDEX huma_employees_name_idx ON huma.employees (lower(display_name));
CREATE INDEX huma_employees_department_idx ON huma.employees (lower(department));

GRANT USAGE ON SCHEMA huma TO cgsi_identity;
GRANT SELECT, INSERT, UPDATE ON huma.employees TO cgsi_identity;

ALTER TABLE huma.employee_records RENAME TO employee_records_legacy;
REVOKE ALL ON huma.employee_records_legacy FROM cgsi_identity;

UPDATE directory.employees
   SET employment_status = 'active',
       profile_source = CASE WHEN profile_source = 'hris' THEN 'entra' ELSE profile_source END
 WHERE employment_status = 'on_leave' OR profile_source = 'hris';

ALTER TABLE directory.employees
  DROP CONSTRAINT IF EXISTS employees_employment_status_check;
ALTER TABLE directory.employees
  ADD CONSTRAINT employees_employment_status_check
  CHECK (employment_status IN ('active', 'disabled', 'offboarded'));

ALTER TABLE directory.employees
  DROP COLUMN IF EXISTS employee_number,
  DROP COLUMN IF EXISTS org_unit_id,
  DROP COLUMN IF EXISTS manager_employee_id;
