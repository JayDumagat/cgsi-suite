import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import PageMeta from "@/components/common/PageMeta";
import { Card } from "@/components/ui/card";
import Badge from "@/components/ui/badge/Badge";
import AttendanceRateCard from "@/components/attendance/AttendanceRateCard";
import {
  EmployeeDirectoryRequestError,
  getAttendanceReport,
  getLeaveManagementReport,
  listEmployees,
  type AttendanceRecordStatus,
  type AttendanceDailyReport,
  type EmployeeLeaveManagementReport,
} from "@/components/employee-directory/employeeDirectoryApi";
import {
  CalenderIcon,
  CheckLineIcon,
  ClockIcon,
  UserCircleIcon,
} from "@/icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

function todayAsInput() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function moveDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string, locale: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date)
    : value;
}

function statusBadgeColor(status: AttendanceRecordStatus | null) {
  switch (status) {
    case "present":
      return "success" as const;
    case "late":
      return "warning" as const;
    case "absent":
      return "error" as const;
    case "on_leave":
      return "primary" as const;
    default:
      return "light" as const;
  }
}

function dashboardErrorKey(error: unknown) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden")
      return "employeeDirectory.errors.accessDenied";
  }
  return "hrDashboard.errors.loadFailed";
}

export default function HrDashboardPage() {
  const { t, i18n } = useTranslation();
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);
  const [attendance, setAttendance] = useState<AttendanceDailyReport | null>(
    null,
  );
  const [previousAttendance, setPreviousAttendance] =
    useState<AttendanceDailyReport | null>(null);
  const [leaveReport, setLeaveReport] =
    useState<EmployeeLeaveManagementReport | null>(null);
  const [hasLeaveAccess, setHasLeaveAccess] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [attendanceErrorKey, setAttendanceErrorKey] = useState<string | null>(
    null,
  );
  const today = useMemo(() => todayAsInput(), []);
  const previousWeekday = useMemo(() => moveDate(today, -7), [today]);
  const dateLabel = useMemo(() => {
    const parsed = new Date(`${today}T00:00:00`);
    return Number.isFinite(parsed.getTime())
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }).format(
          parsed,
        )
      : today;
  }, [i18n.language, today]);
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language],
  );

  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      listEmployees(
        {
          query: "",
          page: 1,
          pageSize: 1,
          sortBy: "displayName",
          sortOrder: "asc",
        },
        controller.signal,
      ),
      getAttendanceReport(today, "", controller.signal),
      getAttendanceReport(previousWeekday, "", controller.signal),
      getLeaveManagementReport(controller.signal),
    ])
      .then(
        ([
          employeesResult,
          attendanceResult,
          previousAttendanceResult,
          leaveResult,
        ]) => {
          if (controller.signal.aborted) return;
          if (employeesResult.status === "fulfilled") {
            setEmployeeCount(employeesResult.value.summary.totalEmployees);
          } else {
            setErrorKey(dashboardErrorKey(employeesResult.reason));
          }
          if (attendanceResult.status === "fulfilled") {
            setAttendance(attendanceResult.value);
          } else {
            setAttendanceErrorKey(dashboardErrorKey(attendanceResult.reason));
            setErrorKey(
              (current) =>
                current ?? dashboardErrorKey(attendanceResult.reason),
            );
          }
          setPreviousAttendance(
            previousAttendanceResult.status === "fulfilled"
              ? previousAttendanceResult.value
              : null,
          );
          if (leaveResult.status === "fulfilled") {
            setLeaveReport(leaveResult.value);
            setHasLeaveAccess(true);
          } else {
            setLeaveReport(null);
            setHasLeaveAccess(false);
          }
        },
      )
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [previousWeekday, today]);

  const summary = attendance?.summary;
  const metrics = [
    {
      label: t("hrDashboard.stats.totalEmployees"),
      value: employeeCount,
      icon: <UserCircleIcon className="size-5" aria-hidden="true" />,
      tone: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
    },
    {
      label: t("hrDashboard.stats.presentToday"),
      value: summary?.presentCount ?? null,
      icon: <CheckLineIcon className="size-5" aria-hidden="true" />,
      tone: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
    },
    {
      label: t("hrDashboard.stats.lateArrivals"),
      value: summary?.lateCount ?? null,
      icon: <ClockIcon className="size-5" aria-hidden="true" />,
      tone: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
    },
    {
      label: t("hrDashboard.stats.pendingLeave"),
      value: leaveReport?.summary.pendingCount ?? null,
      icon: <CalenderIcon className="size-5" aria-hidden="true" />,
      tone: "bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
    },
  ];

  const attendanceBreakdown = [
    {
      key: "present",
      label: t("hrDashboard.attendance.present"),
      value: summary?.presentCount ?? 0,
      tone: "bg-success-500",
    },
    {
      key: "late",
      label: t("hrDashboard.attendance.late"),
      value: summary?.lateCount ?? 0,
      tone: "bg-warning-500",
    },
    {
      key: "absent",
      label: t("hrDashboard.attendance.absent"),
      value: summary?.absentCount ?? 0,
      tone: "bg-error-500",
    },
    {
      key: "onLeave",
      label: t("hrDashboard.attendance.onLeave"),
      value: summary?.onLeaveCount ?? 0,
      tone: "bg-brand-500",
    },
    {
      key: "notRecorded",
      label: t("hrDashboard.attendance.notRecorded"),
      value: Math.max(
        0,
        (summary?.employeeCount ?? 0) - (summary?.recordedCount ?? 0),
      ),
      tone: "bg-gray-300 dark:bg-gray-600",
    },
  ];
  const attendanceTotal = summary?.employeeCount ?? 0;
  const upcomingLeave = (leaveReport?.items ?? [])
    .filter(
      (request) => request.status === "approved" && request.startDate >= today,
    )
    .sort((first, second) => first.startDate.localeCompare(second.startDate))
    .slice(0, 5);
  const attendancePreview = (attendance?.items ?? []).slice(0, 7);

  return (
    <>
      <PageMeta
        title={`${t("hrDashboard.title")} | ERIS`}
        description={t("hrDashboard.description")}
      />
      <div className="space-y-6">
        <PageBreadcrumb pageTitle={t("hrDashboard.title")} />
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
              {t("hrDashboard.title")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("hrDashboard.description")}
            </p>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {dateLabel}
          </p>
        </header>

        {errorKey && (
          <p
            className="border-y border-error-200 py-3 text-sm text-error-700 dark:border-error-500/30 dark:text-error-400"
            role="alert"
          >
            {t(errorKey)}
          </p>
        )}

        <section
          aria-label={t("hrDashboard.stats.title")}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <article>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {metric.label}
                  </p>
                  <span
                    className={`flex size-10 items-center justify-center rounded-xl ${metric.tone}`}
                  >
                    {metric.icon}
                  </span>
                </div>
                <p className="mt-4 text-2xl font-semibold text-gray-800 dark:text-white/90">
                  {isLoading || metric.value === null
                    ? "—"
                    : numberFormat.format(metric.value)}
                </p>
              </article>
            </Card>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <AttendanceRateCard
            currentReport={attendance}
            previousReport={previousAttendance}
            leaveRequests={leaveReport?.items ?? []}
            isLoading={isLoading}
            loadErrorKey={attendanceErrorKey}
          />

          <ComponentCard
            title={t("hrDashboard.attendance.title")}
            desc={t("hrDashboard.attendance.description")}
            spacing={false}
          >
            <section
              aria-label={t("hrDashboard.attendance.title")}
              className="space-y-5"
            >
              <div
                className="flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                aria-label={t("hrDashboard.attendance.title")}
              >
                {attendanceBreakdown.map((item) =>
                  item.value > 0 && attendanceTotal > 0 ? (
                    <div
                      key={item.key}
                      className={item.tone}
                      style={{
                        width: `${(item.value / attendanceTotal) * 100}%`,
                      }}
                      title={`${item.label}: ${item.value}`}
                    />
                  ) : null,
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
                {attendanceBreakdown.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <dt className="flex min-w-0 items-center gap-2 text-gray-500 dark:text-gray-400">
                      <span
                        className={`size-2 shrink-0 rounded-full ${item.tone}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </dt>
                    <dd className="font-medium text-gray-800 dark:text-white/90">
                      {isLoading ? "—" : numberFormat.format(item.value)}
                    </dd>
                  </div>
                ))}
              </dl>
              {attendancePreview.length > 0 && (
                <div className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                  {attendancePreview.map((record) => (
                    <div
                      key={record.employeeId}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                          {record.displayName}
                        </p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {record.department ||
                            record.employeeNumber ||
                            record.workEmail}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {record.clockIn || "—"}
                          {record.clockOut ? ` – ${record.clockOut}` : ""}
                        </span>
                        <Badge
                          size="sm"
                          color={statusBadgeColor(record.status)}
                        >
                          {t(
                            `attendancePage.statuses.${record.status ?? "unrecorded"}`,
                          )}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!isLoading && attendancePreview.length === 0 && (
                <p className="border-t border-gray-100 pt-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  {t("hrDashboard.attendance.empty")}
                </p>
              )}
            </section>
          </ComponentCard>

          <ComponentCard
            title={t("hrDashboard.upcomingLeave.title")}
            desc={t("hrDashboard.upcomingLeave.description")}
            spacing={false}
          >
            <section
              aria-label={t("hrDashboard.upcomingLeave.title")}
              className="space-y-4"
            >
              {isLoading ? (
                <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                  {t("hrDashboard.loading")}
                </p>
              ) : !hasLeaveAccess ? (
                <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                  {t("hrDashboard.upcomingLeave.restricted")}
                </p>
              ) : upcomingLeave.length === 0 ? (
                <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                  {t("hrDashboard.upcomingLeave.empty")}
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {upcomingLeave.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                          {request.employeeName}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {t(
                            `leaveManagementPage.leaveTypes.${request.leaveType}`,
                          )}{" "}
                          · {numberFormat.format(request.requestedDays)}{" "}
                          {t("hrDashboard.upcomingLeave.days")}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(request.startDate, i18n.language)} –{" "}
                        {formatDate(request.endDate, i18n.language)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </ComponentCard>
        </div>
      </div>
    </>
  );
}
