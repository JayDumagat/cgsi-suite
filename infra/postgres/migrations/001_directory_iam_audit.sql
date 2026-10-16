CREATE SCHEMA IF NOT EXISTS directory;
CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS cube;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS huma;
CREATE SCHEMA IF NOT EXISTS rdes;
CREATE SCHEMA IF NOT EXISTS platform;

SELECT format('CREATE ROLE cgsi_identity LOGIN PASSWORD %L', :'identity_db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cgsi_identity')
\gexec
ALTER ROLE cgsi_identity NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;

CREATE TABLE IF NOT EXISTS directory.org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES directory.org_units(id) ON DELETE RESTRICT,
  unit_code text,
  display_name text NOT NULL,
  source text NOT NULL DEFAULT 'cgsi',
  source_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_key)
);

CREATE TABLE IF NOT EXISTS directory.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number text,
  display_name text NOT NULL,
  work_email text NOT NULL,
  org_unit_id uuid REFERENCES directory.org_units(id) ON DELETE RESTRICT,
  manager_employee_id uuid REFERENCES directory.employees(id) ON DELETE RESTRICT,
  employment_status text NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active', 'disabled', 'offboarded')),
  profile_source text NOT NULL DEFAULT 'entra',
  profile_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employees_work_email_nonempty CHECK (length(trim(work_email)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_number_unique
  ON directory.employees (employee_number) WHERE employee_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS employees_active_name_idx
  ON directory.employees (lower(display_name)) WHERE employment_status = 'active';
CREATE INDEX IF NOT EXISTS employees_org_unit_idx ON directory.employees (org_unit_id);

CREATE TABLE IF NOT EXISTS directory.external_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES directory.employees(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  tenant_id text NOT NULL,
  subject text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_authenticated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, tenant_id, subject),
  UNIQUE (employee_id, provider, tenant_id)
);
CREATE INDEX IF NOT EXISTS external_identities_employee_idx
  ON directory.external_identities (employee_id);

CREATE TABLE IF NOT EXISTS directory.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  records_seen integer NOT NULL DEFAULT 0 CHECK (records_seen >= 0),
  records_changed integer NOT NULL DEFAULT 0 CHECK (records_changed >= 0),
  error_code text
);

CREATE TABLE IF NOT EXISTS iam.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  owner_employee_id uuid REFERENCES directory.employees(id) ON DELETE RESTRICT,
  source text NOT NULL DEFAULT 'cgsi' CHECK (source IN ('cgsi', 'entra')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iam.employee_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES directory.employees(id) ON DELETE RESTRICT,
  group_id uuid NOT NULL REFERENCES iam.groups(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  granted_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  revoked_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE RESTRICT,
  reason text,
  source text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'system', 'entra')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > granted_at),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS employee_groups_active_unique
  ON iam.employee_groups (employee_id, group_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS employee_groups_group_idx
  ON iam.employee_groups (group_id, employee_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS iam.roles (
  role_key text PRIMARY KEY,
  app_key text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iam.permissions (
  permission_key text PRIMARY KEY,
  app_key text NOT NULL,
  resource_type text NOT NULL,
  action text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_key, resource_type, action)
);

CREATE TABLE IF NOT EXISTS iam.role_permissions (
  role_key text NOT NULL REFERENCES iam.roles(role_key) ON DELETE RESTRICT,
  permission_key text NOT NULL REFERENCES iam.permissions(permission_key) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_key, permission_key)
);

CREATE TABLE IF NOT EXISTS iam.group_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES iam.groups(id) ON DELETE RESTRICT,
  role_key text NOT NULL REFERENCES iam.roles(role_key) ON DELETE RESTRICT,
  scope_type text NOT NULL DEFAULT 'app' CHECK (scope_type IN ('app', 'org_unit', 'resource')),
  scope_id text NOT NULL DEFAULT '*',
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  granted_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  revoked_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE RESTRICT,
  reason text,
  CHECK (expires_at IS NULL OR expires_at > granted_at),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS group_roles_active_unique
  ON iam.group_roles (group_id, role_key, scope_type, scope_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS group_roles_group_idx
  ON iam.group_roles (group_id, role_key) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS iam.employee_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES directory.employees(id) ON DELETE RESTRICT,
  role_key text NOT NULL REFERENCES iam.roles(role_key) ON DELETE RESTRICT,
  scope_type text NOT NULL DEFAULT 'app' CHECK (scope_type IN ('app', 'org_unit', 'resource')),
  scope_id text NOT NULL DEFAULT '*',
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  granted_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  revoked_by_employee_id uuid REFERENCES directory.employees(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  CHECK (expires_at IS NULL OR expires_at > granted_at),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS employee_roles_active_unique
  ON iam.employee_roles (employee_id, role_key, scope_type, scope_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS employee_roles_employee_idx
  ON iam.employee_roles (employee_id, role_key) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS iam.external_group_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  tenant_id text NOT NULL,
  external_group_id text NOT NULL,
  group_id uuid NOT NULL REFERENCES iam.groups(id) ON DELETE RESTRICT,
  linked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, tenant_id, external_group_id),
  UNIQUE (provider, tenant_id, group_id)
);

CREATE TABLE IF NOT EXISTS audit.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_type text NOT NULL CHECK (actor_type IN ('employee', 'service', 'system')),
  actor_employee_id uuid REFERENCES directory.employees(id) ON DELETE SET NULL,
  actor_service text,
  action text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('success', 'denied', 'failure')),
  target_type text,
  target_id text,
  source text NOT NULL,
  request_id text,
  trace_id text,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  CHECK ((actor_type = 'employee' AND actor_employee_id IS NOT NULL) OR
         (actor_type = 'service' AND actor_service IS NOT NULL) OR actor_type = 'system')
);
CREATE INDEX IF NOT EXISTS audit_events_occurred_at_idx ON audit.events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx
  ON audit.events (actor_employee_id, occurred_at DESC) WHERE actor_employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_events_target_idx
  ON audit.events (target_type, target_id, occurred_at DESC) WHERE target_type IS NOT NULL;

CREATE TABLE IF NOT EXISTS platform.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  schema_version smallint NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_pending_idx
  ON platform.outbox_events (available_at, created_at)
  WHERE delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS platform.user_sessions (
  sid varchar NOT NULL COLLATE "default",
  sess json NOT NULL,
  expire timestamp(6) NOT NULL,
  CONSTRAINT user_sessions_pkey PRIMARY KEY (sid)
);
CREATE INDEX IF NOT EXISTS user_sessions_expire_idx ON platform.user_sessions (expire);

REVOKE ALL ON SCHEMA directory, iam, audit, platform FROM PUBLIC;
GRANT USAGE ON SCHEMA directory, iam, audit, platform TO cgsi_identity;
GRANT SELECT, INSERT, UPDATE ON directory.employees TO cgsi_identity;
GRANT SELECT, INSERT, UPDATE ON directory.external_identities TO cgsi_identity;
GRANT SELECT ON directory.org_units TO cgsi_identity;
GRANT SELECT, INSERT, UPDATE ON iam.groups TO cgsi_identity;
GRANT SELECT, INSERT, UPDATE ON iam.employee_groups TO cgsi_identity;
GRANT SELECT ON iam.group_roles, iam.roles, iam.permissions, iam.role_permissions TO cgsi_identity;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform.user_sessions TO cgsi_identity;
GRANT SELECT, INSERT, UPDATE ON platform.outbox_events TO cgsi_identity;
GRANT INSERT ON audit.events TO cgsi_identity;

REVOKE ALL ON audit.events FROM PUBLIC;
