import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import AvatarText from "@/components/ui/avatar/AvatarText";
import Input from "@/components/form/input/InputField";
import Checkbox from "@/components/form/input/Checkbox";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import DataTableOne, {
  type DataTableOneColumn,
} from "@/components/tables/DataTables/TableOne/DataTableOne";
import { ChevronLeftIcon, PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";
import {
  deleteAttendanceRecord,
  EmployeeDirectoryRequestError,
  getAttendanceReport,
  saveTimesheetEntry,
  type EmployeeAttendanceRecord,
} from "@/components/employee-directory/employeeDirectoryApi";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

type AttendanceSortKey = "displayName" | "department" | "clockIn" | "overtimeHours";
const STANDARD_BREAK_MINUTES = 60;
type ClockInTone = "early" | "late" | "halfDay" | "onTime" | "neutral";
type ClockOutTone = "early" | "late" | "onTime" | "neutral";
const clockInToneClasses: Record<ClockInTone, string> = {
  early: "text-blue-600 dark:text-blue-400",
  late: "text-warning-600 dark:text-warning-400",
  halfDay: "text-orange-600 dark:text-orange-400",
  onTime: "text-success-600 dark:text-success-400",
  neutral: "text-gray-800 dark:text-white/90",
};
const clockOutToneClasses: Record<ClockOutTone, string> = {
  early: "text-warning-600 dark:text-warning-400",
  late: "text-error-600 dark:text-error-400",
  onTime: "text-success-600 dark:text-success-400",
  neutral: "text-gray-800 dark:text-white/90",
};
type AttendanceTimeDraft = {
  clockIn: string;
  clockOut: string;
  regularHours: string;
  overtimeHours: string;
  breakMinutes: string;
  notes: string;
};

function todayAsInput() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function shiftDate(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function attendanceErrorKey(error: unknown) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden") {
      return "employeeDirectory.errors.accessDenied";
    }
  }
  return "attendancePage.errors.loadFailed";
}

function attendanceMutationErrorKey(error: unknown, action: "save" | "delete") {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden") {
      return "employeeDirectory.errors.accessDenied";
    }
  }
  return action === "delete"
    ? "attendancePage.errors.deleteFailed"
    : "attendancePage.errors.saveFailed";
}

function toTimeDraft(record: EmployeeAttendanceRecord): AttendanceTimeDraft {
  const defaultRegularHours = (workedMinutes(record) ?? 0) / 60;
  return {
    clockIn: record.clockIn ?? "",
    clockOut: record.clockOut ?? "",
    regularHours: String(record.regularHours ?? Number(defaultRegularHours.toFixed(2))),
    overtimeHours: String(record.overtimeHours ?? 0),
    breakMinutes: String(record.breakMinutes),
    notes: record.notes ?? "",
  };
}

function emptyTimeDraft(): AttendanceTimeDraft {
  return {
    clockIn: "",
    clockOut: "",
    regularHours: "0",
    overtimeHours: "0",
    breakMinutes: String(STANDARD_BREAK_MINUTES),
    notes: "",
  };
}

function timeToMinutes(value: string | null) {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
}

function compareClockTimes(first: string | null, second: string | null) {
  const firstMinutes = timeToMinutes(first);
  const secondMinutes = timeToMinutes(second);
  if (firstMinutes === null && secondMinutes === null) return 0;
  if (firstMinutes === null) return 1;
  if (secondMinutes === null) return -1;
  return firstMinutes - secondMinutes;
}

function formatClockTime(value: string | null, locale: string) {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value || "—";
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));
}

function parseWorkShift(value: string | null) {
  if (!value) return null;
  const match = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|–|—|\bto\b)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i.exec(value);
  if (!match) return null;

  const parseHour = (hourValue: string, markerValue?: string) => {
    let hour = Number(hourValue);
    const marker = markerValue?.toLowerCase().replaceAll(".", "");
    if (marker === "am" && hour === 12) hour = 0;
    if (marker === "pm" && hour < 12) hour += 12;
    return hour;
  };
  const startMarker = match[3];
  const endMarker = match[6] ?? startMarker;
  let startHour = parseHour(match[1]!, startMarker);
  let endHour = parseHour(match[4]!, endMarker);
  const startMinute = Number(match[2] ?? 0);
  const endMinute = Number(match[5] ?? 0);
  if (!startMarker && !match[6]) {
    if (startHour < 12 && startHour !== 0) startHour %= 12;
    if (endHour <= startHour && endHour < 12) endHour += 12;
  }
  if (
    startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23 ||
    startMinute > 59 || endMinute > 59
  ) return null;
  return {
    start: startHour * 60 + startMinute,
    end: endHour * 60 + endMinute,
  };
}

function formatWorkShift(value: string | null, locale: string) {
  const shift = parseWorkShift(value);
  if (!shift) return value?.replace(/\s*(?:-|–|—|\bto\b)\s*/i, " – ") ?? null;
  return `${formatClockTime(`${String(Math.floor(shift.start / 60)).padStart(2, "0")}:${String(shift.start % 60).padStart(2, "0")}`, locale)} – ${formatClockTime(`${String(Math.floor(shift.end / 60)).padStart(2, "0")}:${String(shift.end % 60).padStart(2, "0")}`, locale)}`;
}

function getClockInTone(record: EmployeeAttendanceRecord): ClockInTone {
  const actual = timeToMinutes(record.clockIn);
  if (actual === null) return "neutral";
  if (record.status === "half_day_sick_leave" || record.status === "half_day_vacation_leave") {
    return "halfDay";
  }
  const shift = parseWorkShift(record.workSchedule);
  if (shift) {
    if (actual < shift.start) return "early";
    if (actual > shift.start) return "late";
    return "onTime";
  }
  if (record.status === "late") return "late";
  if (record.status === "present") return "onTime";
  return "neutral";
}

function getClockOutTone(record: EmployeeAttendanceRecord): ClockOutTone {
  const actualTime = timeToMinutes(record.clockOut);
  const shift = parseWorkShift(record.workSchedule);
  if (actualTime === null || !shift) return "neutral";
  const isOvernightShift = shift.end < shift.start;
  const scheduledEnd = isOvernightShift ? shift.end + 1440 : shift.end;
  const actual = isOvernightShift && actualTime < shift.start
    ? actualTime + 1440
    : actualTime;
  if (actual < scheduledEnd) return "early";
  if (actual > scheduledEnd) return "late";
  return "onTime";
}

function workedMinutes(record: EmployeeAttendanceRecord) {
  const recordedBreakMinutes = Math.max(0, record.breakMinutes);
  const additionalBreakMinutes = Math.max(
    0,
    STANDARD_BREAK_MINUTES - recordedBreakMinutes,
  );
  if (record.hoursWorked !== null) {
    return Math.max(
      0,
      Math.round(record.hoursWorked * 60) - additionalBreakMinutes,
    );
  }

  const clockIn = timeToMinutes(record.clockIn);
  const clockOut = timeToMinutes(record.clockOut);
  if (clockIn === null || clockOut === null) return null;
  const end = clockOut < clockIn ? clockOut + 24 * 60 : clockOut;
  return Math.max(
    0,
    end - clockIn - Math.max(recordedBreakMinutes, STANDARD_BREAK_MINUTES),
  );
}

export default function AttendancePage() {
  const { t, i18n } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(todayAsInput);
  const [records, setRecords] = useState<EmployeeAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<AttendanceSortKey>("displayName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [editingRecord, setEditingRecord] = useState<EmployeeAttendanceRecord | null>(null);
  const [isAddingAttendance, setIsAddingAttendance] = useState(false);
  const [newAttendanceEmployeeId, setNewAttendanceEmployeeId] = useState("");
  const [timeDraft, setTimeDraft] = useState<AttendanceTimeDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeAttendanceRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mutationErrorKey, setMutationErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setErrorKey(null);

    void getAttendanceReport(selectedDate, "", controller.signal)
      .then((report) => {
        if (!controller.signal.aborted) setRecords(report.items);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRecords([]);
        setErrorKey(attendanceErrorKey(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [reloadToken, selectedDate]);

  const collator = useMemo(() => new Intl.Collator(i18n.language), [i18n.language]);
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }),
    [i18n.language],
  );
  const filteredAndSortedRecords = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase(i18n.language);
    const filtered = records.filter((record) =>
      !query || [
        record.displayName,
        record.employeeNumber,
        record.workEmail,
        record.department,
        record.jobTitle,
        record.clockIn,
        record.clockOut,
        record.overtimeHours?.toString(),
      ].some((value) => value?.toLocaleLowerCase(i18n.language).includes(query)),
    );

    return filtered.sort((first, second) => {
      let comparison = 0;
      if (sortKey === "overtimeHours") {
        if (first.overtimeHours === null && second.overtimeHours === null) return 0;
        if (first.overtimeHours === null) return 1;
        if (second.overtimeHours === null) return -1;
        comparison = first.overtimeHours - second.overtimeHours;
      } else if (sortKey === "clockIn") {
        comparison = compareClockTimes(first.clockIn, second.clockIn);
        if (first.clockIn === null || second.clockIn === null) return comparison;
      } else if (sortKey === "department") {
        comparison = collator.compare(first.department ?? "", second.department ?? "");
      } else {
        comparison = collator.compare(first.displayName, second.displayName);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [collator, i18n.language, records, searchTerm, sortKey, sortOrder]);

  const totalItems = filteredAndSortedRecords.length;
  const manualEntryEmployees = records.filter(
    (record) => !record.timesheetEntryId && !record.clockIn && !record.clockOut,
  );
  const firstVisibleIndex = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastVisibleIndex = Math.min(page * pageSize, totalItems);
  const visibleRecords = filteredAndSortedRecords.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const allVisibleSelected = visibleRecords.length > 0 && visibleRecords.every(
    (record) => selectedEmployeeIds.has(record.employeeId),
  );
  const someVisibleSelected = visibleRecords.some(
    (record) => selectedEmployeeIds.has(record.employeeId),
  );

  const columns = useMemo<DataTableOneColumn<EmployeeAttendanceRecord>[]>(
    () => [
      {
        key: "select",
        label: t("attendancePage.selectAll"),
        className: "w-12",
        header: (
          <Checkbox
            ariaLabel={t("attendancePage.selectAll")}
            checked={allVisibleSelected}
            indeterminate={someVisibleSelected && !allVisibleSelected}
            onChange={(checked) => {
              setSelectedEmployeeIds((current) => {
                const next = new Set(current);
                visibleRecords.forEach((record) => {
                  if (checked) next.add(record.employeeId);
                  else next.delete(record.employeeId);
                });
                return next;
              });
            }}
          />
        ),
        render: (record) => (
          <Checkbox
            ariaLabel={t("attendancePage.selectEmployee", { employee: record.displayName })}
            checked={selectedEmployeeIds.has(record.employeeId)}
            onChange={(checked) => {
              setSelectedEmployeeIds((current) => {
                const next = new Set(current);
                if (checked) next.add(record.employeeId);
                else next.delete(record.employeeId);
                return next;
              });
            }}
          />
        ),
      },
      {
        key: "employee",
        label: t("attendancePage.employee"),
        sortKey: "displayName",
        className: "min-w-56",
        render: (record) => (
          <div className="flex items-center gap-3">
            <AvatarText
              name={record.displayName}
              className="h-10 w-10 shrink-0"
            />
            <div className="min-w-0">
              <span className="block font-medium text-gray-800 dark:text-white/90">
                {record.displayName}
              </span>
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                {t("attendancePage.shift")}: {formatWorkShift(record.workSchedule, i18n.language) ?? t("employeeDirectory.notProvided")}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: "department",
        label: t("attendancePage.department"),
        sortKey: "department",
        render: (record) => record.department || t("attendancePage.unassigned"),
      },
      {
        key: "time",
        label: t("attendancePage.clockTimes"),
        sortKey: "clockIn",
        className: "min-w-[22rem]",
        render: (record) => {
          const clockIn = formatClockTime(record.clockIn, i18n.language);
          const clockOut = formatClockTime(record.clockOut, i18n.language);
          const clockInTone = getClockInTone(record);
          const clockOutTone = getClockOutTone(record);
          const minutes = workedMinutes(record);
          const duration = minutes === null
            ? "—"
            : t("attendancePage.duration", {
                hours: Math.floor(minutes / 60),
                minutes: minutes % 60,
              });
          return (
            <div className="flex min-w-[22rem] items-center gap-3">
              <span
                title={clockInTone === "neutral" ? undefined : t(`attendancePage.clockInStates.${clockInTone}`)}
                className={`w-20 shrink-0 whitespace-nowrap text-start font-medium ${clockInToneClasses[clockInTone]}`}
              >
                {clockIn}
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span aria-hidden="true" className="h-px min-w-2 flex-1 bg-gray-300 dark:bg-gray-700" />
                <span className="shrink-0 whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400">
                  {duration}
                </span>
                <span aria-hidden="true" className="h-px min-w-2 flex-1 bg-gray-300 dark:bg-gray-700" />
                <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
              </div>
              <span
                title={clockOutTone === "neutral" ? undefined : t(`attendancePage.clockOutStates.${clockOutTone}`)}
                className={`w-20 shrink-0 whitespace-nowrap text-end font-medium ${clockOutToneClasses[clockOutTone]}`}
              >
                {clockOut}
              </span>
            </div>
          );
        },
      },
      {
        key: "overtime",
        label: t("timesheetPage.fields.overtimeHours"),
        sortKey: "overtimeHours",
        className: "min-w-32",
        render: (record) => record.overtimeHours === null
          ? "—"
          : numberFormat.format(record.overtimeHours),
      },
      {
        key: "actions",
        label: t("attendancePage.actions"),
        className: "min-w-28",
        render: (record) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t("attendancePage.editRecord", { employee: record.displayName })}
              title={t("attendancePage.edit")}
              onClick={() => {
                setMutationErrorKey(null);
                setIsAddingAttendance(false);
                setEditingRecord(record);
                setTimeDraft(toTimeDraft(record));
              }}
              className="flex size-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-brand-400"
            >
              <PencilIcon className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={t("attendancePage.deleteRecord", { employee: record.displayName })}
              title={t("attendancePage.delete")}
              disabled={!record.id && !record.timesheetEntryId}
              onClick={() => {
                setMutationErrorKey(null);
                setDeleteTarget(record);
              }}
              className="flex size-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-error-50 hover:text-error-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-error-500/10 dark:hover:text-error-400"
            >
              <TrashBinIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
        ),
      },
    ],
    [
      allVisibleSelected,
      i18n.language,
      numberFormat,
      selectedEmployeeIds,
      someVisibleSelected,
      t,
      visibleRecords,
    ],
  );

  function handleSortChange(nextSortKey: string) {
    const nextKey = nextSortKey as AttendanceSortKey;
    if (sortKey === nextKey) {
      setSortOrder((current) => current === "asc" ? "desc" : "asc");
    } else {
      setSortKey(nextKey);
      setSortOrder("asc");
    }
    setPage(1);
  }

  async function handleSaveTimeEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetEmployeeId = editingRecord?.employeeId ?? (
      isAddingAttendance ? newAttendanceEmployeeId : ""
    );
    if (!targetEmployeeId || !timeDraft) return;
    const regularHours = Number(timeDraft.regularHours);
    const overtimeHours = Number(timeDraft.overtimeHours);
    const breakMinutes = Number(timeDraft.breakMinutes);
    if (
      !Number.isFinite(regularHours) || regularHours < 0 ||
      !Number.isFinite(overtimeHours) || overtimeHours < 0 ||
      !Number.isInteger(breakMinutes) || breakMinutes < 0
    ) {
      setMutationErrorKey("attendancePage.errors.invalidEntry");
      return;
    }

    setIsSaving(true);
    setMutationErrorKey(null);
    try {
      await saveTimesheetEntry(targetEmployeeId, selectedDate, {
        clockIn: timeDraft.clockIn || null,
        clockOut: timeDraft.clockOut || null,
        regularHours,
        overtimeHours,
        breakMinutes,
        notes: timeDraft.notes.trim() || null,
      });
      setSelectedEmployeeIds((current) => {
        const next = new Set(current);
        next.delete(targetEmployeeId);
        return next;
      });
      setEditingRecord(null);
      setIsAddingAttendance(false);
      setNewAttendanceEmployeeId("");
      setTimeDraft(null);
      setReloadToken((current) => current + 1);
    } catch (error) {
      setMutationErrorKey(attendanceMutationErrorKey(error, "save"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTimeEntry() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setMutationErrorKey(null);
    try {
      await deleteAttendanceRecord(deleteTarget.employeeId, selectedDate);
      setSelectedEmployeeIds((current) => {
        const next = new Set(current);
        next.delete(deleteTarget.employeeId);
        return next;
      });
      setDeleteTarget(null);
      setReloadToken((current) => current + 1);
    } catch (error) {
      setMutationErrorKey(attendanceMutationErrorKey(error, "delete"));
    } finally {
      setIsDeleting(false);
    }
  }

  const showingMessage = t("attendancePage.table.showing", {
    start: firstVisibleIndex,
    end: lastVisibleIndex,
    total: totalItems,
  });

  return (
    <>
      <PageMeta
        title={`${t("attendancePage.title")} | ERIS`}
        description={t("attendancePage.description")}
      />
      <div className="space-y-6">
        <PageBreadcrumb pageTitle={t("attendancePage.title")} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            startIcon={<PlusIcon className="size-4" aria-hidden="true" />}
            onClick={() => {
              setMutationErrorKey(null);
              setEditingRecord(null);
              setIsAddingAttendance(true);
              setNewAttendanceEmployeeId(manualEntryEmployees[0]?.employeeId ?? "");
              setTimeDraft(emptyTimeDraft());
            }}
            disabled={isLoading}
          >
            {t("attendancePage.addAttendance")}
          </Button>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              aria-label={t("attendancePage.previousDay")}
              title={t("attendancePage.previousDay")}
              onClick={() => {
                setSelectedDate((current) => shiftDate(current, -1));
                setPage(1);
                setSelectedEmployeeIds(new Set());
              }}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <ChevronLeftIcon className="size-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
              <Input
                type="date"
                aria-label={t("attendancePage.date")}
                value={selectedDate}
                onChange={(event) => {
                  if (!event.target.value) return;
                  setSelectedDate(event.target.value);
                  setPage(1);
                  setSelectedEmployeeIds(new Set());
                }}
                className="w-full"
              />
            </div>
            <button
              type="button"
              aria-label={t("attendancePage.nextDay")}
              title={t("attendancePage.nextDay")}
              onClick={() => {
                setSelectedDate((current) => shiftDate(current, 1));
                setPage(1);
                setSelectedEmployeeIds(new Set());
              }}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <ChevronLeftIcon className="size-5 rotate-180" aria-hidden="true" />
            </button>
          </div>
        </div>

        {errorKey && (
          <div
            className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
            role="alert"
          >
            {t(errorKey)}
          </div>
        )}
        {mutationErrorKey && (
          <div
            className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
            role="alert"
          >
            {t(mutationErrorKey)}
          </div>
        )}

        <DataTableOne
          rows={visibleRecords}
          columns={columns}
          getRowKey={(record) => record.employeeId}
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          pageSizeOptions={[10, 25, 50]}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
          searchTerm={searchTerm}
          onSearchTermChange={(value) => {
            setSearchTerm(value);
            setPage(1);
          }}
          searchPlaceholder={t("attendancePage.search")}
          showLabel={t("attendancePage.table.show")}
          entriesLabel={t("attendancePage.table.entries")}
          emptyMessage={t(searchTerm.trim() ? "attendancePage.noMatches" : "attendancePage.noRecords")}
          loadingMessage={t("attendancePage.loading")}
          showingMessage={showingMessage}
          isLoading={isLoading}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
        />

        <Modal
          isOpen={Boolean(timeDraft && (editingRecord || isAddingAttendance))}
          onClose={() => {
            if (isSaving) return;
            setEditingRecord(null);
            setIsAddingAttendance(false);
            setNewAttendanceEmployeeId("");
            setTimeDraft(null);
            setMutationErrorKey(null);
          }}
          className="mx-4 max-w-2xl p-6 sm:p-8"
        >
          {timeDraft && (editingRecord || isAddingAttendance) && (
            <form onSubmit={handleSaveTimeEntry} className="space-y-5">
              <div className="pe-10">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {isAddingAttendance
                    ? t("attendancePage.manualEntryTitle")
                    : t("attendancePage.editRecord", { employee: editingRecord?.displayName })}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("attendancePage.date")}: {selectedDate}
                </p>
              </div>
              {isAddingAttendance && (
                <label className="block space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="attendance-employee">
                  {t("attendancePage.employee")}
                  <select
                    id="attendance-employee"
                    required
                    value={newAttendanceEmployeeId}
                    onChange={(event) => setNewAttendanceEmployeeId(event.target.value)}
                    disabled={manualEntryEmployees.length === 0}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  >
                    <option value="">{t("attendancePage.chooseEmployee")}</option>
                    {manualEntryEmployees.map((record) => (
                      <option key={record.employeeId} value={record.employeeId}>
                        {record.displayName}{record.department ? ` · ${record.department}` : ""}
                      </option>
                    ))}
                  </select>
                  {manualEntryEmployees.length === 0 && (
                    <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                      {t("attendancePage.noAvailableEmployees")}
                    </span>
                  )}
                </label>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="attendance-clock-in">
                  {t("attendancePage.clockIn")}
                  <Input
                    id="attendance-clock-in"
                    type="time"
                    value={timeDraft.clockIn}
                    onChange={(event) => setTimeDraft({ ...timeDraft, clockIn: event.target.value })}
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="attendance-clock-out">
                  {t("attendancePage.clockOut")}
                  <Input
                    id="attendance-clock-out"
                    type="time"
                    value={timeDraft.clockOut}
                    onChange={(event) => setTimeDraft({ ...timeDraft, clockOut: event.target.value })}
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="attendance-regular-hours">
                  {t("attendancePage.regularHours")}
                  <Input
                    id="attendance-regular-hours"
                    type="number"
                    min="0"
                    step={0.01}
                    value={timeDraft.regularHours}
                    onChange={(event) => setTimeDraft({ ...timeDraft, regularHours: event.target.value })}
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="attendance-overtime-hours">
                  {t("timesheetPage.fields.overtimeHours")}
                  <Input
                    id="attendance-overtime-hours"
                    type="number"
                    min="0"
                    step={0.01}
                    value={timeDraft.overtimeHours}
                    onChange={(event) => setTimeDraft({ ...timeDraft, overtimeHours: event.target.value })}
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="attendance-break-minutes">
                  {t("attendancePage.breakMinutes")}
                  <Input
                    id="attendance-break-minutes"
                    type="number"
                    min="0"
                    step={1}
                    value={timeDraft.breakMinutes}
                    onChange={(event) => setTimeDraft({ ...timeDraft, breakMinutes: event.target.value })}
                  />
                </label>
              </div>
              <label className="block space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="attendance-notes">
                {t("attendancePage.notes")}
                <textarea
                  id="attendance-notes"
                  rows={3}
                  value={timeDraft.notes}
                  onChange={(event) => setTimeDraft({ ...timeDraft, notes: event.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingRecord(null);
                    setIsAddingAttendance(false);
                    setNewAttendanceEmployeeId("");
                    setTimeDraft(null);
                    setMutationErrorKey(null);
                  }}
                  disabled={isSaving}
                >
                  {t("attendancePage.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || (isAddingAttendance && !newAttendanceEmployeeId)}
                >
                  {isSaving
                    ? isAddingAttendance ? t("attendancePage.adding") : t("attendancePage.saving")
                    : isAddingAttendance ? t("attendancePage.add") : t("attendancePage.saveChanges")}
                </Button>
              </div>
            </form>
          )}
        </Modal>

        <Modal
          isOpen={Boolean(deleteTarget)}
          onClose={() => {
            if (isDeleting) return;
            setDeleteTarget(null);
            setMutationErrorKey(null);
          }}
          className="mx-4 max-w-lg p-6 sm:p-8"
        >
          {deleteTarget && (
            <div className="space-y-5">
              <div className="pe-10">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {t("attendancePage.deleteConfirmTitle")}
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {t("attendancePage.deleteConfirm", {
                    employee: deleteTarget.displayName,
                    date: selectedDate,
                  })}
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                >
                  {t("attendancePage.cancel")}
                </Button>
                <button
                  type="button"
                  onClick={() => void handleDeleteTimeEntry()}
                  disabled={isDeleting}
                  className="inline-flex items-center justify-center rounded-lg bg-error-600 px-5 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-error-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? t("attendancePage.deleting") : t("attendancePage.delete")}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </>
  );
}
