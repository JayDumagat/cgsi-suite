INSERT INTO iam.permissions (permission_key, app_key, resource_type, action, description)
VALUES (
  'hris.employee.create',
  'eris',
  'employee',
  'create',
  'Create employee master records in ERIS.'
)
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO iam.roles (role_key, app_key, display_name, description)
VALUES (
  'eris.employee_creator',
  'eris',
  'ERIS employee creator',
  'View the ERIS employee directory and create employee records without editing existing records.'
)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO iam.role_permissions (role_key, permission_key)
VALUES
  ('eris.employee_creator', 'hris.access'),
  ('eris.employee_creator', 'hris.employee.read'),
  ('eris.employee_creator', 'hris.employee.create')
ON CONFLICT DO NOTHING;
