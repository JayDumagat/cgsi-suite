import { ArrowDownIcon, ArrowUpIcon } from "@/icons";
import { getAttendanceDisplayStatus } from "@/components/attendance/attendanceStatus";
import type {
  AttendanceDailyReport,
  EmployeeLeaveRequest,
} from "@/components/employee-directory/employeeDirectoryApi";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface AttendanceRateCardProps {
  currentReports: AttendanceDailyReport[];
  previousReports: AttendanceDailyReport[];
  leaveRequests: EmployeeLeaveRequest[];
  period: "day" | "week" | "month";
  isLoading: boolean;
  loadErrorKey: string | null;
  description?: string;
}

interface AttendanceRateSummary {
  expectedEmployees: number;
  onTimeEmployees: number;
  lateEmployees: number;
  notAttendedEmployees: number;
  rate: number | null;
}

function getTodayDateKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function summarizeAttendance(
  reports: AttendanceDailyReport[],
  leaveRequests: EmployeeLeaveRequest[],
  asOfDate: string,
): AttendanceRateSummary {
  const summary: AttendanceRateSummary = {
    expectedEmployees: 0,
    onTimeEmployees: 0,
    lateEmployees: 0,
    notAttendedEmployees: 0,
    rate: null,
  };

  for (const report of reports) {
    if (report.date > asOfDate) continue;
    const date = new Date(`${report.date}T00:00:00`);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (const record of report.items) {
      const status = getAttendanceDisplayStatus(record, report.date, leaveRequests);
      if (
        status === "on_leave" ||
        status === "sick_leave" ||
        status === "vacation_leave" ||
        status === "half_day_sick_leave" ||
        status === "half_day_vacation_leave" ||
        status === "nuptial" ||
        status === "bereavement"
      ) {
        continue;
      }

      summary.expectedEmployees += 1;
      if (status === "present" || status === "official_business") {
        summary.onTimeEmployees += 1;
      } else if (status === "late") {
        summary.lateEmployees += 1;
      } else {
        summary.notAttendedEmployees += 1;
      }
    }
  }

  summary.rate = summary.expectedEmployees
    ? (summary.onTimeEmployees + summary.lateEmployees) /
      summary.expectedEmployees
    : null;
  return summary;
}

export default function AttendanceRateCard({
  currentReports,
  previousReports,
  leaveRequests,
  period,
  isLoading,
  loadErrorKey,
  description,
}: AttendanceRateCardProps) {
  const { t, i18n } = useTranslation();
  const todayDateKey = getTodayDateKey();
  const currentSummary = useMemo(
    () => summarizeAttendance(currentReports, leaveRequests, todayDateKey),
    [currentReports, leaveRequests, todayDateKey],
  );
  const previousSummary = useMemo(
    () => summarizeAttendance(previousReports, leaveRequests, todayDateKey),
    [leaveRequests, previousReports, todayDateKey],
  );
  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, {
        style: "percent",
        maximumFractionDigits: 1,
      }),
    [i18n.language],
  );
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }),
    [i18n.language],
  );
  const deltaFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }),
    [i18n.language],
  );
  const comparisonDelta =
    currentSummary.rate !== null && previousSummary.rate !== null
      ? (currentSummary.rate - previousSummary.rate) * 100
      : null;
  const rows = [
    {
      key: "onTime",
      label: t("attendancePage.rate.onTime"),
      value: currentSummary.onTimeEmployees,
      color: "bg-success-500",
    },
    {
      key: "late",
      label: t("attendancePage.rate.late"),
      value: currentSummary.lateEmployees,
      color: "bg-warning-500",
    },
    {
      key: "notAttended",
      label: t(
        period === "day"
          ? "attendancePage.rate.notAttended"
          : "attendancePage.rate.noRecord",
      ),
      value: currentSummary.notAttendedEmployees,
      color: "bg-gray-400",
    },
  ];
  const distributionSlots = Array.from({ length: 42 }, (_, index) => {
    const point = ((index + 0.5) / 42) * currentSummary.expectedEmployees;
    let total = 0;
    for (const row of rows) {
      total += row.value;
      if (point < total) return row.color;
    }
    return "bg-gray-200 dark:bg-gray-700";
  });

  return (
    <section
      aria-labelledby="attendance-rate-heading"
      className="w-full rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3"
    >
      <div className="mb-4">
        <h2
          id="attendance-rate-heading"
          className="text-lg font-medium text-gray-800 dark:text-white/90"
        >
          {t("attendancePage.rate.title")}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {description ?? t("attendancePage.rate.description")}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <h3 className="text-3xl text-gray-800 dark:text-white/90">
          {isLoading || loadErrorKey || currentSummary.rate === null
            ? "—"
            : percentFormatter.format(currentSummary.rate)}
        </h3>
        {comparisonDelta !== null && !isLoading && !loadErrorKey && (
          <>
            <span
              className={`flex items-center gap-1 text-sm ${comparisonDelta > 0 ? "text-success-600" : comparisonDelta < 0 ? "text-error-600" : "text-gray-500 dark:text-gray-400"}`}
            >
              {comparisonDelta > 0 ? (
                <ArrowUpIcon className="size-4" />
              ) : comparisonDelta < 0 ? (
                <ArrowDownIcon className="size-4" />
              ) : (
                <span aria-hidden="true">—</span>
              )}
              {t("attendancePage.rate.percentagePointChange", {
                change: deltaFormatter.format(Math.abs(comparisonDelta)),
              })}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t(
                comparisonDelta > 0
                  ? "attendancePage.rate.increasedVsPreviousPeriod"
                  : comparisonDelta < 0
                    ? "attendancePage.rate.decreasedVsPreviousPeriod"
                    : "attendancePage.rate.unchangedVsPreviousPeriod",
              )}
            </span>
          </>
        )}
      </div>

      <div
        className="grid h-8 grid-cols-[repeat(42,minmax(0,1fr))] gap-1"
        role="img"
        aria-label={t("attendancePage.rate.title")}
      >
        {distributionSlots.map((color, index) => (
          <span
            key={index}
            className={`rounded-sm ${isLoading || loadErrorKey ? "bg-gray-200 dark:bg-gray-700" : color}`}
          />
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          {rows.map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className={`inline-block size-2 rounded-full ${color}`}
                aria-hidden="true"
              />
              <span className="text-sm text-gray-700 dark:text-gray-400">
                {label}
              </span>
            </div>
          ))}
        </div>
        {loadErrorKey ? (
          <p
            className="p-4 text-sm text-error-600 dark:text-error-400"
            role="alert"
          >
            {t(loadErrorKey)}
          </p>
        ) : (
          <div className="p-4">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="pb-2 text-start text-sm font-normal text-gray-400">
                    {t("attendancePage.rate.table.status")}
                  </th>
                  <th className="pb-2 text-start text-sm font-normal text-gray-400">
                    {t(
                      period === "day"
                        ? "attendancePage.rate.table.metric"
                        : "attendancePage.rate.table.employeeDays",
                    )}
                  </th>
                  <th className="pb-2 text-end text-sm font-normal text-gray-400">
                    {t("attendancePage.rate.table.total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ key, label, value }) => (
                  <tr key={key}>
                    <td className="py-2 text-sm text-gray-700 dark:text-gray-400">
                      {label}
                    </td>
                    <td className="py-2 text-sm text-gray-700 dark:text-gray-400">
                      {numberFormatter.format(value)}
                    </td>
                    <td className="py-2 text-end text-sm text-gray-700 dark:text-gray-400">
                      {currentSummary.expectedEmployees > 0
                        ? percentFormatter.format(
                            value / currentSummary.expectedEmployees,
                          )
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
