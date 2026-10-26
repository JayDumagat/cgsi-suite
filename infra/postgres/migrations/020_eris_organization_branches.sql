ALTER TABLE directory.org_units
  ADD COLUMN IF NOT EXISTS unit_type text;

UPDATE directory.org_units
   SET unit_type = CASE WHEN parent_id IS NULL THEN 'organization' ELSE 'department' END
 WHERE source = 'eris'
   AND unit_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'directory_org_units_unit_type_check'
       AND conrelid = 'directory.org_units'::regclass
  ) THEN
    ALTER TABLE directory.org_units
      ADD CONSTRAINT directory_org_units_unit_type_check
      CHECK (unit_type IS NULL OR unit_type IN ('organization', 'department', 'branch'));
  END IF;
END;
$$;

DROP INDEX IF EXISTS directory.directory_eris_departments_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS directory_eris_org_children_name_unique
  ON directory.org_units (parent_id, unit_type, lower(trim(display_name)))
  WHERE source = 'eris' AND parent_id IS NOT NULL;
