CREATE TABLE huma.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  pay_date date NOT NULL,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processed')),
  excluded_employee_count integer NOT NULL DEFAULT 0 CHECK (excluded_employee_count >= 0),
  created_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  processed_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  CHECK (pay_date >= period_end),
  CHECK (
    (status = 'draft' AND processed_at IS NULL AND processed_by_employee_id IS NULL)
    OR (status = 'processed' AND processed_at IS NOT NULL)
  ),
  UNIQUE (period_start, period_end)
);

CREATE INDEX payroll_runs_created_idx ON huma.payroll_runs (created_at DESC);

CREATE TABLE huma.payroll_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES huma.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES huma.employees(id) ON DELETE RESTRICT,
  employee_name text NOT NULL,
  employee_number text,
  department text,
  pay_frequency text CHECK (pay_frequency IS NULL OR pay_frequency IN ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  base_pay numeric(14, 2) NOT NULL CHECK (base_pay >= 0),
  overtime_hours numeric(8, 2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
  earnings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(earnings) = 'array'),
  earning_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (earning_total >= 0),
  deductions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(deductions) = 'array'),
  deduction_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (deduction_total >= 0),
  contributions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(contributions) = 'array'),
  contribution_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (contribution_total >= 0),
  gross_pay numeric(14, 2) GENERATED ALWAYS AS (base_pay + earning_total) STORED,
  net_pay numeric(14, 2) GENERATED ALWAYS AS (base_pay + earning_total - deduction_total - contribution_total) STORED,
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (base_pay + earning_total >= deduction_total + contribution_total),
  UNIQUE (payroll_run_id, employee_id)
);

CREATE INDEX payroll_run_items_employee_idx
  ON huma.payroll_run_items (employee_id, payroll_run_id);

GRANT SELECT, INSERT, UPDATE ON huma.payroll_runs, huma.payroll_run_items TO cgsi_identity;
