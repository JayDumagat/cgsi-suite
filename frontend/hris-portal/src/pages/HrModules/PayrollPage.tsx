import PageMeta from "@/components/common/PageMeta";
import DataTableTwo, {
  type DataTableTwoColumn,
} from "@/components/tables/DataTables/TableTwo/DataTableTwo";
import {
  EmployeeDirectoryRequestError,
  createPayrollRun,
  getEmployeeHrDetails,
  getPayrollRunsReport,
  listEmployees,
  updatePayrollRunItem,
  type EmployeeDirectoryItem,
  type EmployeeHrDetails,
  type PayrollRun,
  type PayrollRunComponent,
  type PayrollRunInput,
  type PayrollRunItem,
  type PayrollRunItemInput,
} from "@/components/employee-directory/employeeDirectoryApi";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  CreatePayrollRunModal,
  PayrollItemEditorModal,
} from "./PayrollRunForms";

const directoryPageSize = 100;
const profileBatchSize = 20;

interface PayrollProfileRow {
  employee: EmployeeDirectoryItem;
  payroll: EmployeeHrDetails["payroll"];
}

interface PayrollTableRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  department: string | null;
  basePay: number | null;
  currency: string | null;
  earnings: PayrollRunComponent[];
  deductions: PayrollRunComponent[];
  contributions: PayrollRunComponent[];
  item: PayrollRunItem | null;
}

function payrollErrorKey(error: unknown, fallback = "payrollPage.errors.actionFailed") {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden")
      return "payrollPage.errors.accessDenied";
    const knownCodes: Record<string, string> = {
      payroll_period_already_exists: "payrollPage.errors.periodExists",
      payroll_profiles_required: "payrollPage.errors.profilesRequired",
      payroll_run_mixed_currencies: "payrollPage.errors.mixedCurrencies",
      payroll_run_not_draft: "payrollPage.errors.runNotDraft",
      payroll_net_pay_cannot_be_negative: "payrollPage.errors.negativeNetPay",
      payroll_run_not_found: "payrollPage.errors.runNotFound",
    };
    if (knownCodes[error.code]) return knownCodes[error.code];
  }
  return fallback;
}

function formatMoney(value: number, currency: string | null, locale: string) {
  if (!currency) {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
  }
}

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function componentLines(components: PayrollRunComponent[], currency: string, locale: string, fallback: string) {
  if (components.length === 0) return <span className="text-gray-400">{fallback}</span>;
  return (
    <div className="min-w-36 space-y-1">
      {components.map((component, index) => (
        <div key={`${component.name}-${index}`} className="flex items-baseline justify-between gap-3">
          <span className="text-gray-600 dark:text-gray-400">
            {component.name}{component.hours == null ? "" : ` · ${component.hours}h`}
          </span>
          <span className="whitespace-nowrap font-medium text-gray-800 dark:text-gray-200">
            {formatMoney(component.amount, currency, locale)}
          </span>
        </div>
      ))}
    </div>
  );
}

function componentTotal(components: PayrollRunComponent[]) {
  return components.reduce((total, component) => total + component.amount, 0);
}

export default function PayrollPage() {
  const { t, i18n } = useTranslation();
  const [profileRows, setProfileRows] = useState<PayrollProfileRow[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [profileErrorKey, setProfileErrorKey] = useState<string | null>(null);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [runsErrorKey, setRunsErrorKey] = useState<string | null>(null);
  const [payrollMonth, setPayrollMonth] = useState(() => dateInputValue(new Date()).slice(0, 7));
  const [isCreateRunOpen, setIsCreateRunOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PayrollRunItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadPayrollProfiles() {
      setIsLoadingProfiles(true);
      setProfileErrorKey(null);
      try {
        const firstDirectoryPage = await listEmployees(
          { query: "", page: 1, pageSize: directoryPageSize, sortBy: "displayName", sortOrder: "asc" },
          controller.signal,
        );
        const remainingPageCount = Math.ceil(firstDirectoryPage.total / directoryPageSize) - 1;
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, remainingPageCount) }, (_, index) =>
            listEmployees(
              { query: "", page: index + 2, pageSize: directoryPageSize, sortBy: "displayName", sortOrder: "asc" },
              controller.signal,
            ),
          ),
        );
        const employees = [firstDirectoryPage, ...remainingPages].flatMap((page) => page.items);
        const payrollRows: PayrollProfileRow[] = [];
        for (let index = 0; index < employees.length; index += profileBatchSize) {
          const batch = employees.slice(index, index + profileBatchSize);
          const loadedBatch = await Promise.all(batch.map(async (employee) => ({
            employee,
            payroll: (await getEmployeeHrDetails(employee.id, controller.signal)).payroll,
          })));
          payrollRows.push(...loadedBatch);
        }
        if (!controller.signal.aborted) setProfileRows(payrollRows);
      } catch (error) {
        if (!controller.signal.aborted) {
          setProfileRows([]);
          setProfileErrorKey(payrollErrorKey(error, "payrollPage.errors.loadFailed"));
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingProfiles(false);
      }
    }
    void loadPayrollProfiles();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingRuns(true);
    setRunsErrorKey(null);
    void getPayrollRunsReport(controller.signal)
      .then((report) => {
        if (controller.signal.aborted) return;
        setRuns(report.runs);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setRuns([]);
          setRunsErrorKey(payrollErrorKey(error, "payrollPage.errors.runsLoadFailed"));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingRuns(false);
      });
    return () => controller.abort();
  }, []);

  const selectedRun = runs.find((run) => run.periodStart.slice(0, 7) === payrollMonth) ?? null;
  const monthDefaults = useMemo(() => {
    const [year, month] = payrollMonth.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, 1);
    return {
      periodStart: dateInputValue(selectedDate),
      periodEnd: dateInputValue(new Date(year, month, 0)),
      payDate: dateInputValue(new Date(year, month, 5)),
    };
  }, [payrollMonth]);

  const tableRows = useMemo<PayrollTableRow[]>(() => {
    const itemsByEmployee = new Map(selectedRun?.items.map((item) => [item.employeeId, item]) ?? []);
    const representedEmployees = new Set<string>();
    const rows = profileRows.map(({ employee, payroll }) => {
      const item = itemsByEmployee.get(employee.id) ?? null;
      representedEmployees.add(employee.id);
      return {
        id: item?.id ?? employee.id,
        employeeId: employee.id,
        employeeName: employee.displayName,
        employeeNumber: employee.employeeNumber,
        department: employee.department,
        basePay: item?.basePay ?? (payroll.baseSalary == null || payroll.baseSalary === "" || !Number.isFinite(Number(payroll.baseSalary)) ? null : Number(payroll.baseSalary)),
        currency: item ? selectedRun?.currency ?? null : payroll.currency,
        earnings: item?.earnings ?? [],
        deductions: item?.deductions ?? [],
        contributions: item?.contributions ?? [],
        item,
      };
    });
    for (const item of selectedRun?.items ?? []) {
      if (representedEmployees.has(item.employeeId)) continue;
      rows.push({
        id: item.id,
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        employeeNumber: item.employeeNumber,
        department: item.department,
        basePay: item.basePay,
        currency: selectedRun?.currency ?? null,
        earnings: item.earnings,
        deductions: item.deductions,
        contributions: item.contributions,
        item,
      });
    }
    return rows;
  }, [profileRows, selectedRun]);

  const tableColumns = useMemo<DataTableTwoColumn<PayrollTableRow>[]>(() => [
    {
      key: "employee",
      label: t("payrollPage.table.employee"),
      render: (row) => (
        <div className="min-w-48">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Link to={`/employees/${row.employeeId}`} className="font-medium text-gray-800 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-300">{row.employeeName}</Link>
            {row.item ? (
              selectedRun?.status === "draft" && (
                <button type="button" className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300" onClick={() => { setActionErrorKey(null); setEditingItem(row.item); }}>
                  {t("payrollPage.runs.edit")}
                </button>
              )
            ) : (
              <Link to={`/employees/${row.employeeId}?tab=payroll`} className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">
                {t("payrollPage.table.manageProfile")}
              </Link>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{[row.employeeNumber, row.department].filter(Boolean).join(" · ") || t("payrollPage.notProvided")}</p>
        </div>
      ),
      sortValue: (row) => row.employeeName,
      searchValue: (row) => `${row.employeeName} ${row.employeeNumber ?? ""} ${row.department ?? ""}`,
    },
    {
      key: "baseSalary",
      label: t("payrollPage.table.baseSalary"),
      render: (row) => row.basePay === null
        ? <span className="text-gray-400">{t("payrollPage.notProvided")}</span>
        : <span className="font-medium text-gray-800 dark:text-gray-200">{formatMoney(row.basePay, row.currency, i18n.language)}</span>,
      sortValue: (row) => row.basePay,
    },
    {
      key: "deductions",
      label: t("payrollPage.table.deductions"),
      render: (row) => componentLines(row.deductions, row.currency ?? "PHP", i18n.language, t("payrollPage.notProvided")),
      sortValue: (row) => componentTotal(row.deductions),
    },
    {
      key: "contributions",
      label: t("payrollPage.table.contributionsOthers"),
      render: (row) => componentLines(row.contributions, row.currency ?? "PHP", i18n.language, t("payrollPage.notProvided")),
      sortValue: (row) => componentTotal(row.contributions),
    },
    {
      key: "earnings",
      label: t("payrollPage.table.additionalEarnings"),
      render: (row) => componentLines(row.earnings, row.currency ?? "PHP", i18n.language, t("payrollPage.notProvided")),
      sortValue: (row) => componentTotal(row.earnings),
    },
  ], [i18n.language, selectedRun?.status, t]);

  function replaceRun(updated: PayrollRun) {
    setRuns((current) => [updated, ...current.filter((run) => run.id !== updated.id)]
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt)));
  }

  async function handleCreateRun(input: PayrollRunInput) {
    setIsSaving(true);
    setActionErrorKey(null);
    try {
      const run = await createPayrollRun(input);
      replaceRun(run);
      setIsCreateRunOpen(false);
    } catch (error) {
      setActionErrorKey(payrollErrorKey(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveItem(input: PayrollRunItemInput) {
    if (!selectedRun || !editingItem) return;
    setIsSaving(true);
    setActionErrorKey(null);
    try {
      const run = await updatePayrollRunItem(selectedRun.id, editingItem.id, input);
      replaceRun(run);
      setEditingItem(null);
    } catch (error) {
      setActionErrorKey(payrollErrorKey(error));
    } finally {
      setIsSaving(false);
    }
  }

  const tableLabels = {
    show: t("payrollPage.table.show"),
    entries: t("payrollPage.table.entries"),
    searchPlaceholder: t("payrollPage.searchPlaceholder"),
    action: t("payrollPage.table.action"),
    previous: t("payrollPage.previous"),
    next: t("payrollPage.next"),
    showing: (from: number, to: number, total: number) => t("payrollPage.table.showingEntries", { from, to, total }),
  };

  return (
    <>
      <PageMeta title={`${t("payrollPage.title")} | ERIS`} description={t("payrollPage.description")} />
      <div className="space-y-6">
        {runsErrorKey && <p className="text-sm text-error-600 dark:text-error-400" role="alert">{t(runsErrorKey)}</p>}
        {profileErrorKey && !selectedRun && <p className="text-sm text-error-600 dark:text-error-400" role="alert">{t(profileErrorKey)}</p>}
        <DataTableTwo
          data={tableRows}
          columns={tableColumns}
          headerContent={(
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-h-10 w-fit items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-600 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                <span className="whitespace-nowrap">{t("payrollPage.monthLabel")}</span>
                <input
                  type="month"
                  value={payrollMonth}
                  onChange={(event) => {
                    if (event.target.value) setPayrollMonth(event.target.value);
                  }}
                  aria-label={t("payrollPage.monthLabel")}
                  className="min-w-32 bg-transparent text-sm font-medium text-gray-800 outline-none dark:text-white/90"
                />
              </label>
              <button type="button" disabled={isLoadingRuns || selectedRun !== null} className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { setActionErrorKey(null); setIsCreateRunOpen(true); }}>
                {t("payrollPage.runs.create")}
              </button>
            </div>
          )}
          getRowKey={(row) => row.id}
          getSearchValue={(row) => [
            row.employeeName,
            row.employeeNumber,
            row.department,
            ...row.earnings.map((entry) => entry.name),
            ...row.deductions.map((entry) => entry.name),
            ...row.contributions.map((entry) => entry.name),
          ].filter(Boolean).join(" ")}
          labels={tableLabels}
          pageSizeOptions={[10, 25, 50]}
          initialPageSize={10}
          loading={selectedRun ? false : isLoadingProfiles || isLoadingRuns}
          loadingText={selectedRun ? t("payrollPage.runs.loading") : t("payrollPage.loading")}
          emptyState={selectedRun ? t("payrollPage.runs.noEmployees") : t("payrollPage.empty")}
          surface="white"
        />
      </div>

      <CreatePayrollRunModal
        isOpen={isCreateRunOpen}
        onClose={() => { if (!isSaving) setIsCreateRunOpen(false); }}
        saving={isSaving}
        error={actionErrorKey ? t(actionErrorKey) : null}
        defaultPeriodStart={monthDefaults.periodStart}
        defaultPeriodEnd={monthDefaults.periodEnd}
        defaultPayDate={monthDefaults.payDate}
        onSubmit={handleCreateRun}
      />
      <PayrollItemEditorModal
        isOpen={editingItem !== null}
        item={editingItem}
        currency={selectedRun?.currency ?? "PHP"}
        saving={isSaving}
        error={actionErrorKey ? t(actionErrorKey) : null}
        onClose={() => { if (!isSaving) setEditingItem(null); }}
        onSubmit={handleSaveItem}
      />
    </>
  );
}
