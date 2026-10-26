ALTER TABLE directory.org_units
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS branch_manager_employee_id uuid REFERENCES huma.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_head_employee_id uuid REFERENCES huma.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS job_level text;

ALTER TABLE directory.org_units
  ADD CONSTRAINT directory_org_units_eris_metadata_lengths_check
  CHECK (
    address IS NULL OR length(trim(address)) <= 500
  ) NOT VALID;

ALTER TABLE directory.org_units
  VALIDATE CONSTRAINT directory_org_units_eris_metadata_lengths_check;

ALTER TABLE directory.org_units
  ADD CONSTRAINT directory_org_units_eris_position_metadata_check
  CHECK (
    description IS NULL OR length(trim(description)) <= 2000
  ) NOT VALID;

ALTER TABLE directory.org_units
  VALIDATE CONSTRAINT directory_org_units_eris_position_metadata_check;

ALTER TABLE directory.org_units
  ADD CONSTRAINT directory_org_units_eris_job_level_length_check
  CHECK (
    job_level IS NULL OR length(trim(job_level)) <= 80
  ) NOT VALID;

ALTER TABLE directory.org_units
  VALIDATE CONSTRAINT directory_org_units_eris_job_level_length_check;
