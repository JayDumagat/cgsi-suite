ALTER TABLE huma.employees
  ADD COLUMN suffix text;

ALTER TABLE huma.employees
  ADD CONSTRAINT huma_employees_suffix_length
    CHECK (suffix IS NULL OR length(trim(suffix)) BETWEEN 1 AND 20);
