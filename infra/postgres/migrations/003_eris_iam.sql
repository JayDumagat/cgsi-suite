CREATE SCHEMA IF NOT EXISTS eris;

INSERT INTO iam.permissions (permission_key, app_key, resource_type, action, description)
VALUES
  ('eris.access', 'eris', 'app', 'access', 'Open ERIS.'),
  ('eris.employee.read', 'eris', 'employee', 'read', 'View approved employee directory fields in ERIS.'),
  ('eris.employee.update', 'eris', 'employee', 'update', 'Update approved employee records in ERIS.')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO iam.roles (role_key, app_key, display_name, description)
VALUES
  ('eris.viewer', 'eris', 'ERIS viewer', 'View employee directory fields approved for ERIS.'),
  ('eris.hr_admin', 'eris', 'ERIS HR administrator', 'Manage permitted HR records in ERIS.')
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO iam.role_permissions (role_key, permission_key)
VALUES
  ('eris.viewer', 'eris.access'),
  ('eris.viewer', 'eris.employee.read'),
  ('eris.hr_admin', 'eris.access'),
  ('eris.hr_admin', 'eris.employee.read'),
  ('eris.hr_admin', 'eris.employee.update')
ON CONFLICT DO NOTHING;
