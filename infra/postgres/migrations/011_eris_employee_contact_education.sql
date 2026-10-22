ALTER TABLE huma.employees
  ADD COLUMN personal_email text,
  ADD COLUMN personal_phone text,
  ADD COLUMN education_level text,
  ADD COLUMN education_institution text,
  ADD COLUMN education_field text,
  ADD COLUMN graduation_year smallint;

ALTER TABLE huma.employees
  ADD CONSTRAINT huma_employees_personal_email_length
    CHECK (personal_email IS NULL OR length(trim(personal_email)) BETWEEN 3 AND 320),
  ADD CONSTRAINT huma_employees_personal_phone_length
    CHECK (personal_phone IS NULL OR length(trim(personal_phone)) BETWEEN 1 AND 50),
  ADD CONSTRAINT huma_employees_education_level_length
    CHECK (education_level IS NULL OR length(trim(education_level)) BETWEEN 1 AND 120),
  ADD CONSTRAINT huma_employees_education_institution_length
    CHECK (education_institution IS NULL OR length(trim(education_institution)) BETWEEN 1 AND 200),
  ADD CONSTRAINT huma_employees_education_field_length
    CHECK (education_field IS NULL OR length(trim(education_field)) BETWEEN 1 AND 160),
  ADD CONSTRAINT huma_employees_graduation_year_range
    CHECK (graduation_year IS NULL OR graduation_year BETWEEN 1900 AND 2200);
