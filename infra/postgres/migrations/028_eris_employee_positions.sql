ALTER TABLE huma.employees
  ADD COLUMN position_id uuid REFERENCES directory.org_units(id) ON DELETE SET NULL;

CREATE INDEX huma_employees_position_id_idx
  ON huma.employees (position_id)
  WHERE position_id IS NOT NULL;

UPDATE huma.employees AS employee
   SET position_id = job_position.id
  FROM directory.org_units AS job_position
  JOIN directory.org_units AS department ON department.id = job_position.parent_id
 WHERE employee.position_id IS NULL
   AND job_position.source = 'eris'
   AND job_position.unit_type = 'position'
   AND department.source = 'eris'
   AND department.unit_type = 'department'
   AND lower(trim(employee.job_title)) = lower(trim(job_position.display_name))
   AND lower(trim(employee.department)) = lower(trim(department.display_name));
