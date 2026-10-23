ALTER TABLE huma.employees
  ADD COLUMN is_probationary boolean,
  ADD COLUMN regularization_date date;

ALTER TABLE huma.employees
  ADD CONSTRAINT huma_employees_regularization_date_valid
    CHECK (
      regularization_date IS NULL
      OR hire_date IS NULL
      OR regularization_date >= hire_date
    ),
  ADD CONSTRAINT huma_employees_probationary_regularization_date_required
    CHECK (is_probationary IS DISTINCT FROM TRUE OR regularization_date IS NOT NULL);
