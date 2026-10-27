import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import AttendanceRateCard from "@/components/attendance/AttendanceRateCard";
import { getAttendanceDisplayStatus } from "@/components/attendance/attendanceStatus";
import CrmStatisticsChart from "@/components/crm/CrmStatisticsChart";
import Input from "@/components/form/input/InputField";
import { Card } from "@/components/ui/card";
import { TabButton } from "@/components/ui/tabs/TabWithUnderline";
import TimesheetTab from "@/pages/Attendance/TimesheetTab";
import {
  EmployeeDirectoryRequestError,
  getAttendanceMonthlyStatistics,
  getAttendanceReport,
  getLeaveManagementReport,
  type AttendanceDailyReport,
  type AttendanceMonthlyStatistics,
  type AttendanceRecordStatus,
  type EmployeeAttendanceRecord,
  type EmployeeLeaveRequest,
} from "@/components/employee-directory/employeeDirectoryApi";
import { ChevronLeftIcon, ChevronDownIcon, SearchIcon } from "@/icons";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

type AttendanceRange = "day" | "week" | "month";
type AttendancePageTab = "attendance" | "timesheet";

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

interface AnnualAttendanceStatisticsState {
  year: number | null;
  months: AttendanceMonthlyStatistics["months"];
  isLoading: boolean;
  errorKey: string | null;
}

type AttendanceDisplayStatus = AttendanceRecordStatus;
interface AttendanceTimelineEmployeeInfo {
  status: AttendanceDisplayStatus | null;
  clockIn: string | null;
  clockOut: string | null;
  workSchedule: string | null;
}

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
    return {
      date,
      key: dateAsInput(date),
      isWeekend: index === 0 || index === 6,
    };
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

function getDayDates(anchorDate: string) {
  const date = parseInputDate(anchorDate);
  return [
    {
      date,
      key: anchorDate,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    },
  ];
}

function getRangeDates(anchorDate: string, range: AttendanceRange) {
  if (range === "day") return getDayDates(anchorDate);
  return range === "month"
    ? getMonthDates(anchorDate)
    : getWeekDates(anchorDate);
}

function getPreviousRangeDates(anchorDate: string, range: AttendanceRange) {
  const previousAnchorDate =
    range === "month" ? moveMonth(anchorDate, -1) : moveDate(anchorDate, -7);
  return getRangeDates(previousAnchorDate, range);
}

function clockTimeToMinutes(value: string | null) {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function average(values: number[]) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function getDailyClockTimeCounts(
  report: AttendanceDailyReport | undefined,
  formatClockMinutes: (minutes: number) => string,
) {
  const clockInCounts = new Map<number, number>();
  const clockOutCounts = new Map<number, number>();
  const addToBucket = (counts: Map<number, number>, value: string | null) => {
    const minutes = clockTimeToMinutes(value);
    if (minutes === null) return;
    const bucket = Math.min(47, Math.round(minutes / 30));
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  };

  for (const record of report?.items ?? []) {
    addToBucket(clockInCounts, record.clockIn);
    addToBucket(clockOutCounts, record.clockOut);
  }

  const buckets = [...clockInCounts.keys(), ...clockOutCounts.keys()];
  if (buckets.length === 0) {
    return { categories: [] as string[], clockIn: [] as number[], clockOut: [] as number[] };
  }
  const firstBucket = Math.min(...buckets);
  const lastBucket = Math.max(...buckets);
  const activeBuckets = Array.from(
    { length: lastBucket - firstBucket + 1 },
    (_, index) => firstBucket + index,
  );

  return {
    categories: activeBuckets.map((bucket) =>
      formatClockMinutes(bucket * 30),
    ),
    clockIn: activeBuckets.map((bucket) => clockInCounts.get(bucket) ?? 0),
    clockOut: activeBuckets.map((bucket) => clockOutCounts.get(bucket) ?? 0),
  };
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
  const [activeTab, setActiveTab] = useState<AttendancePageTab>("attendance");
  const [selectedDate, setSelectedDate] = useState(todayAsInput);
  const [selectedRange, setSelectedRange] = useState<AttendanceRange>("day");
  const [timesheetRevision, setTimesheetRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [comparisonData, setComparisonData] = useState<{
    requestKey: string;
    reports: AttendanceDailyReport[];
  }>({ requestKey: "", reports: [] });
  const [weekData, setWeekData] = useState<AttendanceWeekData>({
    requestKey: "",
    reports: [],
    leaveRequests: [],
    errorKey: null,
  });
  const [annualTimeStatistics, setAnnualTimeStatistics] =
    useState<AnnualAttendanceStatisticsState>({
      year: null,
      months: [],
      isLoading: false,
      errorKey: null,
    });
  const calendarDates = useMemo(
    () => getRangeDates(selectedDate, selectedRange),
    [selectedDate, selectedRange],
  );
  const periodStart = calendarDates[0]?.key ?? selectedDate;
  const periodEnd =
    calendarDates[calendarDates.length - 1]?.key ?? selectedDate;
  const today = todayAsInput();
  const selectedDayDate = parseInputDate(selectedDate);
  const selectedYear = selectedDayDate.getFullYear();
  const selectedDayIsWeekend =
    selectedDayDate.getDay() === 0 || selectedDayDate.getDay() === 6;
  const selectedDayIsToday = selectedDate === today;
  const previousCalendarDates = useMemo(
    () => getPreviousRangeDates(selectedDate, selectedRange),
    [selectedDate, selectedRange],
  );
  const comparisonRequestKey = `${selectedRange}:${previousCalendarDates[0]?.key ?? selectedDate}:${previousCalendarDates[previousCalendarDates.length - 1]?.key ?? selectedDate}`;
  const requestKey = `${selectedRange}:${periodStart}:${periodEnd}:${timesheetRevision}`;
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
  const previousReports =
    comparisonData.requestKey === comparisonRequestKey
      ? comparisonData.reports
      : [];
  const selectedAttendanceInfoByEmployee = useMemo(() => {
    const selectedDayReport = reports.find(
      (report) => report.date === selectedDate,
    );
    return Object.fromEntries(
      (selectedDayReport?.items ?? []).map((record) => [
        record.employeeId,
        {
          status: getAttendanceDisplayStatus(record, selectedDate, leaveRequests),
          clockIn: record.clockIn,
          clockOut: record.clockOut,
          workSchedule: record.workSchedule,
        },
      ]),
    ) as Record<string, AttendanceTimelineEmployeeInfo>;
  }, [leaveRequests, reports, selectedDate]);

  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: "short" }),
    [i18n.language],
  );
  const fullWeekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: "long" }),
    [i18n.language],
  );
  const monthDayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        month: "short",
        day: "numeric",
      }),
    [i18n.language],
  );
  const monthNameFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: "short" }),
    [i18n.language],
  );
  const fullDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }),
    [i18n.language],
  );
  const clockTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        hour: "numeric",
        minute: "2-digit",
      }),
    [i18n.language],
  );
  const formatClockMinutes = useMemo(
    () => (minutes: number) => {
      if (!Number.isFinite(minutes)) return "—";
      const normalizedMinutes = ((Math.round(minutes) % 1440) + 1440) % 1440;
      return clockTimeFormatter.format(
        new Date(2000, 0, 1, 0, normalizedMinutes),
      );
    },
    [clockTimeFormatter],
  );
  const periodLabel = useMemo(() => {
    if (selectedRange === "day") {
      return fullDateFormatter.format(parseInputDate(periodStart));
    }
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
  }, [fullDateFormatter, i18n.language, periodEnd, periodStart, selectedRange]);
  const timeStatistics = useMemo(() => {
    const allClockIns: number[] = [];
    const allClockOuts: number[] = [];
    const daily = reports.map((report) => {
      const clockIns = report.items
        .map((record) => clockTimeToMinutes(record.clockIn))
        .filter((value): value is number => value !== null);
      const clockOuts = report.items
        .map((record) => clockTimeToMinutes(record.clockOut))
        .filter((value): value is number => value !== null);
      allClockIns.push(...clockIns);
      allClockOuts.push(...clockOuts);
      return {
        date: report.date,
        averageClockIn: average(clockIns),
        averageClockOut: average(clockOuts),
      };
    });

    return {
      averageClockIn: average(allClockIns),
      averageClockOut: average(allClockOuts),
      daily,
    };
  }, [reports]);
  const dailyClockTimeCounts = useMemo(
    () =>
      getDailyClockTimeCounts(
        reports.find((report) => report.date === selectedDate),
        formatClockMinutes,
      ),
    [formatClockMinutes, reports, selectedDate],
  );
  const annualMonthlyAverageMap = useMemo(
    () =>
      new Map(
        (annualTimeStatistics.year === selectedYear
          ? annualTimeStatistics.months
          : []
        ).map((month) => [month.month, month]),
      ),
    [annualTimeStatistics.months, annualTimeStatistics.year, selectedYear],
  );
  const annualMonthCategories = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) =>
        monthNameFormatter.format(new Date(selectedYear, month, 1)),
      ),
    [monthNameFormatter, selectedYear],
  );
  const weeklyStatisticsByDate = new Map(
    timeStatistics.daily.map((point) => [point.date, point]),
  );
  const statisticsCategories =
    selectedRange === "day"
      ? dailyClockTimeCounts.categories
      : selectedRange === "week"
        ? calendarDates.map(({ date }) => fullWeekdayFormatter.format(date))
        : annualMonthCategories;
  const statisticsSeries =
    selectedRange === "day"
      ? [
          {
            name: t("attendancePage.statistics.timeIn"),
            data: dailyClockTimeCounts.clockIn,
          },
          {
            name: t("attendancePage.statistics.timeOut"),
            data: dailyClockTimeCounts.clockOut,
          },
        ]
      : selectedRange === "week"
        ? [
            {
              name: t("attendancePage.statistics.timeIn"),
              data: calendarDates.map(
                ({ key }) => weeklyStatisticsByDate.get(key)?.averageClockIn ?? null,
              ),
            },
            {
              name: t("attendancePage.statistics.timeOut"),
              data: calendarDates.map(
                ({ key }) => weeklyStatisticsByDate.get(key)?.averageClockOut ?? null,
              ),
            },
          ]
        : [
            {
              name: t("attendancePage.statistics.timeIn"),
              data: Array.from(
                { length: 12 },
                (_, index) => annualMonthlyAverageMap.get(index + 1)?.averageClockIn ?? null,
              ),
            },
            {
              name: t("attendancePage.statistics.timeOut"),
              data: Array.from(
                { length: 12 },
                (_, index) => annualMonthlyAverageMap.get(index + 1)?.averageClockOut ?? null,
              ),
            },
          ];
  const statisticsSubtitle =
    selectedRange === "day"
      ? t("attendancePage.statistics.daySubtitle", { period: periodLabel })
      : selectedRange === "month"
        ? annualTimeStatistics.errorKey && annualTimeStatistics.year === selectedYear
          ? t(annualTimeStatistics.errorKey)
          : annualTimeStatistics.isLoading || annualTimeStatistics.year !== selectedYear
            ? t("attendancePage.statistics.loadingYear", { year: selectedYear })
          : t("attendancePage.statistics.yearSubtitle", { year: selectedYear })
        : t("attendancePage.statistics.subtitle", { period: periodLabel });
  const statisticsXAxisTitle = t(
    `attendancePage.statistics.${selectedRange === "day" ? "timeAxis" : selectedRange === "week" ? "weekdayAxis" : "monthAxis"}`,
  );
  const statisticsYAxisTitle = t(
    selectedRange === "day"
      ? "attendancePage.statistics.countAxis"
      : "attendancePage.statistics.averageTimeAxis",
  );

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

  useEffect(() => {
    const controller = new AbortController();
    const currentRequestKey = comparisonRequestKey;
    setComparisonData({ requestKey: currentRequestKey, reports: [] });
    void Promise.all(
      previousCalendarDates.map(({ key }) =>
        getAttendanceReport(key, "", controller.signal),
      ),
    )
      .then((reports) => {
        if (!controller.signal.aborted) {
          setComparisonData({ requestKey: currentRequestKey, reports });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setComparisonData({ requestKey: currentRequestKey, reports: [] });
        }
      });

    return () => controller.abort();
  }, [comparisonRequestKey, previousCalendarDates]);

  useEffect(() => {
    if (selectedRange !== "month") return;
    const controller = new AbortController();
    setAnnualTimeStatistics({
      year: selectedYear,
      months: [],
      isLoading: true,
      errorKey: null,
    });
    void getAttendanceMonthlyStatistics(selectedYear, controller.signal)
      .then((statistics) => {
        if (controller.signal.aborted) return;
        setAnnualTimeStatistics({
          year: statistics.year,
          months: statistics.months,
          isLoading: false,
          errorKey: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setAnnualTimeStatistics({
          year: selectedYear,
          months: [],
          isLoading: false,
          errorKey: attendanceErrorKey(error),
        });
      });

    return () => controller.abort();
  }, [selectedRange, selectedYear, timesheetRevision]);

  const collator = useMemo(
    () => new Intl.Collator(i18n.language),
    [i18n.language],
  );
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
      return (
        departmentOrder ||
        collator.compare(a.employee.displayName, b.employee.displayName)
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
  const attendanceStats = [
    {
      label: t("attendancePage.summary.totalEmployees"),
      value: Object.keys(selectedAttendanceInfoByEmployee).length,
    },
    {
      label: t("attendancePage.summary.presentEmployees"),
      value: Object.values(selectedAttendanceInfoByEmployee).filter(
        ({ status }) =>
          status === "present" || status === "late" || status === "official_business",
      ).length,
    },
    {
      label: t("attendancePage.summary.absentEmployees"),
      value: Object.values(selectedAttendanceInfoByEmployee).filter(
        ({ status }) => status === "absent",
      ).length,
    },
    {
      label: t("attendancePage.summary.onLeaveEmployees"),
      value: Object.values(selectedAttendanceInfoByEmployee).filter(
        ({ status }) =>
          status === "on_leave" ||
          status === "sick_leave" ||
          status === "half_day_sick_leave" ||
          status === "vacation_leave" ||
          status === "half_day_vacation_leave" ||
          status === "nuptial" ||
          status === "bereavement",
      ).length,
    },
  ];

  const movePeriod = (direction: -1 | 1) => {
    setSelectedDate((current) =>
      selectedRange === "month"
        ? moveMonth(current, direction)
        : moveDate(current, direction * (selectedRange === "week" ? 7 : 1)),
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

        <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => movePeriod(-1)}
                aria-label={t(
                  selectedRange === "month"
                    ? "attendancePage.previousMonth"
                    : selectedRange === "day"
                      ? "attendancePage.previousDay"
                      : "attendancePage.previousWeek",
                )}
                className="flex size-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
              >
                <ChevronLeftIcon className="size-4 rtl:rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => movePeriod(1)}
                aria-label={t(
                  selectedRange === "month"
                    ? "attendancePage.nextMonth"
                    : selectedRange === "day"
                      ? "attendancePage.nextDay"
                      : "attendancePage.nextWeek",
                )}
                className="flex size-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
              >
                <ChevronLeftIcon className="size-4 rotate-180 rtl:rotate-0" />
              </button>
            </div>
            <h2
              id="attendance-period-heading"
              className="min-w-0 truncate text-xl leading-tight font-semibold tracking-tight text-gray-800 dark:text-white/90"
            >
              {periodLabel}
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-[9rem_14rem]">
            <div className="relative">
              <select
                value={selectedRange}
                aria-label={t("attendancePage.rangeLabel")}
                onChange={(event) =>
                  setSelectedRange(event.target.value as AttendanceRange)
                }
                className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 pe-9 text-sm text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                <option value="day">
                  {t("attendancePage.rangeOptions.day")}
                </option>
                <option value="week">
                  {t("attendancePage.rangeOptions.week")}
                </option>
                <option value="month">
                  {t("attendancePage.rangeOptions.month")}
                </option>
              </select>
              <ChevronDownIcon className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
            </div>
            <Input
              type="date"
              aria-label={t("attendancePage.date")}
              value={selectedDate}
              onChange={(event) => {
                if (event.target.value) setSelectedDate(event.target.value);
              }}
            />
          </div>
        </div>

        <div className="space-y-6">
          <nav
            role="tablist"
            aria-label={t("attendancePage.tabs.label")}
            className="flex gap-5 overflow-x-auto border-b border-gray-200 dark:border-gray-800"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              const tabs: AttendancePageTab[] = ["attendance", "timesheet"];
              const activeIndex = tabs.indexOf(activeTab);
              const isRtl = document.documentElement.dir === "rtl";
              const nextIndex =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (activeIndex +
                        (event.key === "ArrowRight"
                          ? isRtl
                            ? -1
                            : 1
                          : isRtl
                            ? 1
                            : -1) +
                        tabs.length) %
                      tabs.length;
              event.preventDefault();
              setActiveTab(tabs[nextIndex]!);
              event.currentTarget
                .querySelectorAll<HTMLButtonElement>('[role="tab"]')
                [nextIndex]?.focus();
            }}
          >
            <TabButton
              id="attendance-tab"
              label={t("attendancePage.tabs.attendance")}
              isActive={activeTab === "attendance"}
              onClick={() => setActiveTab("attendance")}
              role="tab"
              tabIndex={activeTab === "attendance" ? 0 : -1}
              ariaControls="attendance-panel"
            />
            <TabButton
              id="timesheet-tab"
              label={t("attendancePage.tabs.timesheet")}
              isActive={activeTab === "timesheet"}
              onClick={() => setActiveTab("timesheet")}
              role="tab"
              tabIndex={activeTab === "timesheet" ? 0 : -1}
              ariaControls="timesheet-panel"
            />
          </nav>

          <div
            id="attendance-panel"
            role="tabpanel"
            aria-labelledby="attendance-tab"
            hidden={activeTab !== "attendance"}
            className="space-y-6"
          >
            <section
              aria-label={t("attendancePage.summary.title")}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              {attendanceStats.map((stat) => (
                <Card key={stat.label}>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-gray-800 dark:text-white/90">
                    {isLoading ? "—" : stat.value}
                  </p>
                </Card>
              ))}
            </section>

            <Card>
              <section
                aria-labelledby="attendance-period-heading"
                className="space-y-4"
              >
                <div className="flex justify-end">
                  <div className="relative w-full max-w-sm">
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
                ) : selectedRange === "day" ? (
                  <div className="flex min-w-0 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                    <div className="w-48 shrink-0 bg-white dark:bg-gray-900">
                      <div className="flex min-h-[4.5rem] items-center border-e border-b border-gray-200 bg-gray-50 px-4 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
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

                    <div className="min-w-0 flex-1 overflow-x-auto">
                      <div
                        className="grid min-w-full"
                        style={{ gridTemplateColumns: "minmax(8.5rem, 1fr)" }}
                      >
                        <div
                          className={`relative flex min-h-[4.5rem] flex-col justify-center border-e border-b border-gray-200 px-3 text-center dark:border-gray-800 ${selectedDayIsWeekend ? "bg-gray-50 dark:bg-gray-900" : selectedDayIsToday ? "bg-gray-50 dark:bg-gray-800/50" : "bg-white dark:bg-gray-900"}`}
                          style={
                            selectedDayIsWeekend
                              ? weekendStripeStyle
                              : undefined
                          }
                        >
                          <span className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                            {fullWeekdayFormatter.format(selectedDayDate)}
                          </span>
                          <span className="mt-1 text-sm font-semibold text-gray-800 dark:text-white/90">
                            {monthDayFormatter.format(selectedDayDate)}
                          </span>
                          {selectedDayIsWeekend && (
                            <span className="sr-only">
                              {t("attendancePage.weekend")}
                            </span>
                          )}
                          {selectedDayIsToday && (
                            <span className="sr-only">
                              {t("attendancePage.today")}
                            </span>
                          )}
                        </div>

                        {visibleEmployees.map(({ employee, records }) => {
                          const record = records.get(selectedDate);
                          const status = getAttendanceDisplayStatus(
                            record,
                            selectedDate,
                            leaveRequests,
                          );
                          const statusLabel = status
                            ? t(`attendancePage.statuses.${status}`)
                            : "";
                          const ariaLabel = status
                            ? t("attendancePage.cellAriaLabel", {
                                employee: employee.displayName,
                                date: fullDateFormatter.format(selectedDayDate),
                                status: statusLabel,
                              })
                            : t("attendancePage.recordCellAriaLabel", {
                                employee: employee.displayName,
                                date: fullDateFormatter.format(selectedDayDate),
                              });

                          return (
                            <div
                              key={employee.employeeId}
                              className={`h-[6.5rem] border-e border-b border-gray-200 p-2 dark:border-gray-800 ${selectedDayIsWeekend ? "bg-gray-50 dark:bg-gray-900" : selectedDayIsToday ? "bg-gray-50 dark:bg-gray-800/50" : "bg-white dark:bg-gray-900"}`}
                              style={
                                selectedDayIsWeekend
                                  ? weekendStripeStyle
                                  : undefined
                              }
                            >
                              {status ? (
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
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-w-0 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                    <div className="w-48 shrink-0 bg-white dark:bg-gray-900">
                      <div className="flex min-h-[4.5rem] items-center border-e border-b border-gray-200 bg-gray-50 px-4 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
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
                              <span className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                                {weekdayFormatter.format(date)}
                              </span>
                              <span className="mt-1 text-sm font-semibold text-gray-800 dark:text-white/90">
                                {monthDayFormatter.format(date)}
                              </span>
                              {isWeekend && (
                                <span className="sr-only">
                                  {t("attendancePage.weekend")}
                                </span>
                              )}
                              {isToday && (
                                <span className="sr-only">
                                  {t("attendancePage.today")}
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {visibleEmployees.flatMap(({ employee, records }) =>
                          calendarDates.map(({ key, isWeekend }) => {
                            const isToday = key === today;
                            const record = records.get(key);
                            const status = getAttendanceDisplayStatus(
                              record,
                              key,
                              leaveRequests,
                            );
                            const statusLabel = status
                              ? t(`attendancePage.statuses.${status}`)
                              : "";
                            const dateLabel = fullDateFormatter.format(
                              parseInputDate(key),
                            );
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
                                style={
                                  isWeekend ? weekendStripeStyle : undefined
                                }
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

          <div
            id="timesheet-panel"
            role="tabpanel"
            aria-labelledby="timesheet-tab"
            hidden={activeTab !== "timesheet"}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="xl:col-span-4">
                <AttendanceRateCard
                  currentReports={reports}
                  previousReports={previousReports}
                  leaveRequests={leaveRequests}
                  period={selectedRange}
                  isLoading={isLoading}
                  loadErrorKey={loadErrorKey}
                  description={t(
                    "attendancePage.rate.selectedPeriodDescription",
                    {
                      period: periodLabel,
                    },
                  )}
                />
              </div>
              <div className="xl:col-span-8">
                <CrmStatisticsChart
                  title={t("attendancePage.statistics.title")}
                  subtitle={statisticsSubtitle}
                  firstMetric={{
                    value:
                      timeStatistics.averageClockIn === null
                        ? "—"
                        : formatClockMinutes(timeStatistics.averageClockIn),
                    label: t("attendancePage.statistics.averageTimeIn"),
                  }}
                  secondMetric={{
                    value:
                      timeStatistics.averageClockOut === null
                        ? "—"
                        : formatClockMinutes(timeStatistics.averageClockOut),
                    label: t("attendancePage.statistics.averageTimeOut"),
                  }}
                  categories={statisticsCategories}
                  series={statisticsSeries}
                  showLegend
                  showPeriodTabs={false}
                  xAxisTitle={statisticsXAxisTitle}
                  yAxisTitle={statisticsYAxisTitle}
                  yAxisAsCount={selectedRange === "day"}
                  xAxisTickAmount={selectedRange === "day" ? 10 : undefined}
                  yAxisFormatter={
                    selectedRange === "day" ? undefined : formatClockMinutes
                  }
                />
              </div>
            </div>
            <TimesheetTab
              selectedDate={selectedDate}
              onTimesheetSaved={() => setTimesheetRevision((revision) => revision + 1)}
              attendanceInfoByEmployee={selectedAttendanceInfoByEmployee}
            />
          </div>
        </div>
      </div>
    </>
  );
}

const weekendStripeStyle: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, transparent 0, transparent 8px, color-mix(in srgb, var(--color-gray-400) 26%, transparent) 8px, color-mix(in srgb, var(--color-gray-400) 26%, transparent) 9px)",
};
