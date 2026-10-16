INSERT INTO iam.groups (group_key, display_name, description, source)
VALUES ('all-employees', 'All employees', 'CGSI employees provisioned from Microsoft Entra.', 'cgsi')
ON CONFLICT (group_key) DO NOTHING;

INSERT INTO iam.permissions (permission_key, app_key, resource_type, action, description)
VALUES
  ('cube.access', 'cube', 'app', 'access', 'Open the CGSI app directory.'),
  ('cdex.access', 'cdex', 'app', 'access', 'Open CDEX.'),
  ('cdex.customer.read', 'cdex', 'customer', 'read', 'View CRM customers.'),
  ('cdex.customer.create', 'cdex', 'customer', 'create', 'Create CRM customers.'),
  ('cdex.customer.update', 'cdex', 'customer', 'update', 'Update CRM customers.'),
  ('bils.access', 'bils', 'app', 'access', 'Open BILS.'),
  ('bils.invoice.read', 'bils', 'invoice', 'read', 'View billing invoices.'),
  ('bils.invoice.create', 'bils', 'invoice', 'create', 'Create billing invoices.'),
  ('bils.invoice.update', 'bils', 'invoice', 'update', 'Update billing invoices.'),
  ('bils.invoice.approve', 'bils', 'invoice', 'approve', 'Approve billing invoices.'),
  ('huma.access', 'huma', 'app', 'access', 'Open HUMA.'),
  ('huma.employee.read', 'huma', 'employee', 'read', 'View HR employee records.'),
  ('huma.employee.update', 'huma', 'employee', 'update', 'Update HR employee records.'),
  ('rdes.access', 'rdes', 'app', 'access', 'Open RDES.'),
  ('rdes.ticket.read', 'rdes', 'ticket', 'read', 'View support tickets.'),
  ('rdes.ticket.create', 'rdes', 'ticket', 'create', 'Create support tickets.'),
  ('rdes.ticket.update', 'rdes', 'ticket', 'update', 'Update support tickets.'),
  ('iam.directory.manage', 'cube', 'directory', 'manage', 'Manage employee directory records.'),
  ('iam.access.manage', 'cube', 'access', 'manage', 'Manage groups, roles, and access grants.')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO iam.roles (role_key, app_key, display_name, description)
VALUES
  ('cube.employee', 'cube', 'Cube employee', 'Baseline access for active employees.'),
  ('cdex.viewer', 'cdex', 'CDEX viewer', 'Read-only CRM access.'),
  ('cdex.editor', 'cdex', 'CDEX editor', 'Create and update CRM customers.'),
  ('bils.viewer', 'bils', 'BILS viewer', 'Read-only billing access.'),
  ('bils.finance', 'bils', 'BILS finance', 'Manage and approve invoices.'),
  ('huma.viewer', 'huma', 'HUMA viewer', 'View permitted HR employee records.'),
  ('huma.hr_admin', 'huma', 'HUMA HR administrator', 'Manage HR employee records.'),
  ('rdes.agent', 'rdes', 'RDES agent', 'Work support tickets.'),
  ('directory.admin', 'cube', 'Directory administrator', 'Manage local directory and access assignments.')
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO iam.role_permissions (role_key, permission_key)
VALUES
  ('cube.employee', 'cube.access'),
  ('cdex.viewer', 'cdex.access'),
  ('cdex.viewer', 'cdex.customer.read'),
  ('cdex.editor', 'cdex.access'),
  ('cdex.editor', 'cdex.customer.read'),
  ('cdex.editor', 'cdex.customer.create'),
  ('cdex.editor', 'cdex.customer.update'),
  ('bils.viewer', 'bils.access'),
  ('bils.viewer', 'bils.invoice.read'),
  ('bils.finance', 'bils.access'),
  ('bils.finance', 'bils.invoice.read'),
  ('bils.finance', 'bils.invoice.create'),
  ('bils.finance', 'bils.invoice.update'),
  ('bils.finance', 'bils.invoice.approve'),
  ('huma.viewer', 'huma.access'),
  ('huma.viewer', 'huma.employee.read'),
  ('huma.hr_admin', 'huma.access'),
  ('huma.hr_admin', 'huma.employee.read'),
  ('huma.hr_admin', 'huma.employee.update'),
  ('rdes.agent', 'rdes.access'),
  ('rdes.agent', 'rdes.ticket.read'),
  ('rdes.agent', 'rdes.ticket.create'),
  ('rdes.agent', 'rdes.ticket.update'),
  ('directory.admin', 'iam.directory.manage'),
  ('directory.admin', 'iam.access.manage')
ON CONFLICT DO NOTHING;

INSERT INTO iam.group_roles (group_id, role_key, scope_type, scope_id, reason)
SELECT id, 'cube.employee', 'app', 'cube', 'Baseline CGSI employee access.'
FROM iam.groups WHERE group_key = 'all-employees'
ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON iam.groups, iam.employee_groups TO cgsi_identity;
GRANT SELECT ON iam.roles, iam.permissions, iam.role_permissions, iam.group_roles TO cgsi_identity;
