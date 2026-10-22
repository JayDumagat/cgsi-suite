ALTER TABLE directory.employees
  DROP CONSTRAINT IF EXISTS employees_employment_status_check;

ALTER TABLE directory.employees
  ADD CONSTRAINT employees_employment_status_check
  CHECK (employment_status IN ('active', 'on_leave', 'disabled', 'offboarded'));
