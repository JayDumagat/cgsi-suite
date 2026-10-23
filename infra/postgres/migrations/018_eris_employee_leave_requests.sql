CREATE TABLE huma.employee_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES huma.employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL CHECK (leave_type IN ('annual', 'sick', 'emergency', 'parental', 'unpaid', 'other')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  requested_days numeric(6, 2) NOT NULL CHECK (requested_days > 0 AND requested_days <= 366),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decision_note text CHECK (decision_note IS NULL OR length(trim(decision_note)) <= 1000),
  requested_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  decided_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (
    (status = 'pending' AND decided_at IS NULL AND decided_by_employee_id IS NULL)
    OR (status IN ('approved', 'rejected') AND decided_at IS NOT NULL)
  )
);

CREATE INDEX employee_leave_requests_status_date_idx
  ON huma.employee_leave_requests (status, start_date DESC, requested_at DESC);
CREATE INDEX employee_leave_requests_employee_date_idx
  ON huma.employee_leave_requests (employee_id, start_date, end_date)
  WHERE status IN ('pending', 'approved');

GRANT SELECT, INSERT, UPDATE ON huma.employee_leave_requests TO cgsi_identity;
