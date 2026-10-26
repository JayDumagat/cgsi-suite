ALTER TABLE huma.employee_attendance_records
  DROP CONSTRAINT IF EXISTS employee_attendance_records_status_check;

ALTER TABLE huma.employee_attendance_records
  ADD CONSTRAINT employee_attendance_records_status_check
    CHECK (status IN (
      'present',
      'late',
      'absent',
      'on_leave',
      'sick_leave',
      'half_day_sick_leave',
      'vacation_leave',
      'half_day_vacation_leave',
      'official_business',
      'nuptial',
      'bereavement'
    ));

ALTER TABLE huma.employee_attendance_records
  DROP CONSTRAINT IF EXISTS employee_attendance_records_check;

ALTER TABLE huma.employee_attendance_records
  ADD CONSTRAINT employee_attendance_records_clock_times_check
    CHECK (
      status IN ('present', 'late', 'half_day_sick_leave', 'half_day_vacation_leave', 'official_business')
      OR (clock_in IS NULL AND clock_out IS NULL)
    );
