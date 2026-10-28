CREATE TABLE huma.performance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES huma.employees(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  description text,
  due_date date,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  updated_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX performance_goals_employee_due_idx
  ON huma.performance_goals (employee_id, due_date NULLS LAST, created_at DESC);

CREATE TABLE huma.performance_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES huma.employees(id) ON DELETE CASCADE,
  feedback text NOT NULL CHECK (length(trim(feedback)) BETWEEN 1 AND 2000),
  author_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX performance_feedback_employee_created_idx
  ON huma.performance_feedback (employee_id, created_at DESC);

CREATE TABLE huma.performance_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES huma.employees(id) ON DELETE CASCADE,
  review_year smallint NOT NULL CHECK (review_year BETWEEN 1900 AND 2200),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  summary text,
  created_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  updated_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, review_year)
);

CREATE INDEX performance_ratings_year_employee_idx
  ON huma.performance_ratings (review_year DESC, employee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  huma.performance_goals,
  huma.performance_feedback,
  huma.performance_ratings
TO cgsi_identity;
