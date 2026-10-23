import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import Input from "@/components/form/input/InputField";
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
import { CheckLineIcon, CloseLineIcon, ClockIcon, UserCircleIcon } from "@/icons";
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

function requestStatusClass(status: EmployeeLeaveRequestStatus) {
  switch (status) {
    case "approved":
      return "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400";
    case "rejected":
      return "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400";
    default:
      return "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400";
  }
}

function leaveErrorKey(error: unknown, fallback: string) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden") return "employeeDirectory.errors.accessDenied";
    if (error.code === "leave_request_overlap") return "leaveManagementPage.errors.overlap";
    if (error.code === "leave_request_not_pending") return "leaveManagementPage.errors.notPending";
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
    summary: { pendingCount: number; approvedCount: number; rejectedCount: number; onLeaveTodayCount: number };
    items: EmployeeLeaveRequest[];
  } | null>(null);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrorKey, setLoadErrorKey] = useState<string | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RequestFilter>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draft, setDraft] = useState<LeaveRequestDraft>(() => makeBlankDraft());
  const [isCreating, setIsCreating] = useState(false);
  const [savingRequestId, setSavingRequestId] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const numberFormat = useMemo(() => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }), [i18n.language]);

  useEffect(() => {
    const controller = new AbortController();
    void listEmployees({
      query: "",
      page: 1,
      pageSize: 100,
      sortBy: "displayName",
      sortOrder: "asc",
    }, controller.signal)
      .then((directory) => {
        const eligibleEmployees = directory.items.filter((employee) => employee.employmentStatus === "active" || employee.employmentStatus === "on_leave");
        setEmployees(eligibleEmployees);
        setDraft((current) => current.employeeId || !eligibleEmployees[0]
          ? current
          : { ...current, employeeId: eligibleEmployees[0].id });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadErrorKey(leaveErrorKey(error, "leaveManagementPage.errors.loadFailed"));
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
          setLoadErrorKey(leaveErrorKey(error, "leaveManagementPage.errors.loadFailed"));
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
      return [request.employeeName, request.employeeNumber, request.department, request.reason]
        .some((value) => value?.toLocaleLowerCase().includes(query))
        || t(`leaveManagementPage.leaveTypes.${request.leaveType}`).toLocaleLowerCase().includes(query);
    });
  }, [filter, report, search, t]);

  const summaryCards = [
    { label: t("leaveManagementPage.summary.pending"), value: report?.summary.pendingCount ?? 0, icon: <ClockIcon className="size-5" aria-hidden="true" />, className: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400" },
    { label: t("leaveManagementPage.summary.approved"), value: report?.summary.approvedCount ?? 0, icon: <CheckLineIcon className="size-5" aria-hidden="true" />, className: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400" },
    { label: t("leaveManagementPage.summary.rejected"), value: report?.summary.rejectedCount ?? 0, icon: <CloseLineIcon className="size-5" aria-hidden="true" />, className: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400" },
    { label: t("leaveManagementPage.summary.onLeaveToday"), value: report?.summary.onLeaveTodayCount ?? 0, icon: <UserCircleIcon className="size-5" aria-hidden="true" />, className: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" },
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
      setSuccessKey("leaveManagementPage.messages.created");
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      setActionErrorKey(leaveErrorKey(error, "leaveManagementPage.errors.saveFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDecision = async (request: EmployeeLeaveRequest, status: "approved" | "rejected") => {
    setSavingRequestId(request.id);
    setActionErrorKey(null);
    setSuccessKey(null);
    try {
      await decideLeaveRequest(request.id, { status, decisionNote: null });
      setSuccessKey(status === "approved" ? "leaveManagementPage.messages.approved" : "leaveManagementPage.messages.rejected");
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      setActionErrorKey(leaveErrorKey(error, "leaveManagementPage.errors.saveFailed"));
    } finally {
      setSavingRequestId(null);
    }
  };

  const filters: RequestFilter[] = ["all", "pending", "approved", "rejected"];

  return (
    <>
      <PageMeta title={`${t("leaveManagementPage.title")} | ERIS`} description={t("leaveManagementPage.description")} />
      <div className="space-y-6">
        <PageBreadcrumb pageTitle={t("leaveManagementPage.title")} />
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">{t("leaveManagementPage.title")}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("leaveManagementPage.description")}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setActionErrorKey(null);
              setSuccessKey(null);
              setIsCreateOpen((open) => !open);
            }}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            {isCreateOpen ? t("leaveManagementPage.form.close") : t("leaveManagementPage.createRequest")}
          </button>
        </div>

        {isCreateOpen && (
          <form onSubmit={(event) => void handleCreate(event)} className="space-y-4 border-y border-gray-200 py-5 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("leaveManagementPage.form.title")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                <span>{t("leaveManagementPage.form.employee")}</span>
                <select required value={draft.employeeId} onChange={(event) => setDraft((current) => ({ ...current, employeeId: event.target.value }))} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-400 dark:border-gray-700 dark:text-white/90">
                  <option value="">{t("leaveManagementPage.form.selectEmployee")}</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.displayName}{employee.employeeNumber ? ` · ${employee.employeeNumber}` : ""}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                <span>{t("leaveManagementPage.form.leaveType")}</span>
                <select value={draft.leaveType} onChange={(event) => setDraft((current) => ({ ...current, leaveType: event.target.value as EmployeeLeaveType }))} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-400 dark:border-gray-700 dark:text-white/90">
                  {(["annual", "sick", "emergency", "parental", "unpaid", "other"] as const).map((leaveType) => <option key={leaveType} value={leaveType}>{t(`leaveManagementPage.leaveTypes.${leaveType}`)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                <span>{t("leaveManagementPage.form.days")}</span>
                <Input required type="number" min={0.5} max={366} step={0.5} value={draft.requestedDays} onChange={(event) => setDraft((current) => ({ ...current, requestedDays: event.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                <span>{t("leaveManagementPage.form.startDate")}</span>
                <Input required type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                <span>{t("leaveManagementPage.form.endDate")}</span>
                <Input required type="date" min={draft.startDate} value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300 sm:col-span-2 xl:col-span-1">
                <span>{t("leaveManagementPage.form.reason")}</span>
                <Input required maxLength={2000} value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setIsCreateOpen(false)} disabled={isCreating} className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">
                {t("leaveManagementPage.form.cancel")}
              </button>
              <button type="submit" disabled={isCreating || employees.length === 0} className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60">
                {isCreating ? t("leaveManagementPage.form.saving") : t("leaveManagementPage.form.submit")}
              </button>
            </div>
          </form>
        )}

        {loadErrorKey ? (
          <p className="py-10 text-center text-sm text-error-600 dark:text-error-400" role="alert">{t(loadErrorKey)}</p>
        ) : (
          <>
            <section aria-label={t("leaveManagementPage.summary.title")} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <article key={card.label} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${card.className}`}>{card.icon}</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-gray-800 dark:text-white/90">{isLoading ? "—" : numberFormat.format(card.value)}</p>
                </article>
              ))}
            </section>

            <section aria-labelledby="leave-requests-heading" className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 id="leave-requests-heading" className="text-lg font-semibold text-gray-800 dark:text-white/90">{t("leaveManagementPage.requestsTitle")}</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("leaveManagementPage.requestsCount", { count: numberFormat.format(visibleRequests.length) })}</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="sr-only" htmlFor="leave-request-search">{t("leaveManagementPage.search")}</label>
                  <Input id="leave-request-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("leaveManagementPage.search")} className="sm:w-64" />
                  <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label={t("leaveManagementPage.filterLabel")}>
                    {filters.map((status) => (
                      <button key={status} type="button" role="tab" aria-selected={filter === status} onClick={() => setFilter(status)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${filter === status ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"}`}>
                        {t(`leaveManagementPage.filters.${status}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {actionErrorKey && <p className="text-sm text-error-600 dark:text-error-400" role="alert">{t(actionErrorKey)}</p>}
              {successKey && <p className="text-sm text-success-700 dark:text-success-400" role="status">{t(successKey)}</p>}
              {isLoading ? (
                <p className="py-8 text-sm text-gray-500 dark:text-gray-400">{t("leaveManagementPage.loading")}</p>
              ) : visibleRequests.length === 0 ? (
                <div className="border-y border-gray-200 py-10 text-center dark:border-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("leaveManagementPage.empty")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto border-y border-gray-200 dark:border-gray-800">
                  <table className="min-w-[1050px] w-full text-left rtl:text-right">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
                        <th scope="col" className="px-3 py-3 font-medium">{t("leaveManagementPage.columns.employee")}</th>
                        <th scope="col" className="px-3 py-3 font-medium">{t("leaveManagementPage.columns.leaveType")}</th>
                        <th scope="col" className="px-3 py-3 font-medium">{t("leaveManagementPage.columns.dates")}</th>
                        <th scope="col" className="px-3 py-3 font-medium">{t("leaveManagementPage.columns.days")}</th>
                        <th scope="col" className="px-3 py-3 font-medium">{t("leaveManagementPage.columns.reason")}</th>
                        <th scope="col" className="px-3 py-3 font-medium">{t("leaveManagementPage.columns.status")}</th>
                        <th scope="col" className="px-3 py-3 font-medium">{t("leaveManagementPage.columns.actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {visibleRequests.map((request) => {
                        const isSaving = savingRequestId === request.id;
                        return (
                          <tr key={request.id} className="transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
                            <td className="px-3 py-3.5">
                              <Link to={`/employees/${request.employeeId}`} className="min-w-0">
                                <span className="block truncate text-sm font-medium text-gray-800 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-300">{request.employeeName}</span>
                                <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">{request.employeeNumber || request.department || "—"}</span>
                              </Link>
                            </td>
                            <td className="px-3 py-3.5 text-sm text-gray-600 dark:text-gray-300">{t(`leaveManagementPage.leaveTypes.${request.leaveType}`)}</td>
                            <td className="px-3 py-3.5 text-sm text-gray-600 dark:text-gray-300">{formatDate(request.startDate, i18n.language)} – {formatDate(request.endDate, i18n.language)}</td>
                            <td className="px-3 py-3.5 text-sm text-gray-600 dark:text-gray-300">{numberFormat.format(request.requestedDays)}</td>
                            <td className="max-w-64 px-3 py-3.5 text-sm text-gray-600 dark:text-gray-300"><span className="line-clamp-2">{request.reason}</span></td>
                            <td className="px-3 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${requestStatusClass(request.status)}`}>{t(`leaveManagementPage.statuses.${request.status}`)}</span></td>
                            <td className="px-3 py-3.5">
                              {request.status === "pending" ? (
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => void handleDecision(request, "approved")} disabled={isSaving} aria-label={t("leaveManagementPage.actions.approve")} title={t("leaveManagementPage.actions.approve")} className="inline-flex size-9 items-center justify-center rounded-lg border border-success-200 text-success-700 transition hover:bg-success-50 disabled:opacity-50 dark:border-success-500/30 dark:text-success-400 dark:hover:bg-success-500/10">
                                    <CheckLineIcon className="size-4" aria-hidden="true" />
                                  </button>
                                  <button type="button" onClick={() => void handleDecision(request, "rejected")} disabled={isSaving} aria-label={t("leaveManagementPage.actions.reject")} title={t("leaveManagementPage.actions.reject")} className="inline-flex size-9 items-center justify-center rounded-lg border border-error-200 text-error-700 transition hover:bg-error-50 disabled:opacity-50 dark:border-error-500/30 dark:text-error-400 dark:hover:bg-error-500/10">
                                    <CloseLineIcon className="size-4" aria-hidden="true" />
                                  </button>
                                </div>
                              ) : request.decidedByName ? (
                                <span className="text-xs text-gray-500 dark:text-gray-400">{request.decidedByName}</span>
                              ) : <span className="text-sm text-gray-400">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
