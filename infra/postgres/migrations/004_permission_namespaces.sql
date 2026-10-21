-- Keep permission namespaces aligned with business domains while app_key and
-- role keys continue to identify the deployed products (CDEX, BILS, ERIS).
CREATE TEMP TABLE permission_namespace_map ON COMMIT DROP AS
SELECT
  permission_key AS old_permission_key,
  CASE
    WHEN permission_key LIKE 'cdex.%' THEN 'crm.' || substring(permission_key FROM 6)
    WHEN permission_key LIKE 'bils.%' THEN 'billing.' || substring(permission_key FROM 6)
    WHEN permission_key LIKE 'eris.%' THEN 'hris.' || substring(permission_key FROM 6)
  END AS new_permission_key
FROM iam.permissions
WHERE (app_key = 'cdex' AND permission_key LIKE 'cdex.%')
   OR (app_key = 'bils' AND permission_key LIKE 'bils.%')
   OR (app_key = 'eris' AND permission_key LIKE 'eris.%');

CREATE TEMP TABLE permission_namespace_rows ON COMMIT DROP AS
SELECT
  mapping.new_permission_key AS permission_key,
  permission.app_key,
  permission.resource_type,
  permission.action,
  permission.description,
  permission.created_at
FROM permission_namespace_map AS mapping
JOIN iam.permissions AS permission
  ON permission.permission_key = mapping.old_permission_key;

CREATE TEMP TABLE permission_namespace_role_rows ON COMMIT DROP AS
SELECT
  role_permission.role_key,
  mapping.new_permission_key AS permission_key,
  role_permission.created_at
FROM permission_namespace_map AS mapping
JOIN iam.role_permissions AS role_permission
  ON role_permission.permission_key = mapping.old_permission_key;

DELETE FROM iam.role_permissions AS role_permission
USING permission_namespace_map AS mapping
WHERE role_permission.permission_key = mapping.old_permission_key;

DELETE FROM iam.permissions AS permission
USING permission_namespace_map AS mapping
WHERE permission.permission_key = mapping.old_permission_key;

INSERT INTO iam.permissions (permission_key, app_key, resource_type, action, description, created_at)
SELECT permission_key, app_key, resource_type, action, description, created_at
FROM permission_namespace_rows
ON CONFLICT (permission_key) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO iam.role_permissions (role_key, permission_key, created_at)
SELECT role_key, permission_key, created_at
FROM permission_namespace_role_rows
ON CONFLICT (role_key, permission_key) DO NOTHING;
