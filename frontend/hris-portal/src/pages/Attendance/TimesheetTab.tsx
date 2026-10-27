import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { Card } from "@/components/ui/card";
import {
  EmployeeDirectoryRequestError,
  getTimesheetReport,
  saveTimesheetEntry,
  type AttendanceRecordStatus,
  type EmployeeTimesheetEntry,
  type TimesheetDailyReport,
} from "@/components/employee-directory/employeeDirectoryApi";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface TimesheetDraft {
  clockIn: string;
  clockOut: string;
  regularHours: string;
  overtimeHours: string;
  breakMinutes: string;
  notes: string;
}

interface TimesheetData {
  date: string;
  report: TimesheetDailyReport | null;
  errorKey: string | null;
}

interface TimesheetFeedback {
  date: string;
  employeeId?: string;
  errorKey?: string;
}

interface TimesheetAttendanceInfo {
  status: AttendanceRecordStatus | null;
  clockIn: string | null;
  clockOut: string | null;
  workSchedule: string | null;
}

type TimelineStatus = AttendanceRecordStatus | "early";

interface TimesheetTabProps {
  selectedDate: string;
  onTimesheetSaved: () => void;
  attendanceInfoByEmployee: Record<
    string,
    TimesheetAttendanceInfo | undefined
  >;
}

const hoursOfDay = Array.from({ length: 24 }, (_, hour) => hour);
const lunchHour = 12;
const lunchStart = lunchHour * 60;
const lunchEnd = (lunchHour + 1) * 60;

function timeToMinutes(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

function scheduledStartToMinutes(workSchedule: string | null | undefined) {
  if (!workSchedule) return null;
  const match = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|–|—|\bto\b)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i.exec(
    workSchedule,
  );
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return null;
  const meridiem = (match[3] ?? "").toLowerCase().replaceAll(".", "");
  if (meridiem === "am" && hours === 12) hours = 0;
  if (meridiem === "pm" && hours < 12) hours += 12;
  return hours * 60 + minutes;
}

function timelineStatusFor(
  info: TimesheetAttendanceInfo | undefined,
  clockIn: string,
): TimelineStatus | null {
  const status = info?.status ?? null;
  const leaveStatuses: AttendanceRecordStatus[] = [
    "on_leave",
    "sick_leave",
    "half_day_sick_leave",
    "vacation_leave",
    "half_day_vacation_leave",
    "nuptial",
    "bereavement",
  ];
  if (status && (leaveStatuses.includes(status) || status === "official_business")) {
    return status;
  }

  const scheduledStart = scheduledStartToMinutes(info?.workSchedule);
  const actualClockIn = timeToMinutes(clockIn || info?.clockIn);
  if (scheduledStart !== null && actualClockIn !== null) {
    if (actualClockIn < scheduledStart) return "early";
    if (actualClockIn > scheduledStart) return "late";
    return "present";
  }

  return status;
}

function timesheetErrorKey(error: unknown, fallback: string) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden") {
      return "employeeDirectory.errors.accessDenied";
    }
  }
  return fallback;
}

function toDraft(entry: EmployeeTimesheetEntry): TimesheetDraft {
  return {
    clockIn: entry.id ? (entry.clockIn ?? "") : "",
    clockOut: entry.id ? (entry.clockOut ?? "") : "",
    regularHours: entry.id ? String(entry.regularHours) : "",
    overtimeHours: entry.id ? String(entry.overtimeHours) : "",
    breakMinutes: entry.id ? String(entry.breakMinutes) : "",
    notes: entry.notes ?? "",
  };
}

function getShiftSegments(clockIn: string, clockOut: string) {
  const start = timeToMinutes(clockIn);
  const end = timeToMinutes(clockOut);
  if (start === null || end === null || start === end) return [];
  const shifts = end > start ? [{ start, end }] : [
    { start, end: 1440 },
    { start: 0, end },
  ].filter((segment) => segment.end > segment.start);

  return shifts.flatMap((shift) => {
    if (shift.end <= lunchStart || shift.start >= lunchEnd) return [shift];
    return [
      ...(shift.start < lunchStart
        ? [{ start: shift.start, end: lunchStart }]
        : []),
      ...(shift.end > lunchEnd ? [{ start: lunchEnd, end: shift.end }] : []),
    ];
  });
}

function formatTimelineTime(minutes: number, formatter: Intl.DateTimeFormat) {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  return formatter.format(new Date(2000, 0, 1, 0, normalizedMinutes));
}

function timelineClockTime(
  draftValue: string,
  attendanceValue: string | null | undefined,
  wasEdited: boolean,
) {
  return wasEdited || draftValue ? draftValue : (attendanceValue ?? "");
}

function attendanceStatusClasses(
  status: TimelineStatus | null | undefined,
) {
  switch (status) {
    case "early":
      return "border-blue-light-200 bg-blue-light-50 text-blue-light-800 dark:border-blue-light-500/25 dark:bg-blue-light-500/15 dark:text-blue-light-200";
    case "present":
      return "border-success-200 bg-success-50 text-success-700 dark:border-success-500/25 dark:bg-success-500/15 dark:text-success-300";
    case "late":
      return "border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/25 dark:bg-warning-500/15 dark:text-warning-300";
    case "absent":
      return "border-error-200 bg-error-50 text-error-700 dark:border-error-500/25 dark:bg-error-500/15 dark:text-error-300";
    case "official_business":
      return "border-blue-light-200 bg-blue-light-50 text-blue-light-800 dark:border-blue-light-500/25 dark:bg-blue-light-500/15 dark:text-blue-light-200";
    case "sick_leave":
      return "border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-500/25 dark:bg-warning-500/15 dark:text-warning-200";
    case "half_day_sick_leave":
    case "half_day_vacation_leave":
      return "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/25 dark:bg-orange-500/15 dark:text-orange-200";
    case "vacation_leave":
      return "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-500/25 dark:bg-purple-500/15 dark:text-purple-200";
    default:
      return "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

export default function TimesheetTab({
  selectedDate,
  onTimesheetSaved,
  attendanceInfoByEmployee,
}: TimesheetTabProps) {
  const { t, i18n } = useTranslation();
  const [timesheetData, setTimesheetData] = useState<TimesheetData>({
    date: "",
    report: null,
    errorKey: null,
  });
  const [drafts, setDrafts] = useState<Record<string, TimesheetDraft>>({});
  const [editedClockFields, setEditedClockFields] = useState<
    Record<string, { clockIn: boolean; clockOut: boolean }>
  >({});
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [savingEntryKey, setSavingEntryKey] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<TimesheetFeedback | null>(
    null,
  );
  const selectedDateRef = useRef(selectedDate);

  const isLoading = timesheetData.date !== selectedDate;
  const report = isLoading ? null : timesheetData.report;
  const selectedEntry =
    report?.items.find((entry) => entry.employeeId === selectedEmployeeId) ??
    null;
  const selectedDraft = selectedEntry
    ? (drafts[selectedEntry.employeeId] ?? toDraft(selectedEntry))
    : null;
  const selectedEntryKey = selectedEntry
    ? `${selectedDate}:${selectedEntry.employeeId}`
    : null;
  const loadErrorKey = isLoading ? null : timesheetData.errorKey;
  const fullDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }),
    [i18n.language],
  );
  const hourFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    [i18n.language],
  );
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    setSelectedEmployeeId(null);
    setEditedClockFields({});
    const controller = new AbortController();
    void getTimesheetReport(selectedDate, controller.signal)
      .then((nextReport) => {
        if (controller.signal.aborted) return;
        setTimesheetData({
          date: selectedDate,
          report: nextReport,
          errorKey: null,
        });
        setDrafts(
          Object.fromEntries(
            nextReport.items.map((entry) => [entry.employeeId, toDraft(entry)]),
          ),
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTimesheetData({
          date: selectedDate,
          report: null,
          errorKey: timesheetErrorKey(error, "timesheetPage.errors.loadFailed"),
        });
      });

    return () => controller.abort();
  }, [selectedDate]);

  const updateDraft = (
    employeeId: string,
    field: keyof TimesheetDraft,
    value: string,
  ) => {
    setSaveFeedback(null);
    if (field === "clockIn" || field === "clockOut") {
      setEditedClockFields((current) => ({
        ...current,
        [employeeId]: { ...current[employeeId], [field]: true },
      }));
    }
    setDrafts((current) => {
      const draft = current[employeeId] ?? {
        clockIn: "",
        clockOut: "",
        regularHours: "",
        overtimeHours: "",
        breakMinutes: "",
        notes: "",
      };
      return { ...current, [employeeId]: { ...draft, [field]: value } };
    });
  };

  const saveEntry = async (entry: EmployeeTimesheetEntry) => {
    const date = selectedDate;
    const entryKey = `${date}:${entry.employeeId}`;
    const draft = drafts[entry.employeeId] ?? toDraft(entry);
    setSavingEntryKey(entryKey);
    setSaveFeedback(null);
    try {
      const saved = await saveTimesheetEntry(entry.employeeId, date, {
        clockIn: draft.clockIn || null,
        clockOut: draft.clockOut || null,
        regularHours: Number(draft.regularHours || 0),
        overtimeHours: Number(draft.overtimeHours || 0),
        breakMinutes: Number(draft.breakMinutes || 0),
        notes: draft.notes.trim() || null,
      });
      setTimesheetData((current) =>
        current.date === date && current.report
          ? {
              ...current,
              report: {
                ...current.report,
                items: current.report.items.map((item) =>
                  item.employeeId === saved.employeeId ? saved : item,
                ),
              },
            }
          : current,
      );
      if (selectedDateRef.current === date) {
        setDrafts((current) => ({
          ...current,
          [entry.employeeId]: toDraft(saved),
        }));
      }
      onTimesheetSaved();
      setSaveFeedback({ date, employeeId: entry.employeeId });
    } catch (error) {
      setSaveFeedback({
        date,
        errorKey: timesheetErrorKey(error, "timesheetPage.errors.saveFailed"),
      });
    } finally {
      setSavingEntryKey((current) => (current === entryKey ? null : current));
    }
  };

  return (
    <section
      aria-label={t("attendancePage.tabs.timesheet")}
      className="space-y-6"
    >
      {saveFeedback?.date === selectedDate && saveFeedback.errorKey && (
        <p className="text-sm text-error-600 dark:text-error-400" role="alert">
          {t(saveFeedback.errorKey)}
        </p>
      )}

      {loadErrorKey ? (
        <p
          className="py-10 text-center text-sm text-error-600 dark:text-error-400"
          role="alert"
        >
          {t(loadErrorKey)}
        </p>
      ) : isLoading ? (
        <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          {t("timesheetPage.loading")}
        </p>
      ) : report && report.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          {t("timesheetPage.noEmployees")}
        </p>
      ) : (
        <Card>
          <section
            aria-label={t("timesheetPage.timeline.title")}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                {fullDateFormatter.format(new Date(`${selectedDate}T00:00:00`))}
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
                {[
                  { status: "present" as const, color: "bg-success-500" },
                  { status: "early" as const, color: "bg-blue-light-500" },
                  { status: "late" as const, color: "bg-warning-500" },
                  { status: "absent" as const, color: "bg-error-500" },
                ].map(({ status, color }) => (
                  <span key={status} className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${color}`}
                      aria-hidden="true"
                    />
                    {t(`attendancePage.statuses.${status}`)}
                  </span>
                ))}
                <span className="flex items-center gap-2">
                  <span
                    className="h-3 w-4 rounded-sm bg-warning-200 dark:bg-warning-500/30"
                    aria-hidden="true"
                  />
                  {t("timesheetPage.timeline.lunch")}
                </span>
              </div>
            </div>

            <div className="flex min-w-0 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="w-48 shrink-0 bg-white dark:bg-gray-900">
                <div className="flex min-h-[4.5rem] items-center border-e border-b border-gray-200 bg-gray-50 px-4 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                  {t("attendancePage.employee")}
                </div>
                {report?.items.map((entry) => {
                  return (
                    <div
                      key={entry.employeeId}
                      className="flex h-[6.5rem] min-w-0 flex-col justify-center border-e border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                          {entry.employeeName}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                          {entry.department ||
                            entry.jobTitle ||
                            entry.employeeNumber ||
                            "—"}
                        </span>
                      </div>
                      <div className="mt-1 flex min-w-0 justify-end">
                        <button
                          type="button"
                          className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400"
                          aria-pressed={selectedEmployeeId === entry.employeeId}
                          aria-label={t(
                            entry.id
                              ? "timesheetPage.editFor"
                              : "timesheetPage.enterFor",
                            { employee: entry.employeeName },
                          )}
                          onClick={() => setSelectedEmployeeId(entry.employeeId)}
                        >
                          {t(entry.id ? "timesheetPage.edit" : "timesheetPage.enter")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="custom-scrollbar min-w-0 flex-1 overflow-x-auto">
                <div
                  className="grid"
                  dir="ltr"
                  style={{
                    gridTemplateColumns: "repeat(24, minmax(4.5rem, 1fr))",
                    minWidth: "108rem",
                  }}
                  role="group"
                  aria-label={fullDateFormatter.format(
                    new Date(`${selectedDate}T00:00:00`),
                  )}
                >
                  {hoursOfDay.map((hour) => (
                    <div
                      key={`hour-${hour}`}
                      className={`flex min-h-[4.5rem] flex-col items-center justify-center border-e border-b border-gray-200 px-1 text-xs font-semibold text-gray-500 dark:border-gray-800 dark:text-gray-400 ${hour === lunchHour ? "bg-warning-50 dark:bg-warning-500/15" : "bg-gray-50 dark:bg-gray-900"}`}
                    >
                      <span>
                        {hourFormatter.format(new Date(2000, 0, 1, hour))}
                      </span>
                      {hour === lunchHour && (
                        <span className="mt-1 text-[10px] font-medium text-warning-700 dark:text-warning-300">
                          {t("timesheetPage.timeline.lunch")}
                        </span>
                      )}
                    </div>
                  ))}

                  {report?.items.map((entry) => {
                    const draft = drafts[entry.employeeId] ?? toDraft(entry);
                    const attendanceInfo =
                      attendanceInfoByEmployee[entry.employeeId];
                    const editedClock = editedClockFields[entry.employeeId];
                    const clockIn = timelineClockTime(
                      draft.clockIn,
                      attendanceInfo?.clockIn,
                      editedClock?.clockIn ?? false,
                    );
                    const clockOut = timelineClockTime(
                      draft.clockOut,
                      attendanceInfo?.clockOut,
                      editedClock?.clockOut ?? false,
                    );
                    const timelineStatus = timelineStatusFor(
                      attendanceInfo,
                      clockIn,
                    );
                    const statusLabel = timelineStatus
                      ? t(`attendancePage.statuses.${timelineStatus}`)
                      : t("attendancePage.notRecorded");
                    const segments = getShiftSegments(
                      clockIn,
                      clockOut,
                    );
                    return (
                      <div
                        key={`timeline-${entry.employeeId}`}
                        className="relative grid h-[6.5rem] grid-cols-subgrid border-b border-gray-200 dark:border-gray-800"
                        style={{
                          gridColumn: "1 / -1",
                          gridTemplateColumns: "subgrid",
                        }}
                        aria-label={t("timesheetPage.timeline.employeeHours", {
                          employee: entry.employeeName,
                        })}
                      >
                        {hoursOfDay.map((hour) => (
                          <div
                            key={`${entry.employeeId}-${hour}`}
                            className={`relative border-e border-gray-200 dark:border-gray-800 ${hour === lunchHour ? "bg-warning-50/80 dark:bg-warning-500/10" : "bg-white dark:bg-gray-900"}`}
                          />
                        ))}
                        {segments.map((segment, index) => {
                          const displayedEnd =
                            segment.end === lunchStart
                              ? lunchStart - 1
                              : segment.end;
                          const timeRange = `${formatTimelineTime(segment.start, hourFormatter)} – ${formatTimelineTime(displayedEnd, hourFormatter)}`;
                          return (
                            <div
                              key={`${entry.employeeId}-shift-${index}`}
                              className={`pointer-events-none absolute top-1/2 z-10 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-md border px-2 text-[10px] font-semibold whitespace-nowrap ${attendanceStatusClasses(timelineStatus)}`}
                              style={{
                                left: `${(segment.start / 1440) * 100}%`,
                                width: `${((segment.end - segment.start) / 1440) * 100}%`,
                              }}
                              title={timeRange}
                              aria-label={t("timesheetPage.timeline.shiftSegment", {
                                employee: entry.employeeName,
                                status: statusLabel,
                                start: formatTimelineTime(segment.start, hourFormatter),
                                end: formatTimelineTime(displayedEnd, hourFormatter),
                              })}
                            >
                              {segment.end - segment.start >= 60 && timeRange}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedEntry && selectedDraft && (
              <section
                aria-label={t("timesheetPage.editor.title", {
                  employee: selectedEntry.employeeName,
                })}
                className="border-t border-gray-200 pt-6 dark:border-gray-800"
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                      {selectedEntry.employeeName}
                    </h3>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                      {t("timesheetPage.editor.description")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingEntryKey === selectedEntryKey}
                    onClick={() => void saveEntry(selectedEntry)}
                  >
                    {savingEntryKey === selectedEntryKey
                      ? t("timesheetPage.saving")
                      : t("timesheetPage.save")}
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <label className="min-w-0 text-sm text-gray-600 dark:text-gray-400">
                    <span className="mb-1.5 block">
                      {t("timesheetPage.fields.clockIn")}
                    </span>
                    <Input
                      id={`timesheet-clock-in-${selectedEntry.employeeId}`}
                      type="time"
                      step={60}
                      aria-label={t("timesheetPage.fields.clockInFor", {
                        employee: selectedEntry.employeeName,
                      })}
                      value={selectedDraft.clockIn}
                      onChange={(event) =>
                        updateDraft(
                          selectedEntry.employeeId,
                          "clockIn",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="min-w-0 text-sm text-gray-600 dark:text-gray-400">
                    <span className="mb-1.5 block">
                      {t("timesheetPage.fields.clockOut")}
                    </span>
                    <Input
                      id={`timesheet-clock-out-${selectedEntry.employeeId}`}
                      type="time"
                      step={60}
                      aria-label={t("timesheetPage.fields.clockOutFor", {
                        employee: selectedEntry.employeeName,
                      })}
                      value={selectedDraft.clockOut}
                      onChange={(event) =>
                        updateDraft(
                          selectedEntry.employeeId,
                          "clockOut",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="min-w-0 text-sm text-gray-600 dark:text-gray-400">
                    <span className="mb-1.5 block">
                      {t("timesheetPage.fields.regularHours")}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={24}
                      step={0.25}
                      aria-label={t("timesheetPage.fields.regularHoursFor", {
                        employee: selectedEntry.employeeName,
                      })}
                      value={selectedDraft.regularHours}
                      onChange={(event) =>
                        updateDraft(
                          selectedEntry.employeeId,
                          "regularHours",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="min-w-0 text-sm text-gray-600 dark:text-gray-400">
                    <span className="mb-1.5 block">
                      {t("timesheetPage.fields.overtimeHours")}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={24}
                      step={0.25}
                      aria-label={t("timesheetPage.fields.overtimeHoursFor", {
                        employee: selectedEntry.employeeName,
                      })}
                      value={selectedDraft.overtimeHours}
                      onChange={(event) =>
                        updateDraft(
                          selectedEntry.employeeId,
                          "overtimeHours",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="min-w-0 text-sm text-gray-600 dark:text-gray-400">
                    <span className="mb-1.5 block">
                      {t("timesheetPage.fields.breakMinutes")}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={1440}
                      step={1}
                      aria-label={t("timesheetPage.fields.breakMinutesFor", {
                        employee: selectedEntry.employeeName,
                      })}
                      value={selectedDraft.breakMinutes}
                      onChange={(event) =>
                        updateDraft(
                          selectedEntry.employeeId,
                          "breakMinutes",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="min-w-0 text-sm text-gray-600 dark:text-gray-400 sm:col-span-2 xl:col-span-5">
                    <span className="mb-1.5 block">
                      {t("timesheetPage.fields.notes")}
                    </span>
                    <Input
                      type="text"
                      maxLength={1000}
                      aria-label={t("timesheetPage.fields.notesFor", {
                        employee: selectedEntry.employeeName,
                      })}
                      value={selectedDraft.notes}
                      onChange={(event) =>
                        updateDraft(
                          selectedEntry.employeeId,
                          "notes",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>

                {saveFeedback?.date === selectedDate &&
                  saveFeedback.employeeId === selectedEntry.employeeId && (
                    <p
                      className="mt-3 text-sm text-success-600 dark:text-success-400"
                      role="status"
                    >
                      {t("timesheetPage.messages.saved")}
                    </p>
                  )}
              </section>
            )}
          </section>
        </Card>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t("timesheetPage.selectedDate", {
          date: fullDateFormatter.format(new Date(`${selectedDate}T00:00:00`)),
        })}
      </p>
    </section>
  );
}
