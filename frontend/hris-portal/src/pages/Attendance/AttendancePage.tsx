import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import { Card } from "@/components/ui/card";
import Input from "@/components/form/input/InputField";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function attendanceStatusBadgeColor(status: AttendanceRecordStatus | null) {
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
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/5">
                    <Table className="min-w-[900px] text-left rtl:text-right">
                      <TableHeader className="border-b border-gray-100 dark:border-white/5">
                        <TableRow>
                          <TableCell
                            isHeader
                            className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400"
                          >
                            {t("attendancePage.employee")}
                          </TableCell>
                          <TableCell
                            isHeader
                            className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400"
                          >
                            {t("attendancePage.department")}
                          </TableCell>
                          <TableCell
                            isHeader
                            className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400"
                          >
                            {t("attendancePage.status")}
                          </TableCell>
                          <TableCell
                            isHeader
                            className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400"
                          >
                            {t("attendancePage.clockIn")}
                          </TableCell>
                          <TableCell
                            isHeader
                            className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400"
                          >
                            {t("attendancePage.clockOut")}
                          </TableCell>
                          <TableCell
                            isHeader
                            className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400"
                          >
                            {t("attendancePage.hours")}
                          </TableCell>
                          <TableCell
                            isHeader
                            className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400"
                          >
                            {t("attendancePage.actions")}
                          </TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-gray-100 dark:divide-white/5">
                        {visibleRecords.map((record) => {
                          const isEditing =
                            editingEmployeeId === record.employeeId &&
                            draft !== null;
                          const isSaving =
                            savingEmployeeId === record.employeeId;
                          return (
                            <Fragment key={record.employeeId}>
                              <TableRow
                                key={record.employeeId}
                                className="transition-colors hover:bg-gray-50 dark:hover:bg-white/3"
                              >
                                <TableCell className="px-5 py-4 text-start">
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
                                </TableCell>
                                <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                                  {record.department ||
                                    t("attendancePage.unassigned")}
                                </TableCell>
                                <TableCell className="px-5 py-4 text-start">
                                  <Badge
                                    size="sm"
                                    color={attendanceStatusBadgeColor(
                                      record.status,
                                    )}
                                  >
                                    {t(
                                      `attendancePage.statuses.${record.status ?? "unrecorded"}`,
                                    )}
                                  </Badge>
                                </TableCell>
                                <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                                  {record.clockIn || "—"}
                                </TableCell>
                                <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                                  {record.clockOut || "—"}
                                </TableCell>
                                <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                                  {record.hoursWorked === null
                                    ? "—"
                                    : `${numberFormat.format(record.hoursWorked)} h`}
                                </TableCell>
                                <TableCell className="px-5 py-4 text-start">
                                  <Button
                                    type="button"
                                    onClick={() =>
                                      isEditing
                                        ? cancelEditing()
                                        : beginEditing(record)
                                    }
                                    disabled={isSaving}
                                    variant="outline"
                                    size="sm"
                                    className="!px-3 !py-2"
                                  >
                                    {isEditing
                                      ? t("attendancePage.cancel")
                                      : record.id
                                        ? t("attendancePage.edit")
                                        : t("attendancePage.record")}
                                  </Button>
                                </TableCell>
                              </TableRow>
                              {isEditing && draft && (
                                <TableRow key={`${record.employeeId}-editor`}>
                                  <TableCell colSpan={7} className="px-5 py-4">
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
                                      <Button
                                        type="button"
                                        onClick={cancelEditing}
                                        disabled={isSaving}
                                        variant="outline"
                                        size="sm"
                                      >
                                        {t("attendancePage.cancel")}
                                      </Button>
                                      <Button
                                        type="button"
                                        onClick={() =>
                                          void saveAttendance(record)
                                        }
                                        disabled={isSaving}
                                        size="sm"
                                      >
                                        {isSaving
                                          ? t("attendancePage.saving")
                                          : t("attendancePage.save")}
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
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
