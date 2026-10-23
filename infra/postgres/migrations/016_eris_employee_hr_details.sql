CREATE TABLE huma.employee_attendance_leave_details (
  employee_id uuid PRIMARY KEY REFERENCES huma.employees(id) ON DELETE CASCADE,
  work_schedule text,
  weekly_hours numeric(5, 2) CHECK (weekly_hours IS NULL OR weekly_hours BETWEEN 0 AND 168),
  annual_leave_entitlement_days numeric(6, 2)
    CHECK (annual_leave_entitlement_days IS NULL OR annual_leave_entitlement_days BETWEEN 0 AND 365),
  annual_leave_used_days numeric(6, 2)
    CHECK (annual_leave_used_days IS NULL OR annual_leave_used_days BETWEEN 0 AND 365),
  updated_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE huma.employee_payroll_details (
  employee_id uuid PRIMARY KEY REFERENCES huma.employees(id) ON DELETE CASCADE,
  base_salary numeric(14, 2) CHECK (base_salary IS NULL OR base_salary >= 0),
  currency text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  pay_frequency text CHECK (pay_frequency IS NULL OR pay_frequency IN ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  pay_grade text,
  tax_id text,
  sss_number text,
  philhealth_number text,
  pagibig_number text,
  updated_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE huma.employee_medical_details (
  employee_id uuid PRIMARY KEY REFERENCES huma.employees(id) ON DELETE CASCADE,
  allergies text,
  medical_conditions text,
  current_medications text,
  health_insurance_provider text,
  health_insurance_policy_number text,
  updated_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON
  huma.employee_attendance_leave_details,
  huma.employee_payroll_details,
  huma.employee_medical_details
TO cgsi_identity;
