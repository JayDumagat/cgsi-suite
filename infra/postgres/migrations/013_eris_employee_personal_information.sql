ALTER TABLE huma.employees
  ADD COLUMN gender text,
  ADD COLUMN date_of_birth date,
  ADD COLUMN place_of_birth text,
  ADD COLUMN blood_type text,
  ADD COLUMN marital_status text,
  ADD COLUMN permanent_address text,
  ADD COLUMN current_address text,
  ADD COLUMN emergency_contact_name text,
  ADD COLUMN emergency_contact_relationship text,
  ADD COLUMN emergency_contact_phone text,
  ADD COLUMN emergency_contact_email text;

ALTER TABLE huma.employees
  ADD CONSTRAINT huma_employees_gender_length
    CHECK (gender IS NULL OR length(trim(gender)) BETWEEN 1 AND 100),
  ADD CONSTRAINT huma_employees_place_of_birth_length
    CHECK (place_of_birth IS NULL OR length(trim(place_of_birth)) BETWEEN 1 AND 200),
  ADD CONSTRAINT huma_employees_blood_type_valid
    CHECK (
      blood_type IS NULL
      OR blood_type IN (
        'a_positive', 'a_negative', 'b_positive', 'b_negative',
        'ab_positive', 'ab_negative', 'o_positive', 'o_negative'
      )
    ),
  ADD CONSTRAINT huma_employees_marital_status_valid
    CHECK (
      marital_status IS NULL
      OR marital_status IN (
        'single', 'married', 'separated', 'divorced', 'widowed',
        'domestic_partner', 'other'
      )
    ),
  ADD CONSTRAINT huma_employees_permanent_address_length
    CHECK (permanent_address IS NULL OR length(trim(permanent_address)) BETWEEN 1 AND 1000),
  ADD CONSTRAINT huma_employees_current_address_length
    CHECK (current_address IS NULL OR length(trim(current_address)) BETWEEN 1 AND 1000),
  ADD CONSTRAINT huma_employees_emergency_contact_name_length
    CHECK (emergency_contact_name IS NULL OR length(trim(emergency_contact_name)) BETWEEN 1 AND 200),
  ADD CONSTRAINT huma_employees_emergency_contact_relationship_length
    CHECK (emergency_contact_relationship IS NULL OR length(trim(emergency_contact_relationship)) BETWEEN 1 AND 80),
  ADD CONSTRAINT huma_employees_emergency_contact_phone_length
    CHECK (emergency_contact_phone IS NULL OR length(trim(emergency_contact_phone)) BETWEEN 1 AND 50),
  ADD CONSTRAINT huma_employees_emergency_contact_email_length
    CHECK (emergency_contact_email IS NULL OR length(trim(emergency_contact_email)) BETWEEN 3 AND 320);
