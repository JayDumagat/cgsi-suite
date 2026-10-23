CREATE TABLE huma.employee_education_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES huma.employees(id) ON DELETE CASCADE,
  education_level text,
  institution text,
  field_of_study text,
  start_year smallint,
  graduation_year smallint,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT huma_employee_education_history_has_details
    CHECK (education_level IS NOT NULL OR institution IS NOT NULL OR field_of_study IS NOT NULL),
  CONSTRAINT huma_employee_education_history_level_length
    CHECK (education_level IS NULL OR length(trim(education_level)) BETWEEN 1 AND 120),
  CONSTRAINT huma_employee_education_history_institution_length
    CHECK (institution IS NULL OR length(trim(institution)) BETWEEN 1 AND 200),
  CONSTRAINT huma_employee_education_history_field_length
    CHECK (field_of_study IS NULL OR length(trim(field_of_study)) BETWEEN 1 AND 160),
  CONSTRAINT huma_employee_education_history_start_year_range
    CHECK (start_year IS NULL OR start_year BETWEEN 1900 AND 2200),
  CONSTRAINT huma_employee_education_history_graduation_year_range
    CHECK (graduation_year IS NULL OR graduation_year BETWEEN 1900 AND 2200),
  CONSTRAINT huma_employee_education_history_years_valid
    CHECK (start_year IS NULL OR graduation_year IS NULL OR graduation_year >= start_year)
);

INSERT INTO huma.employee_education_history (
  employee_id, education_level, institution, field_of_study, graduation_year
)
SELECT id, education_level, education_institution, education_field, graduation_year
  FROM huma.employees
 WHERE education_level IS NOT NULL
    OR education_institution IS NOT NULL
    OR education_field IS NOT NULL
    OR graduation_year IS NOT NULL;

CREATE INDEX huma_employee_education_history_employee_idx
  ON huma.employee_education_history (employee_id, graduation_year DESC, start_year DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON huma.employee_education_history TO cgsi_identity;
