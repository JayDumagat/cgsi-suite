ALTER TABLE directory.org_units
  DROP CONSTRAINT IF EXISTS directory_org_units_unit_type_check;

ALTER TABLE directory.org_units
  ADD CONSTRAINT directory_org_units_unit_type_check
  CHECK (unit_type IS NULL OR unit_type IN ('organization', 'department', 'branch', 'position'));
