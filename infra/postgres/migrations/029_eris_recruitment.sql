CREATE TABLE huma.recruitment_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  position_id uuid REFERENCES directory.org_units(id) ON DELETE SET NULL,
  department text,
  location text,
  employment_type text NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'contractor', 'temporary', 'intern')),
  headcount integer NOT NULL DEFAULT 1 CHECK (headcount BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  description text,
  created_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  updated_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recruitment_openings_status_idx
  ON huma.recruitment_openings (status, lower(title));

CREATE TABLE huma.recruitment_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opening_id uuid NOT NULL REFERENCES huma.recruitment_openings(id) ON DELETE CASCADE,
  first_name text NOT NULL CHECK (length(trim(first_name)) BETWEEN 1 AND 100),
  last_name text NOT NULL CHECK (length(trim(last_name)) BETWEEN 1 AND 100),
  email text NOT NULL CHECK (length(trim(email)) BETWEEN 3 AND 320),
  phone text,
  source text,
  stage text NOT NULL DEFAULT 'applied'
    CHECK (stage IN ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected')),
  notes text,
  applied_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  updated_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opening_id, email)
);

CREATE INDEX recruitment_candidates_stage_idx
  ON huma.recruitment_candidates (stage, applied_at DESC);
CREATE INDEX recruitment_candidates_opening_idx
  ON huma.recruitment_candidates (opening_id, stage);

CREATE TABLE huma.recruitment_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES huma.recruitment_candidates(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 480),
  interview_type text NOT NULL DEFAULT 'interview' CHECK (length(trim(interview_type)) BETWEEN 1 AND 80),
  interviewer_employee_id uuid REFERENCES huma.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes text,
  created_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  updated_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recruitment_interviews_schedule_idx
  ON huma.recruitment_interviews (scheduled_at, status);
CREATE INDEX recruitment_interviews_candidate_idx
  ON huma.recruitment_interviews (candidate_id, scheduled_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  huma.recruitment_openings,
  huma.recruitment_candidates,
  huma.recruitment_interviews
TO cgsi_identity;
