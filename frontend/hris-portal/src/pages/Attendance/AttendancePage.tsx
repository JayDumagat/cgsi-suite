import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import { Card } from "@/components/ui/card";
import Input from "@/components/form/input/InputField";
import {
  EmployeeDirectoryRequestError,
  getAttendanceReport,
  updateAttendanceRecord,
  type AttendanceDailyReport,
  type AttendanceRecordStatus,
  type EmployeeAttendanceRecord,
} from "@/components/employee-directory/employeeDirectoryApi";
import { CheckLineIcon, ClockIcon, UserCircleIcon } from "@/icons";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

interface AttendanceDraft {
  status: AttendanceRecordStatus;
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  notes: string;
}

function todayAsInput() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function attendanceStatusClass(status: AttendanceRecordStatus | null) {
  switch (status) {
    case "present":
      return "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400";
    case "late":
      return "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400";
    case "absent":
      return "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400";
    case "on_leave":
      return "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400";
  }
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

function createDraft(record: EmployeeAttendanceRecord): AttendanceDraft {
  return {
    status: record.status ?? "present",
    clockIn: record.clockIn ?? "",
    clockOut: record.clockOut ?? "",
    breakMinutes: record.breakMinutes,
    notes: record.notes ?? "",
  };
}

export default function AttendancePage() {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState(todayAsInput);
  const [search, setSearch] = useState("");
  const [report, setReport] = useState<AttendanceDailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrorKey, setLoadErrorKey] = useState<string | null>(null);
  const [saveErrorKey, setSaveErrorKey] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(
    null,
  );
  const [draft, setDraft] = useState<AttendanceDraft | null>(null);
  const [savingEmployeeId, setSavingEmployeeId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language],
  );
  const dateLabel = useMemo(() => {
    const parsed = new Date(`${date}T00:00:00`);
    return Number.isFinite(parsed.getTime())
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }).format(
          parsed,
        )
      : date;
  }, [date, i18n.language]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadErrorKey(null);
    setSaveErrorKey(null);
    void getAttendanceReport(date, "", controller.signal)
      .then(setReport)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setReport(null);
        setLoadErrorKey(attendanceErrorKey(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [date, refreshVersion]);

  const summary = report?.summary;
  const statCards = [
    {
      label: t("attendancePage.summary.present"),
      value: summary?.presentCount ?? 0,
      icon: <CheckLineIcon className="size-5" aria-hidden="true" />,
    },
    {
      label: t("attendancePage.summary.late"),
      value: summary?.lateCount ?? 0,
      icon: <ClockIcon className="size-5" aria-hidden="true" />,
    },
    {
      label: t("attendancePage.summary.absent"),
      value: summary?.absentCount ?? 0,
      icon: <UserCircleIcon className="size-5" aria-hidden="true" />,
    },
    {
      label: t("attendancePage.summary.onLeave"),
      value: summary?.onLeaveCount ?? 0,
      icon: <ClockIcon className="size-5" aria-hidden="true" />,
    },
  ];
  const searchQuery = search.trim().toLocaleLowerCase();
  const visibleRecords = (report?.items ?? []).filter((record) => {
    if (!searchQuery) return true;
    return [
      record.displayName,
      record.employeeNumber,
      record.department,
      record.jobTitle,
      record.workEmail,
    ].some((value) => value?.toLocaleLowerCase().includes(searchQuery));
  });

  const beginEditing = (record: EmployeeAttendanceRecord) => {
    setEditingEmployeeId(record.employeeId);
    setDraft(createDraft(record));
    setSaveErrorKey(null);
    setSavedMessage(false);
  };

  const cancelEditing = () => {
    setEditingEmployeeId(null);
    setDraft(null);
    setSaveErrorKey(null);
  };

  const updateDraft = (change: Partial<AttendanceDraft>) => {
    setDraft((current) => (current ? { ...current, ...change } : current));
  };

  const saveAttendance = async (record: EmployeeAttendanceRecord) => {
    if (!draft) return;
    setSavingEmployeeId(record.employeeId);
    setSaveErrorKey(null);
    try {
      await updateAttendanceRecord(record.employeeId, date, {
        status: draft.status,
        clockIn: draft.clockIn || null,
        clockOut: draft.clockOut || null,
        breakMinutes: draft.breakMinutes,
        notes: draft.notes.trim() || null,
      });
      setEditingEmployeeId(null);
      setDraft(null);
      setSavedMessage(true);
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      setSaveErrorKey(
        attendanceErrorKey(error) === "attendancePage.errors.loadFailed"
          ? "attendancePage.errors.saveFailed"
          : attendanceErrorKey(error),
      );
    } finally {
      setSavingEmployeeId(null);
    }
  };

  return (
    <>
      <PageMeta
        title={`${t("attendancePage.title")} | ERIS`}
        description={t("attendancePage.description")}
      />
      <div className="space-y-6">
        <PageBreadcrumb pageTitle={t("attendancePage.title")} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("attendancePage.description")}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              {dateLabel}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="attendance-date">
              {t("attendancePage.date")}
            </label>
            <Input
              id="attendance-date"
              type="date"
              value={date}
              onChange={(event) =>
                setDate(event.target.value || todayAsInput())
              }
              className="sm:w-44"
            />
            <label className="sr-only" htmlFor="attendance-search">
              {t("attendancePage.search")}
            </label>
            <Input
              id="attendance-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("attendancePage.search")}
              className="sm:w-64"
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
        ) : (
          <>
            <section
              aria-label={t("attendancePage.summary.title")}
              className="grid grid-cols-2 gap-3 xl:grid-cols-4"
            >
              {statCards.map((card) => (
                <Card key={card.label}>
                  <article>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {card.label}
                      </p>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                        {card.icon}
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-gray-800 dark:text-white/90">
                      {isLoading ? "—" : numberFormat.format(card.value)}
                    </p>
                  </article>
                </Card>
              ))}
            </section>

            <Card>
              <section
                aria-labelledby="attendance-records-heading"
                className="space-y-4"
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2
                      id="attendance-records-heading"
                      className="text-lg font-semibold text-gray-800 dark:text-white/90"
                    >
                      {t("attendancePage.recordsTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {t("attendancePage.recordsCount", {
                        count: numberFormat.format(visibleRecords.length),
                      })}
                    </p>
                  </div>
                  <Link
                    to="/employees"
                    className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
                  >
                    {t("attendancePage.viewEmployees")}
                  </Link>
                </div>

                {saveErrorKey && (
                  <p
                    className="text-sm text-error-600 dark:text-error-400"
                    role="alert"
                  >
                    {t(saveErrorKey)}
                  </p>
                )}
                {savedMessage && (
                  <p
                    className="text-sm text-success-700 dark:text-success-400"
                    role="status"
                  >
                    {t("attendancePage.saved")}
                  </p>
                )}

                {isLoading ? (
                  <p className="py-8 text-sm text-gray-500 dark:text-gray-400">
                    {t("attendancePage.loading")}
                  </p>
                ) : visibleRecords.length === 0 ? (
                  <div className="border-y border-gray-200 py-10 text-center dark:border-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {(report?.items.length ?? 0) === 0
                        ? t("attendancePage.noEmployees")
                        : t("attendancePage.noMatches")}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border-y border-gray-200 dark:border-gray-800">
                    <table className="w-full min-w-[900px] text-left rtl:text-right">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs tracking-wide text-gray-400 uppercase dark:border-gray-800">
                          <th scope="col" className="px-3 py-3 font-medium">
                            {t("attendancePage.employee")}
                          </th>
                          <th scope="col" className="px-3 py-3 font-medium">
                            {t("attendancePage.department")}
                          </th>
                          <th scope="col" className="px-3 py-3 font-medium">
                            {t("attendancePage.status")}
                          </th>
                          <th scope="col" className="px-3 py-3 font-medium">
                            {t("attendancePage.clockIn")}
                          </th>
                          <th scope="col" className="px-3 py-3 font-medium">
                            {t("attendancePage.clockOut")}
                          </th>
                          <th scope="col" className="px-3 py-3 font-medium">
                            {t("attendancePage.hours")}
                          </th>
                          <th scope="col" className="px-3 py-3 font-medium">
                            {t("attendancePage.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {visibleRecords.map((record) => {
                          const isEditing =
                            editingEmployeeId === record.employeeId &&
                            draft !== null;
                          const isSaving =
                            savingEmployeeId === record.employeeId;
                          return (
                            <Fragment key={record.employeeId}>
                              <tr
                                key={record.employeeId}
                                className="transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02]"
                              >
                                <td className="px-3 py-3.5">
                                  <Link
                                    to={`/employees/${record.employeeId}`}
                                    className="min-w-0"
                                  >
                                    <span className="block truncate text-sm font-medium text-gray-800 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-300">
                                      {record.displayName}
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                                      {record.employeeNumber ||
                                        record.workEmail}
                                    </span>
                                  </Link>
                                </td>
                                <td className="px-3 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                                  {record.department ||
                                    t("attendancePage.unassigned")}
                                </td>
                                <td className="px-3 py-3.5">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${attendanceStatusClass(record.status)}`}
                                  >
                                    {t(
                                      `attendancePage.statuses.${record.status ?? "unrecorded"}`,
                                    )}
                                  </span>
                                </td>
                                <td className="px-3 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                                  {record.clockIn || "—"}
                                </td>
                                <td className="px-3 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                                  {record.clockOut || "—"}
                                </td>
                                <td className="px-3 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                                  {record.hoursWorked === null
                                    ? "—"
                                    : `${numberFormat.format(record.hoursWorked)} h`}
                                </td>
                                <td className="px-3 py-3.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      isEditing
                                        ? cancelEditing()
                                        : beginEditing(record)
                                    }
                                    disabled={isSaving}
                                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                                  >
                                    {isEditing
                                      ? t("attendancePage.cancel")
                                      : record.id
                                        ? t("attendancePage.edit")
                                        : t("attendancePage.record")}
                                  </button>
                                </td>
                              </tr>
                              {isEditing && draft && (
                                <tr key={`${record.employeeId}-editor`}>
                                  <td colSpan={7} className="px-3 py-4">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                                      <label className="space-y-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                                        <span>
                                          {t("attendancePage.status")}
                                        </span>
                                        <select
                                          value={draft.status}
                                          onChange={(event) => {
                                            const status = event.target
                                              .value as AttendanceRecordStatus;
                                            updateDraft({
                                              status,
                                              ...(status === "absent" ||
                                              status === "on_leave"
                                                ? { clockIn: "", clockOut: "" }
                                                : {}),
                                            });
                                          }}
                                          className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-400 dark:border-gray-700 dark:text-white/90"
                                        >
                                          {(
                                            [
                                              "present",
                                              "late",
                                              "absent",
                                              "on_leave",
                                            ] as const
                                          ).map((status) => (
                                            <option key={status} value={status}>
                                              {t(
                                                `attendancePage.statuses.${status}`,
                                              )}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <label className="space-y-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                                        <span>
                                          {t("attendancePage.clockIn")}
                                        </span>
                                        <Input
                                          type="time"
                                          value={draft.clockIn}
                                          disabled={
                                            draft.status === "absent" ||
                                            draft.status === "on_leave"
                                          }
                                          onChange={(event) =>
                                            updateDraft({
                                              clockIn: event.target.value,
                                            })
                                          }
                                        />
                                      </label>
                                      <label className="space-y-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                                        <span>
                                          {t("attendancePage.clockOut")}
                                        </span>
                                        <Input
                                          type="time"
                                          value={draft.clockOut}
                                          disabled={
                                            draft.status === "absent" ||
                                            draft.status === "on_leave"
                                          }
                                          onChange={(event) =>
                                            updateDraft({
                                              clockOut: event.target.value,
                                            })
                                          }
                                        />
                                      </label>
                                      <label className="space-y-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                                        <span>
                                          {t("attendancePage.breakMinutes")}
                                        </span>
                                        <Input
                                          type="number"
                                          min={0}
                                          max={1440}
                                          step={1}
                                          value={draft.breakMinutes}
                                          disabled={
                                            draft.status === "absent" ||
                                            draft.status === "on_leave"
                                          }
                                          onChange={(event) =>
                                            updateDraft({
                                              breakMinutes: Math.max(
                                                0,
                                                Number(event.target.value) || 0,
                                              ),
                                            })
                                          }
                                        />
                                      </label>
                                      <label className="space-y-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                                        <span>{t("attendancePage.notes")}</span>
                                        <Input
                                          maxLength={1000}
                                          value={draft.notes}
                                          onChange={(event) =>
                                            updateDraft({
                                              notes: event.target.value,
                                            })
                                          }
                                        />
                                      </label>
                                    </div>
                                    <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                                      <button
                                        type="button"
                                        onClick={cancelEditing}
                                        disabled={isSaving}
                                        className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                                      >
                                        {t("attendancePage.cancel")}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void saveAttendance(record)
                                        }
                                        disabled={isSaving}
                                        className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
                                      >
                                        {isSaving
                                          ? t("attendancePage.saving")
                                          : t("attendancePage.save")}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
