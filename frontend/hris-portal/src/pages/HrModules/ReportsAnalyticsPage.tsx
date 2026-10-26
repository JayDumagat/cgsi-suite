import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import Input from "@/components/form/input/InputField";
import ProgressBar from "@/components/ui/progressbar/ProgressBar";
import {
  EmployeeDirectoryRequestError,
  getAttendanceReport,
  getLeaveManagementReport,
  listEmployees,
  type AttendanceDailyReport,
  type EmployeeDirectoryItem,
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
import { HrStatCard, ModuleSection } from "./HrModuleComponents";

const pageSize = 100;
const employmentTypes = [
  "full_time",
  "part_time",
  "contractor",
  "temporary",
  "intern",
] as const;

function todayAsInput() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function reportErrorKey(error: unknown) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden")
      return "employeeDirectory.errors.accessDenied";
  }
  return "reportsAnalyticsPage.errors.loadFailed";
}

function BarList({
  items,
  emptyLabel,
}: {
  items: { label: string; value: number }[];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (items.length === 0)
    return (
      <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
        {emptyLabel}
      </p>
    );
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-2 flex items-center justify-between gap-4 text-sm">
            <span className="truncate text-gray-600 dark:text-gray-300">
              {item.label}
            </span>
            <span className="shrink-0 font-medium text-gray-800 dark:text-white/90">
              {item.value}
            </span>
          </div>
          <ProgressBar
            progress={Math.max(
              item.value > 0 ? 4 : 0,
              (item.value / max) * 100,
            )}
            size="sm"
          />
        </div>
      ))}
    </div>
  );
}

export default function ReportsAnalyticsPage() {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState(todayAsInput);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDailyReport | null>(
    null,
  );
  const [leaveReport, setLeaveReport] =
    useState<EmployeeLeaveManagementReport | null>(null);
  const [leaveRestricted, setLeaveRestricted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function loadReports() {
      setIsLoading(true);
      setErrorKey(null);
      const [directoryResult, attendanceResult, leaveResult] =
        await Promise.allSettled([
          (async () => {
            const firstPage = await listEmployees(
              {
                query: "",
                page: 1,
                pageSize,
                sortBy: "displayName",
                sortOrder: "asc",
              },
              controller.signal,
            );
            const pageCount = Math.ceil(firstPage.total / pageSize);
            const remainingPages = await Promise.all(
              Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
                listEmployees(
                  {
                    query: "",
                    page: index + 2,
                    pageSize,
                    sortBy: "displayName",
                    sortOrder: "asc",
                  },
                  controller.signal,
                ),
              ),
            );
            return [
              ...firstPage.items,
              ...remainingPages.flatMap((page) => page.items),
            ];
          })(),
          getAttendanceReport(date, "", controller.signal),
          getLeaveManagementReport(controller.signal),
        ]);
      if (controller.signal.aborted) return;
      if (directoryResult.status === "fulfilled")
        setEmployees(directoryResult.value);
      else {
        setEmployees([]);
        setErrorKey(reportErrorKey(directoryResult.reason));
      }
      if (attendanceResult.status === "fulfilled")
        setAttendance(attendanceResult.value);
      else {
        setAttendance(null);
        setErrorKey(
          (current) => current ?? reportErrorKey(attendanceResult.reason),
        );
      }
      if (leaveResult.status === "fulfilled") {
        setLeaveReport(leaveResult.value);
        setLeaveRestricted(false);
      } else {
        setLeaveReport(null);
        setLeaveRestricted(
          leaveResult.reason instanceof EmployeeDirectoryRequestError &&
            leaveResult.reason.status === 403,
        );
      }
      setIsLoading(false);
    }
    void loadReports();
    return () => controller.abort();
  }, [date]);

  const departmentItems = useMemo(() => {
    const counts = new Map<string, number>();
    employees.forEach((employee) => {
      const name =
        employee.department?.trim() || t("reportsAnalyticsPage.unassigned");
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return [...counts]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [employees, t]);
  const employmentItems = employmentTypes.map((type) => ({
    label: t(`employeeDirectory.employmentTypes.${type}`),
    value: employees.filter((employee) => employee.employmentType === type)
      .length,
  }));
  const attendanceSummary = attendance?.summary;
  const attendanceItems = [
    {
      label: t("reportsAnalyticsPage.attendance.present"),
      value: attendanceSummary?.presentCount ?? 0,
      tone: "bg-success-500",
    },
    {
      label: t("reportsAnalyticsPage.attendance.late"),
      value: attendanceSummary?.lateCount ?? 0,
      tone: "bg-warning-500",
    },
    {
      label: t("reportsAnalyticsPage.attendance.absent"),
      value: attendanceSummary?.absentCount ?? 0,
      tone: "bg-error-500",
    },
    {
      label: t("reportsAnalyticsPage.attendance.onLeave"),
      value: attendanceSummary?.onLeaveCount ?? 0,
      tone: "bg-brand-500",
    },
    {
      label: t("reportsAnalyticsPage.attendance.notRecorded"),
      value: Math.max(
        0,
        (attendanceSummary?.employeeCount ?? 0) -
          (attendanceSummary?.recordedCount ?? 0),
      ),
      tone: "bg-gray-400",
    },
  ];
  const metrics = [
    {
      label: t("reportsAnalyticsPage.stats.employees"),
      value: employees.length,
      icon: <UserCircleIcon className="size-5" />,
      tone: "brand" as const,
    },
    {
      label: t("reportsAnalyticsPage.stats.present"),
      value: attendanceSummary?.presentCount ?? null,
      icon: <CheckLineIcon className="size-5" />,
      tone: "success" as const,
    },
    {
      label: t("reportsAnalyticsPage.stats.late"),
      value: attendanceSummary?.lateCount ?? null,
      icon: <ClockIcon className="size-5" />,
      tone: "warning" as const,
    },
    {
      label: t("reportsAnalyticsPage.stats.pendingLeave"),
      value: leaveReport?.summary.pendingCount ?? null,
      icon: <CalenderIcon className="size-5" />,
      tone: "purple" as const,
    },
  ];

  return (
    <>
      <PageMeta
        title={`${t("reportsAnalyticsPage.title")} | ERIS`}
        description={t("reportsAnalyticsPage.description")}
      />
      <div className="space-y-6">
        <PageBreadcrumb pageTitle={t("reportsAnalyticsPage.title")} />
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
              {t("reportsAnalyticsPage.title")}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              {t("reportsAnalyticsPage.description")}
            </p>
          </div>
          <label className="flex flex-col gap-1.5 text-sm text-gray-600 dark:text-gray-300">
            <span>{t("reportsAnalyticsPage.attendanceDate")}</span>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="min-w-44"
            />
          </label>
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
          aria-label={t("reportsAnalyticsPage.overview")}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {metrics.map((metric) => (
            <HrStatCard
              key={metric.label}
              label={metric.label}
              value={
                isLoading || metric.value === null
                  ? "—"
                  : numberFormat.format(metric.value)
              }
              icon={metric.icon}
              tone={metric.tone}
            />
          ))}
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ModuleSection
            title={t("reportsAnalyticsPage.attendance.title")}
            description={t("reportsAnalyticsPage.attendance.description")}
          >
            <div className="space-y-4">
              {attendanceItems.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <span
                        className={`size-2 rounded-full ${item.tone}`}
                        aria-hidden="true"
                      />
                      {item.label}
                    </span>
                    <span className="font-medium text-gray-800 dark:text-white/90">
                      {isLoading ? "—" : numberFormat.format(item.value)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full ${item.tone}`}
                      style={{
                        width: attendanceSummary?.employeeCount
                          ? `${(item.value / attendanceSummary.employeeCount) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ModuleSection>

          <ModuleSection
            title={t("reportsAnalyticsPage.departments.title")}
            description={t("reportsAnalyticsPage.departments.description")}
          >
            {isLoading ? (
              <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                {t("reportsAnalyticsPage.loading")}
              </p>
            ) : (
              <BarList
                items={departmentItems}
                emptyLabel={t("reportsAnalyticsPage.empty")}
              />
            )}
          </ModuleSection>

          <ModuleSection
            title={t("reportsAnalyticsPage.employment.title")}
            description={t("reportsAnalyticsPage.employment.description")}
          >
            {isLoading ? (
              <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                {t("reportsAnalyticsPage.loading")}
              </p>
            ) : (
              <BarList
                items={employmentItems}
                emptyLabel={t("reportsAnalyticsPage.empty")}
              />
            )}
          </ModuleSection>

          <ModuleSection
            title={t("reportsAnalyticsPage.leave.title")}
            description={t("reportsAnalyticsPage.leave.description")}
          >
            {leaveRestricted ? (
              <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                {t("reportsAnalyticsPage.leave.restricted")}
              </p>
            ) : leaveReport ? (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(["pending", "approved", "rejected"] as const).map(
                  (status) => (
                    <div
                      key={status}
                      className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                    >
                      <dt className="text-sm text-gray-500 dark:text-gray-400">
                        {t(`reportsAnalyticsPage.leave.statuses.${status}`)}
                      </dt>
                      <dd className="mt-2 text-xl font-semibold text-gray-800 dark:text-white/90">
                        {isLoading
                          ? "—"
                          : numberFormat.format(
                              leaveReport.summary[`${status}Count`],
                            )}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            ) : (
              <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                {isLoading
                  ? t("reportsAnalyticsPage.loading")
                  : t("reportsAnalyticsPage.leave.empty")}
              </p>
            )}
          </ModuleSection>
        </div>
      </div>
    </>
  );
}
