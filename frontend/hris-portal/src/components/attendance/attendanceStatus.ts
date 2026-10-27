import type {
  AttendanceRecordStatus,
  EmployeeAttendanceRecord,
  EmployeeLeaveRequest,
} from "@/components/employee-directory/employeeDirectoryApi";

function leaveStatusFor(
  employeeId: string,
  date: string,
  leaveRequests: EmployeeLeaveRequest[],
): AttendanceRecordStatus | null {
  const request = leaveRequests.find(
    (item) =>
      item.employeeId === employeeId &&
      item.status === "approved" &&
      item.startDate <= date &&
      item.endDate >= date,
  );
  if (!request) return null;

  const isHalfDay =
    request.startDate === request.endDate && request.requestedDays === 0.5;
  if (request.leaveType === "sick") {
    return isHalfDay ? "half_day_sick_leave" : "sick_leave";
  }
  if (request.leaveType === "annual") {
    return isHalfDay ? "half_day_vacation_leave" : "vacation_leave";
  }
  return "on_leave";
}

function timeToMinutes(value: string | null) {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function scheduleStartToMinutes(value: string | null) {
  if (!value) return null;
  const match = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|–|—|\bto\b)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i.exec(value);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const marker = match[3]?.toLowerCase().replaceAll(".", "");
  if (marker === "am" && hours === 12) hours = 0;
  if (marker === "pm" && hours < 12) hours += 12;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const leaveStatuses: AttendanceRecordStatus[] = [
  "on_leave",
  "sick_leave",
  "half_day_sick_leave",
  "vacation_leave",
  "half_day_vacation_leave",
  "nuptial",
  "bereavement",
];

export function getAttendanceDisplayStatus(
  record: EmployeeAttendanceRecord | undefined,
  date: string,
  leaveRequests: EmployeeLeaveRequest[],
): AttendanceRecordStatus | null {
  if (!record) return null;

  if (record.status && leaveStatuses.includes(record.status) && record.status !== "on_leave") {
    return record.status;
  }
  if (record.status === "official_business") return record.status;

  if (!record.status || record.status === "on_leave") {
    const approvedLeave = leaveStatusFor(record.employeeId, date, leaveRequests);
    if (approvedLeave) return approvedLeave;
  }

  const clockIn = timeToMinutes(record.clockIn);
  if (clockIn !== null) {
    const scheduledStart = scheduleStartToMinutes(record.workSchedule);
    return scheduledStart !== null && clockIn > scheduledStart
      ? "late"
      : "present";
  }

  return record.status;
}
