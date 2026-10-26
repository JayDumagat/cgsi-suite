CREATE UNIQUE INDEX IF NOT EXISTS directory_eris_organizations_name_unique
  ON directory.org_units (lower(trim(display_name)))
  WHERE source = 'eris' AND parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS directory_eris_departments_name_unique
  ON directory.org_units (parent_id, lower(trim(display_name)))
  WHERE source = 'eris' AND parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS directory_eris_org_units_parent_idx
  ON directory.org_units (parent_id, lower(display_name))
  WHERE source = 'eris';

GRANT SELECT, INSERT ON directory.org_units TO cgsi_identity;
