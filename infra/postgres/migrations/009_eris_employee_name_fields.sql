ALTER TABLE huma.employees
  ADD COLUMN first_name text,
  ADD COLUMN middle_name text,
  ADD COLUMN last_name text;

ALTER TABLE huma.employees
  ADD CONSTRAINT huma_employees_first_name_length
    CHECK (first_name IS NULL OR length(trim(first_name)) BETWEEN 1 AND 100),
  ADD CONSTRAINT huma_employees_middle_name_length
    CHECK (middle_name IS NULL OR length(trim(middle_name)) BETWEEN 1 AND 100),
  ADD CONSTRAINT huma_employees_last_name_length
    CHECK (last_name IS NULL OR length(trim(last_name)) BETWEEN 1 AND 100);
