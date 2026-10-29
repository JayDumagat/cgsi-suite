import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import { Card } from "@/components/ui/card";
import Input from "@/components/form/input/InputField";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import DataTableThree, {
  type DataTableThreeColumn,
} from "@/components/tables/DataTables/TableThree/DataTableThree";
import { TabButton } from "@/components/ui/tabs/TabWithUnderline";
import {
  createLeaveRequest,
  decideLeaveRequest,
  EmployeeDirectoryRequestError,
  getLeaveManagementReport,
  listEmployees,
  type EmployeeDirectoryItem,
  type EmployeeLeaveRequest,
  type EmployeeLeaveRequestStatus,
  type EmployeeLeaveType,
} from "@/components/employee-directory/employeeDirectoryApi";
import {
  CheckLineIcon,
  CloseLineIcon,
  ClockIcon,
  UserCircleIcon,
} from "@/icons";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

type RequestFilter = "all" | EmployeeLeaveRequestStatus;

interface LeaveRequestDraft {
  employeeId: string;
  leaveType: EmployeeLeaveType;
  startDate: string;
  endDate: string;
  requestedDays: string;
  reason: string;
}

function todayAsInput() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string, locale: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date)
    : value;
}

function requestStatusBadgeColor(status: EmployeeLeaveRequestStatus) {
  switch (status) {
    case "approved":
      return "success" as const;
    case "rejected":
      return "error" as const;
    default:
      return "warning" as const;
  }
}

function leaveErrorKey(error: unknown, fallback: string) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden")
      return "employeeDirectory.errors.accessDenied";
    if (error.code === "leave_request_overlap")
      return "leaveManagementPage.errors.overlap";
    if (error.code === "leave_request_not_pending")
      return "leaveManagementPage.errors.notPending";
  }
  return fallback;
}

function makeBlankDraft(employeeId = ""): LeaveRequestDraft {
  const today = todayAsInput();
  return {
    employeeId,
    leaveType: "annual",
    startDate: today,
    endDate: today,
    requestedDays: "1",
    reason: "",
  };
}

export default function LeaveManagementPage() {
  const { t, i18n } = useTranslation();
  const [report, setReport] = useState<{
    summary: {
      pendingCount: number;
      approvedCount: number;
      rejectedCount: number;
      onLeaveTodayCount: number;
    };
    items: EmployeeLeaveRequest[];
  } | null>(null);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrorKey, setLoadErrorKey] = useState<string | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RequestFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draft, setDraft] = useState<LeaveRequestDraft>(() => makeBlankDraft());
  const [isCreating, setIsCreating] = useState(false);
  const [savingRequestId, setSavingRequestId] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }),
    [i18n.language],
  );

  useEffect(() => {
    const controller = new AbortController();
    void listEmployees(
      {
        query: "",
        page: 1,
        pageSize: 100,
        sortBy: "displayName",
        sortOrder: "asc",
      },
      controller.signal,
    )
      .then((directory) => {
        const eligibleEmployees = directory.items.filter(
          (employee) =>
            employee.employmentStatus === "active" ||
            employee.employmentStatus === "on_leave",
        );
        setEmployees(eligibleEmployees);
        setDraft((current) =>
          current.employeeId || !eligibleEmployees[0]
            ? current
            : { ...current, employeeId: eligibleEmployees[0].id },
        );
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoadErrorKey(
            leaveErrorKey(error, "leaveManagementPage.errors.loadFailed"),
          );
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadErrorKey(null);
    void getLeaveManagementReport(controller.signal)
      .then(setReport)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setReport(null);
          setLoadErrorKey(
            leaveErrorKey(error, "leaveManagementPage.errors.loadFailed"),
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [refreshVersion]);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (report?.items ?? []).filter((request) => {
      if (filter !== "all" && request.status !== filter) return false;
      if (!query) return true;
      return (
        [
          request.employeeName,
          request.employeeNumber,
          request.department,
          request.reason,
        ].some((value) => value?.toLocaleLowerCase().includes(query)) ||
        t(`leaveManagementPage.leaveTypes.${request.leaveType}`)
          .toLocaleLowerCase()
          .includes(query)
      );
    });
  }, [filter, report, search, t]);

  const pageCount = Math.max(1, Math.ceil(visibleRequests.length / pageSize));
  const firstVisibleIndex = visibleRequests.length === 0
    ? 0
    : (page - 1) * pageSize + 1;
  const lastVisibleIndex = Math.min(page * pageSize, visibleRequests.length);
  const pageRequests = visibleRequests.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const summaryCards = [
    {
      label: t("leaveManagementPage.summary.pending"),
      value: report?.summary.pendingCount ?? 0,
      icon: <ClockIcon className="size-5" aria-hidden="true" />,
      className:
        "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
    },
    {
      label: t("leaveManagementPage.summary.approved"),
      value: report?.summary.approvedCount ?? 0,
      icon: <CheckLineIcon className="size-5" aria-hidden="true" />,
      className:
        "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
    },
    {
      label: t("leaveManagementPage.summary.rejected"),
      value: report?.summary.rejectedCount ?? 0,
      icon: <CloseLineIcon className="size-5" aria-hidden="true" />,
      className:
        "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400",
    },
    {
      label: t("leaveManagementPage.summary.onLeaveToday"),
      value: report?.summary.onLeaveTodayCount ?? 0,
      icon: <UserCircleIcon className="size-5" aria-hidden="true" />,
      className:
        "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
    },
  ];

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setActionErrorKey(null);
    setSuccessKey(null);
    try {
      await createLeaveRequest({
        employeeId: draft.employeeId,
        leaveType: draft.leaveType,
        startDate: draft.startDate,
        endDate: draft.endDate,
        requestedDays: Number(draft.requestedDays),
        reason: draft.reason.trim(),
      });
      setIsCreateOpen(false);
      setDraft(makeBlankDraft(employees[0]?.id ?? ""));
      setPage(1);
      setSuccessKey("leaveManagementPage.messages.created");
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      setActionErrorKey(
        leaveErrorKey(error, "leaveManagementPage.errors.saveFailed"),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDecision = async (
    request: EmployeeLeaveRequest,
    status: "approved" | "rejected",
  ) => {
    setSavingRequestId(request.id);
    setActionErrorKey(null);
    setSuccessKey(null);
    try {
      await decideLeaveRequest(request.id, { status, decisionNote: null });
      setSelectedRequestIds((current) => {
        const next = new Set(current);
        next.delete(request.id);
        return next;
      });
      setSuccessKey(
        status === "approved"
          ? "leaveManagementPage.messages.approved"
          : "leaveManagementPage.messages.rejected",
      );
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      setActionErrorKey(
        leaveErrorKey(error, "leaveManagementPage.errors.saveFailed"),
      );
    } finally {
      setSavingRequestId(null);
    }
  };

  const filters: RequestFilter[] = ["all", "pending", "approved", "rejected"];
  const requestColumns = useMemo<DataTableThreeColumn<EmployeeLeaveRequest>[]>(
    () => [
      {
        key: "employee",
        label: t("leaveManagementPage.columns.employee"),
        className: "min-w-56",
        render: (request) => (
          <Link to={`/employees/${request.employeeId}`} className="block min-w-0">
            <span className="block truncate text-sm font-medium text-gray-800 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-300">
              {request.employeeName}
            </span>
            <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
              {request.employeeNumber || request.department || "—"}
            </span>
          </Link>
        ),
      },
      {
        key: "leaveType",
        label: t("leaveManagementPage.columns.leaveType"),
        className: "min-w-32",
        render: (request) => t(`leaveManagementPage.leaveTypes.${request.leaveType}`),
      },
      {
        key: "dates",
        label: t("leaveManagementPage.columns.dates"),
        className: "min-w-52",
        render: (request) => (
          <span className="whitespace-nowrap">
            {formatDate(request.startDate, i18n.language)} – {formatDate(request.endDate, i18n.language)}
          </span>
        ),
      },
      {
        key: "days",
        label: t("leaveManagementPage.columns.days"),
        className: "min-w-20",
        render: (request) => numberFormat.format(request.requestedDays),
      },
      {
        key: "reason",
        label: t("leaveManagementPage.columns.reason"),
        className: "max-w-64 min-w-48",
        render: (request) => <span className="line-clamp-2">{request.reason}</span>,
      },
      {
        key: "status",
        label: t("leaveManagementPage.columns.status"),
        className: "min-w-28",
        render: (request) => (
          <Badge size="sm" color={requestStatusBadgeColor(request.status)}>
            {t(`leaveManagementPage.statuses.${request.status}`)}
          </Badge>
        ),
      },
      {
        key: "actions",
        label: t("leaveManagementPage.columns.actions"),
        className: "min-w-52",
        render: (request) => {
          const isSaving = savingRequestId === request.id;
          if (request.status !== "pending") {
            return request.decidedByName ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {request.decidedByName}
              </span>
            ) : <span className="text-sm text-gray-400">—</span>;
          }
          return (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDecision(request, "approved")}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-success-200 px-3 py-2 text-xs font-medium text-success-700 transition hover:bg-success-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-success-500/30 dark:text-success-400 dark:hover:bg-success-500/10"
              >
                <CheckLineIcon className="size-4" aria-hidden="true" />
                {t("leaveManagementPage.actions.approve")}
              </button>
              <button
                type="button"
                onClick={() => void handleDecision(request, "rejected")}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-error-200 px-3 py-2 text-xs font-medium text-error-700 transition hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-error-500/30 dark:text-error-400 dark:hover:bg-error-500/10"
              >
                <CloseLineIcon className="size-4" aria-hidden="true" />
                {t("leaveManagementPage.actions.reject")}
              </button>
            </div>
          );
        },
      },
    ],
    [handleDecision, i18n.language, numberFormat, savingRequestId, t],
  );

  return (
    <>
      <PageMeta
        title={`${t("leaveManagementPage.title")} | ERIS`}
        description={t("leaveManagementPage.description")}
      />
      <div className="space-y-6">
        <PageBreadcrumb
          pageTitle={t("leaveManagementPage.title")}
          showPageTitle={false}
        />
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
              {t("leaveManagementPage.title")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("leaveManagementPage.description")}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setActionErrorKey(null);
              setSuccessKey(null);
              setIsCreateOpen((open) => !open);
            }}
            size="sm"
          >
            {isCreateOpen
              ? t("leaveManagementPage.form.close")
              : t("leaveManagementPage.createRequest")}
          </Button>
        </div>

        {isCreateOpen && (
          <Card>
            <form
              onSubmit={(event) => void handleCreate(event)}
              className="space-y-4"
            >
              <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
                {t("leaveManagementPage.form.title")}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                  <span>{t("leaveManagementPage.form.employee")}</span>
                  <select
                    required
                    value={draft.employeeId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        employeeId: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-400 dark:border-gray-700 dark:text-white/90"
                  >
                    <option value="">
                      {t("leaveManagementPage.form.selectEmployee")}
                    </option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.displayName}
                        {employee.employeeNumber
                          ? ` · ${employee.employeeNumber}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                  <span>{t("leaveManagementPage.form.leaveType")}</span>
                  <select
                    value={draft.leaveType}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        leaveType: event.target.value as EmployeeLeaveType,
                      }))
                    }
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-400 dark:border-gray-700 dark:text-white/90"
                  >
                    {(
                      [
                        "annual",
                        "sick",
                        "emergency",
                        "parental",
                        "unpaid",
                        "other",
                      ] as const
                    ).map((leaveType) => (
                      <option key={leaveType} value={leaveType}>
                        {t(`leaveManagementPage.leaveTypes.${leaveType}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                  <span>{t("leaveManagementPage.form.days")}</span>
                  <Input
                    required
                    type="number"
                    min={0.5}
                    max={366}
                    step={0.5}
                    value={draft.requestedDays}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        requestedDays: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                  <span>{t("leaveManagementPage.form.startDate")}</span>
                  <Input
                    required
                    type="date"
                    value={draft.startDate}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                  <span>{t("leaveManagementPage.form.endDate")}</span>
                  <Input
                    required
                    type="date"
                    min={draft.startDate}
                    value={draft.endDate}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="space-y-1.5 text-sm text-gray-600 sm:col-span-2 xl:col-span-1 dark:text-gray-300">
                  <span>{t("leaveManagementPage.form.reason")}</span>
                  <Input
                    required
                    maxLength={2000}
                    value={draft.reason}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isCreating}
                  variant="outline"
                  size="sm"
                >
                  {t("leaveManagementPage.form.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating || employees.length === 0}
                  size="sm"
                >
                  {isCreating
                    ? t("leaveManagementPage.form.saving")
                    : t("leaveManagementPage.form.submit")}
                </Button>
              </div>
            </form>
          </Card>
        )}

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
              aria-label={t("leaveManagementPage.summary.title")}
              className="grid grid-cols-2 gap-3 xl:grid-cols-4"
            >
              {summaryCards.map((card) => (
                <Card key={card.label}>
                  <article>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {card.label}
                      </p>
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${card.className}`}
                      >
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

            <section
              aria-labelledby="leave-requests-heading"
              className="space-y-4"
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2
                      id="leave-requests-heading"
                      className="text-lg font-semibold text-gray-800 dark:text-white/90"
                    >
                      {t("leaveManagementPage.requestsTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {t("leaveManagementPage.requestsCount", {
                        count: numberFormat.format(visibleRequests.length),
                      })}
                    </p>
                  </div>
                </div>

                {actionErrorKey && (
                  <p
                    className="text-sm text-error-600 dark:text-error-400"
                    role="alert"
                  >
                    {t(actionErrorKey)}
                  </p>
                )}
                {successKey && (
                  <p
                    className="text-sm text-success-700 dark:text-success-400"
                    role="status"
                  >
                    {t(successKey)}
                  </p>
                )}
                <DataTableThree
                  rows={pageRequests}
                  columns={requestColumns}
                  getRowKey={(request) => request.id}
                  getRowLabel={(request) => t("leaveManagementPage.table.selectRequest", { employee: request.employeeName })}
                  page={page}
                  pageSize={pageSize}
                  totalItems={visibleRequests.length}
                  pageSizeOptions={[5, 10, 25]}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  searchTerm={search}
                  onSearchTermChange={(value) => {
                    setSearch(value);
                    setPage(1);
                    setSelectedRequestIds(new Set());
                  }}
                  selectedRowIds={selectedRequestIds}
                  onSelectedRowIdsChange={setSelectedRequestIds}
                  selectAllLabel={t("leaveManagementPage.table.selectAll")}
                  searchPlaceholder={t("leaveManagementPage.search")}
                  showLabel={t("leaveManagementPage.table.show")}
                  entriesLabel={t("leaveManagementPage.table.entries")}
                  emptyMessage={t("leaveManagementPage.empty")}
                  loadingMessage={t("leaveManagementPage.loading")}
                  showingMessage={t("leaveManagementPage.table.showing", {
                    start: numberFormat.format(firstVisibleIndex),
                    end: numberFormat.format(lastVisibleIndex),
                    total: numberFormat.format(visibleRequests.length),
                  })}
                  previousLabel={t("leaveManagementPage.table.previous")}
                  nextLabel={t("leaveManagementPage.table.next")}
                  toolbarActions={(
                    <nav
                      className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800"
                      role="tablist"
                      aria-label={t("leaveManagementPage.filterLabel")}
                    >
                      {filters.map((status) => (
                        <TabButton
                          key={status}
                          id={`leave-filter-${status}`}
                          role="tab"
                          tabIndex={filter === status ? 0 : -1}
                          label={t(`leaveManagementPage.filters.${status}`)}
                          isActive={filter === status}
                          onClick={() => {
                            setFilter(status);
                            setPage(1);
                            setSelectedRequestIds(new Set());
                          }}
                        />
                      ))}
                    </nav>
                  )}
                  isLoading={isLoading}
                />
            </section>
          </>
        )}
      </div>
    </>
  );
}
