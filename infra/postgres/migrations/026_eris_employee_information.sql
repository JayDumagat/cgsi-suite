ALTER TABLE huma.employees
  ADD COLUMN nationality text,
  ADD COLUMN religion text,
  ADD COLUMN emergency_contact_address text;

ALTER TABLE huma.employees
  ADD CONSTRAINT huma_employees_nationality_length
    CHECK (nationality IS NULL OR length(trim(nationality)) BETWEEN 1 AND 120),
  ADD CONSTRAINT huma_employees_religion_length
    CHECK (religion IS NULL OR length(trim(religion)) BETWEEN 1 AND 120),
  ADD CONSTRAINT huma_employees_emergency_contact_address_length
    CHECK (emergency_contact_address IS NULL OR length(trim(emergency_contact_address)) BETWEEN 1 AND 1000);

CREATE TABLE huma.employee_family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES huma.employees(id) ON DELETE CASCADE,
  relationship text NOT NULL CHECK (relationship IN ('spouse', 'mother', 'father', 'child')),
  child_number smallint,
  first_name text,
  middle_initial text,
  last_name text,
  gender text CHECK (gender IS NULL OR gender IN ('female', 'male')),
  birth_date date,
  nationality text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT huma_employee_family_members_child_number
    CHECK (
      (relationship = 'child' AND child_number BETWEEN 1 AND 4)
      OR (relationship IN ('spouse', 'mother', 'father') AND child_number IS NULL)
    ),
  CONSTRAINT huma_employee_family_members_name_lengths
    CHECK (
      (first_name IS NULL OR length(trim(first_name)) BETWEEN 1 AND 100)
      AND (middle_initial IS NULL OR length(trim(middle_initial)) BETWEEN 1 AND 20)
      AND (last_name IS NULL OR length(trim(last_name)) BETWEEN 1 AND 100)
      AND (nationality IS NULL OR length(trim(nationality)) BETWEEN 1 AND 120)
    )
);

CREATE UNIQUE INDEX huma_employee_family_members_position_unique
  ON huma.employee_family_members (employee_id, relationship, COALESCE(child_number, 0));

GRANT SELECT, INSERT, UPDATE, DELETE ON huma.employee_family_members TO cgsi_identity;
