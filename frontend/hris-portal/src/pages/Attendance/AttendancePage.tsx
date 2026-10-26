import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import Input from "@/components/form/input/InputField";
import { Card } from "@/components/ui/card";
import {
  EmployeeDirectoryRequestError,
  getAttendanceReport,
  getLeaveManagementReport,
  type AttendanceDailyReport,
  type AttendanceRecordStatus,
  type EmployeeAttendanceRecord,
  type EmployeeLeaveRequest,
} from "@/components/employee-directory/employeeDirectoryApi";
import {
  ChevronLeftIcon,
  ChevronDownIcon,
  SearchIcon,
} from "@/icons";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

type AttendanceRange = "week" | "month";

interface AttendanceWeekEmployee {
  employee: EmployeeAttendanceRecord;
  records: Map<string, EmployeeAttendanceRecord>;
}

interface AttendanceWeekData {
  requestKey: string;
  reports: AttendanceDailyReport[];
  leaveRequests: EmployeeLeaveRequest[];
  errorKey: string | null;
}

type AttendanceDisplayStatus = AttendanceRecordStatus;

const statusStyles: Record<
  AttendanceDisplayStatus,
  { card: string; dot: string; stripe: string }
> = {
  present: {
    card: "border-success-200 bg-success-50 text-success-700 dark:border-success-500/25 dark:bg-success-500/15 dark:text-success-300",
    dot: "bg-success-500",
    stripe: "bg-success-500",
  },
  late: {
    card: "border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/25 dark:bg-warning-500/15 dark:text-warning-300",
    dot: "bg-warning-500",
    stripe: "bg-warning-500",
  },
  absent: {
    card: "border-error-200 bg-error-50 text-error-700 dark:border-error-500/25 dark:bg-error-500/15 dark:text-error-300",
    dot: "bg-error-500",
    stripe: "bg-error-500",
  },
  on_leave: {
    card: "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
    dot: "bg-gray-500",
    stripe: "bg-gray-500",
  },
  sick_leave: {
    card: "border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-500/25 dark:bg-warning-500/15 dark:text-warning-200",
    dot: "bg-warning-400",
    stripe: "bg-warning-400",
  },
  half_day_sick_leave: {
    card: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/25 dark:bg-orange-500/15 dark:text-orange-200",
    dot: "bg-orange-500",
    stripe: "bg-orange-500",
  },
  vacation_leave: {
    card: "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-500/25 dark:bg-purple-500/15 dark:text-purple-200",
    dot: "bg-purple-500",
    stripe: "bg-purple-500",
  },
  half_day_vacation_leave: {
    card: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/25 dark:bg-orange-500/15 dark:text-orange-200",
    dot: "bg-orange-500",
    stripe: "bg-orange-500",
  },
  official_business: {
    card: "border-blue-light-200 bg-blue-light-50 text-blue-light-800 dark:border-blue-light-500/25 dark:bg-blue-light-500/15 dark:text-blue-light-200",
    dot: "bg-blue-light-500",
    stripe: "bg-blue-light-500",
  },
  nuptial: {
    card: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
    dot: "bg-gray-300",
    stripe: "bg-gray-300",
  },
  bereavement: {
    card: "border-gray-900 bg-gray-900 text-white dark:border-black dark:bg-black dark:text-white",
    dot: "bg-gray-900 dark:bg-black",
    stripe: "bg-white/90 dark:bg-gray-400",
  },
};

function todayAsInput() {
  return dateAsInput(new Date());
}

function dateAsInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getWeekDates(anchorDate: string) {
  const start = parseInputDate(anchorDate);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, key: dateAsInput(date), isWeekend: index === 0 || index === 6 };
  });
}

function getMonthDates(anchorDate: string) {
  const first = parseInputDate(`${anchorDate.slice(0, 7)}-01`);
  const year = first.getFullYear();
  const month = first.getMonth();
  const dayCount = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(year, month, index + 1);
    return {
      date,
      key: dateAsInput(date),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });
}

function getRangeDates(anchorDate: string, range: AttendanceRange) {
  return range === "month" ? getMonthDates(anchorDate) : getWeekDates(anchorDate);
}

function moveMonth(value: string, amount: -1 | 1) {
  const date = parseInputDate(`${value.slice(0, 7)}-01`);
  date.setMonth(date.getMonth() + amount);
  return dateAsInput(date);
}

function moveDate(value: string, days: number) {
  const date = parseInputDate(value);
  date.setDate(date.getDate() + days);
  return dateAsInput(date);
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

function approvedLeaveStatus(
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

  const singleDayHalfLeave =
    request.startDate === request.endDate && request.requestedDays === 0.5;
  if (request.leaveType === "sick") {
    return singleDayHalfLeave ? "half_day_sick_leave" : "sick_leave";
  }
  if (request.leaveType === "annual") {
    return singleDayHalfLeave ? "half_day_vacation_leave" : "vacation_leave";
  }
  return "on_leave";
}

function getDisplayStatus(
  record: EmployeeAttendanceRecord | undefined,
  date: string,
  leaveRequests: EmployeeLeaveRequest[],
): AttendanceDisplayStatus | null {
  if (record && (!record.status || record.status === "on_leave")) {
    const leaveStatus = approvedLeaveStatus(
      record.employeeId,
      date,
      leaveRequests,
    );
    if (leaveStatus) return leaveStatus;
  }
  return record?.status ?? null;
}

interface AttendanceStatusCardProps {
  status: AttendanceDisplayStatus;
  statusLabel: string;
  ariaLabel: string;
}

function AttendanceStatusCard({
  status,
  statusLabel,
  ariaLabel,
}: AttendanceStatusCardProps) {
  const style = statusStyles[status];

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex min-h-9 w-full items-center gap-2 rounded-md border px-2 py-1.5 text-start text-xs font-medium ${style.card}`}
    >
      <span
        aria-hidden="true"
        className={`min-h-4 w-1 shrink-0 self-stretch rounded-full ${style.stripe}`}
      />
      <span className="min-w-0">
        <span className="line-clamp-2 leading-4" title={statusLabel}>
          {statusLabel}
        </span>
      </span>
    </div>
  );
}

export default function AttendancePage() {
  const { t, i18n } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(todayAsInput);
  const [selectedRange, setSelectedRange] = useState<AttendanceRange>("week");
  const [search, setSearch] = useState("");
  const [weekData, setWeekData] = useState<AttendanceWeekData>({
    requestKey: "",
    reports: [],
    leaveRequests: [],
    errorKey: null,
  });
  const calendarDates = useMemo(
    () => getRangeDates(selectedDate, selectedRange),
    [selectedDate, selectedRange],
  );
  const periodStart = calendarDates[0]?.key ?? selectedDate;
  const periodEnd = calendarDates[calendarDates.length - 1]?.key ?? selectedDate;
  const today = todayAsInput();
  const requestKey = `${selectedRange}:${periodStart}:${periodEnd}`;
  const isLoading = weekData.requestKey !== requestKey;
  const reports = useMemo(
    () => (isLoading ? [] : weekData.reports),
    [isLoading, weekData],
  );
  const leaveRequests = useMemo(
    () => (isLoading ? [] : weekData.leaveRequests),
    [isLoading, weekData],
  );
  const loadErrorKey = isLoading ? null : weekData.errorKey;

  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: "short" }),
    [i18n.language],
  );
  const monthDayFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: "short", day: "numeric" }),
    [i18n.language],
  );
  const fullDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }),
    [i18n.language],
  );
  const periodLabel = useMemo(() => {
    if (selectedRange === "month") {
      return new Intl.DateTimeFormat(i18n.language, {
        month: "long",
        year: "numeric",
      }).format(parseInputDate(periodStart));
    }

    const first = parseInputDate(periodStart);
    const last = parseInputDate(periodEnd);
    const rangeFormatter = new Intl.DateTimeFormat(i18n.language, {
      month: "short",
      day: "numeric",
    });
    const yearFormatter = new Intl.DateTimeFormat(i18n.language, {
      year: "numeric",
    });
    return `${rangeFormatter.format(first)} – ${rangeFormatter.format(last)}, ${yearFormatter.format(last)}`;
  }, [i18n.language, periodEnd, periodStart, selectedRange]);

  useEffect(() => {
    const controller = new AbortController();
    const currentRequestKey = requestKey;
    const attendancePromise = Promise.all(
      calendarDates.map(({ key }) =>
        getAttendanceReport(key, "", controller.signal),
      ),
    );
    const leavePromise = getLeaveManagementReport(controller.signal)
      .then((report) => report.items)
      .catch(() => [] as EmployeeLeaveRequest[]);

    void Promise.all([attendancePromise, leavePromise])
      .then(([dailyReports, approvedAndPendingLeaves]) => {
        if (controller.signal.aborted) return;
        setWeekData({
          requestKey: currentRequestKey,
          reports: dailyReports,
          leaveRequests: approvedAndPendingLeaves,
          errorKey: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setWeekData({
          requestKey: currentRequestKey,
          reports: [],
          leaveRequests: [],
          errorKey: attendanceErrorKey(error),
        });
      });

    return () => controller.abort();
  }, [calendarDates, requestKey]);

  const collator = useMemo(() => new Intl.Collator(i18n.language), [i18n.language]);
  const employees = useMemo(() => {
    const employeeMap = new Map<string, AttendanceWeekEmployee>();
    for (const report of reports) {
      for (const record of report.items) {
        const existing = employeeMap.get(record.employeeId);
        if (existing) {
          existing.records.set(report.date, record);
        } else {
          employeeMap.set(record.employeeId, {
            employee: record,
            records: new Map([[report.date, record]]),
          });
        }
      }
    }
    return [...employeeMap.values()].sort((a, b) => {
      const departmentOrder = collator.compare(
        a.employee.department ?? "",
        b.employee.department ?? "",
      );
      return departmentOrder || collator.compare(
        a.employee.displayName,
        b.employee.displayName,
      );
    });
  }, [collator, reports]);

  const searchQuery = search.trim().toLocaleLowerCase();
  const visibleEmployees = employees.filter(({ employee }) => {
    if (!searchQuery) return true;
    return [
      employee.displayName,
      employee.employeeNumber,
      employee.department,
      employee.jobTitle,
      employee.workEmail,
    ].some((value) => value?.toLocaleLowerCase().includes(searchQuery));
  });

  const movePeriod = (direction: -1 | 1) => {
    setSelectedDate((current) =>
      selectedRange === "month"
        ? moveMonth(current, direction)
        : moveDate(current, direction * 7),
    );
  };

  return (
    <>
      <PageMeta
        title={`${t("attendancePage.title")} | ERIS`}
        description={t("attendancePage.description")}
      />
      <div className="space-y-6">
        <PageBreadcrumb pageTitle={t("attendancePage.title")} />

        <Card>
          <section aria-labelledby="attendance-period-heading" className="space-y-4">
            <div>
              <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-4">
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => movePeriod(-1)}
                      aria-label={t(selectedRange === "month" ? "attendancePage.previousMonth" : "attendancePage.previousWeek")}
                      className="flex size-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
                    >
                      <ChevronLeftIcon className="size-4 rtl:rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePeriod(1)}
                      aria-label={t(selectedRange === "month" ? "attendancePage.nextMonth" : "attendancePage.nextWeek")}
                      className="flex size-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
                    >
                      <ChevronLeftIcon className="size-4 rotate-180 rtl:rotate-0" />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2
                      id="attendance-period-heading"
                      className="truncate text-xl font-semibold leading-tight tracking-tight text-gray-800 dark:text-white/90"
                    >
                      {periodLabel}
                    </h2>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[9rem_11rem_minmax(14rem,1fr)]">
                  <div className="relative">
                    <select
                      value={selectedRange}
                      aria-label={t("attendancePage.rangeLabel")}
                      onChange={(event) =>
                        setSelectedRange(event.target.value as AttendanceRange)
                      }
                      className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 pe-9 text-sm text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    >
                      <option value="week">{t("attendancePage.rangeOptions.week")}</option>
                      <option value="month">{t("attendancePage.rangeOptions.month")}</option>
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
                  </div>
                  <div>
                    <Input
                      type="month"
                      aria-label={t("attendancePage.month")}
                      value={selectedDate.slice(0, 7)}
                      onChange={(event) => {
                        if (event.target.value) {
                          setSelectedDate(`${event.target.value}-01`);
                        }
                      }}
                    />
                  </div>
                  <div className="relative">
                    <Input
                      type="search"
                      aria-label={t("attendancePage.search")}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={t("attendancePage.search")}
                      className="ps-10"
                    />
                    <SearchIcon
                      className="pointer-events-none absolute start-3 top-1/2 z-10 size-4 -translate-y-1/2 fill-gray-500 text-gray-500 dark:fill-gray-400 dark:text-gray-400"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            </div>

            {loadErrorKey ? (
              <p
                className="py-10 text-center text-sm text-error-600 dark:text-error-400"
                role="alert"
              >
                {t(loadErrorKey)}
              </p>
            ) : isLoading ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                {t("attendancePage.loading")}
              </p>
            ) : visibleEmployees.length === 0 ? (
              <div className="border-y border-gray-200 py-10 text-center dark:border-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {employees.length === 0
                    ? t("attendancePage.noEmployees")
                    : t("attendancePage.noMatches")}
                </p>
              </div>
            ) : (
              <div className="flex min-w-0 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="w-48 shrink-0 bg-white dark:bg-gray-900">
                  <div className="flex min-h-[4.5rem] items-center border-e border-b border-gray-200 bg-gray-50 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                    {t("attendancePage.employee")}
                  </div>
                  {visibleEmployees.map(({ employee }) => (
                    <div
                      key={employee.employeeId}
                      className="flex h-[6.5rem] min-w-0 flex-col justify-center border-e border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900"
                    >
                      <span className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                        {employee.displayName}
                      </span>
                      {employee.jobTitle && (
                        <span className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                          {employee.jobTitle}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="custom-scrollbar min-w-0 flex-1 overflow-x-auto">
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(${calendarDates.length}, minmax(8.5rem, 1fr))`,
                      minWidth: `${Math.max(60, calendarDates.length * 8.5)}rem`,
                    }}
                  >
                    {calendarDates.map(({ date, key, isWeekend }) => {
                      const isToday = key === today;
                      return (
                        <div
                          key={key}
                          className={`relative flex min-h-[4.5rem] flex-col justify-center border-e border-b border-gray-200 px-3 text-center dark:border-gray-800 ${isWeekend ? "bg-gray-50 dark:bg-gray-900" : isToday ? "bg-gray-50 dark:bg-gray-800/50" : "bg-white dark:bg-gray-900"}`}
                          style={isWeekend ? weekendStripeStyle : undefined}
                        >
                          <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {weekdayFormatter.format(date)}
                          </span>
                          <span className="mt-1 text-sm font-semibold text-gray-800 dark:text-white/90">
                            {monthDayFormatter.format(date)}
                          </span>
                          {isWeekend && (
                            <span className="sr-only">{t("attendancePage.weekend")}</span>
                          )}
                          {isToday && (
                            <span className="sr-only">{t("attendancePage.today")}</span>
                          )}
                        </div>
                      );
                    })}

                    {visibleEmployees.flatMap(({ employee, records }) =>
                      calendarDates.map(({ key, isWeekend }) => {
                        const isToday = key === today;
                        const record = records.get(key);
                        const status = getDisplayStatus(record, key, leaveRequests);
                        const statusLabel = status
                          ? t(`attendancePage.statuses.${status}`)
                          : "";
                        const dateLabel = fullDateFormatter.format(parseInputDate(key));
                        const ariaLabel = status
                          ? t("attendancePage.cellAriaLabel", {
                              employee: employee.displayName,
                              date: dateLabel,
                              status: statusLabel,
                            })
                          : t("attendancePage.recordCellAriaLabel", {
                              employee: employee.displayName,
                              date: dateLabel,
                            });
                        return (
                          <div
                            key={`${employee.employeeId}-${key}`}
                            className={`h-[6.5rem] border-e border-b border-gray-200 p-2 dark:border-gray-800 ${isWeekend ? "bg-gray-50 dark:bg-gray-900" : isToday ? "bg-gray-50 dark:bg-gray-800/50" : "bg-white dark:bg-gray-900"}`}
                            style={isWeekend ? weekendStripeStyle : undefined}
                          >
                            {record && status ? (
                              <AttendanceStatusCard
                                status={status}
                                statusLabel={statusLabel}
                                ariaLabel={ariaLabel}
                              />
                            ) : (
                              <div className="min-h-[4.5rem]" />
                            )}
                          </div>
                        );
                      }),
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </Card>

      </div>
    </>
  );
}

const weekendStripeStyle: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, transparent 0, transparent 8px, color-mix(in srgb, var(--color-gray-400) 26%, transparent) 8px, color-mix(in srgb, var(--color-gray-400) 26%, transparent) 9px)",
};
