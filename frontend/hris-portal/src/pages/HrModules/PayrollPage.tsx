import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import PageMeta from "@/components/common/PageMeta";
import DataTableTwo, {
  type DataTableTwoColumn,
} from "@/components/tables/DataTables/TableTwo/DataTableTwo";
import {
  EmployeeDirectoryRequestError,
  getEmployeeHrDetails,
  listEmployees,
  type EmployeeDirectoryItem,
  type EmployeeHrDetails,
} from "@/components/employee-directory/employeeDirectoryApi";
import { UserMoneyIcon, UserCircleIcon, CheckLineIcon } from "@/icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { HrStatCard } from "./HrModuleComponents";

const directoryPageSize = 100;
const profileBatchSize = 20;

interface PayrollRow {
  employee: EmployeeDirectoryItem;
  payroll: EmployeeHrDetails["payroll"];
}

function payrollErrorKey(error: unknown) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden")
      return "payrollPage.errors.accessDenied";
  }
  return "payrollPage.errors.loadFailed";
}

function formatSalary(
  value: string | null,
  currency: string | null,
  locale: string,
) {
  if (value === null || value.trim() === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  try {
    return new Intl.NumberFormat(locale, {
      style: currency ? "currency" : "decimal",
      currency: currency || undefined,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency ? `${currency} ` : ""}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount)}`;
  }
}

export default function PayrollPage() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadPayrollProfiles() {
      setIsLoading(true);
      setErrorKey(null);
      try {
        const firstDirectoryPage = await listEmployees(
          {
            query: "",
            page: 1,
            pageSize: directoryPageSize,
            sortBy: "displayName",
            sortOrder: "asc",
          },
          controller.signal,
        );
        const remainingPageCount = Math.ceil(
          firstDirectoryPage.total / directoryPageSize,
        ) - 1;
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, remainingPageCount) }, (_, index) =>
            listEmployees(
              {
                query: "",
                page: index + 2,
                pageSize: directoryPageSize,
                sortBy: "displayName",
                sortOrder: "asc",
              },
              controller.signal,
            ),
          ),
        );
        const employees = [
          ...firstDirectoryPage.items,
          ...remainingPages.flatMap((pageResult) => pageResult.items),
        ];
        const payrollRows: PayrollRow[] = [];
        for (let index = 0; index < employees.length; index += profileBatchSize) {
          const batch = employees.slice(index, index + profileBatchSize);
          const loadedBatch = await Promise.all(
            batch.map(async (employee) => ({
              employee,
              payroll: (
                await getEmployeeHrDetails(employee.id, controller.signal)
              ).payroll,
            })),
          );
          payrollRows.push(...loadedBatch);
        }
        if (controller.signal.aborted) return;
        setRows(payrollRows);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRows([]);
        setErrorKey(payrollErrorKey(error));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    void loadPayrollProfiles();
    return () => controller.abort();
  }, []);

  const configuredCount = rows.filter(
    ({ payroll }) => payroll.baseSalary !== null && payroll.baseSalary !== "",
  ).length;
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language],
  );
  const tableColumns = useMemo<DataTableTwoColumn<PayrollRow>[]>(
    () => [
      {
        key: "employee",
        label: t("payrollPage.table.employee"),
        render: ({ employee }) => (
          <div>
            <Link
              to={`/employees/${employee.id}`}
              className="font-medium text-gray-800 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-300"
            >
              {employee.displayName}
            </Link>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {employee.employeeNumber || employee.workEmail}
            </p>
          </div>
        ),
        sortValue: ({ employee }) => employee.displayName,
        searchValue: ({ employee }) => employee.displayName,
      },
      {
        key: "department",
        label: t("payrollPage.table.department"),
        render: ({ employee }) => employee.department || t("payrollPage.notProvided"),
        sortValue: ({ employee }) => employee.department ?? "",
      },
      {
        key: "baseSalary",
        label: t("payrollPage.table.baseSalary"),
        render: ({ payroll }) => (
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {formatSalary(payroll.baseSalary, payroll.currency, i18n.language) ||
              t("payrollPage.notProvided")}
          </span>
        ),
        sortValue: ({ payroll }) => {
          const amount = payroll.baseSalary === null ? Number.NaN : Number(payroll.baseSalary);
          return Number.isFinite(amount) ? amount : null;
        },
        searchValue: ({ payroll }) => payroll.baseSalary ?? "",
      },
      {
        key: "frequency",
        label: t("payrollPage.table.frequency"),
        render: ({ payroll }) => payroll.payFrequency
          ? t(`payrollPage.frequencies.${payroll.payFrequency}`)
          : t("payrollPage.notProvided"),
        sortValue: ({ payroll }) => payroll.payFrequency
          ? t(`payrollPage.frequencies.${payroll.payFrequency}`)
          : "",
      },
      {
        key: "grade",
        label: t("payrollPage.table.grade"),
        render: ({ payroll }) => payroll.payGrade || t("payrollPage.notProvided"),
        sortValue: ({ payroll }) => payroll.payGrade ?? "",
      },
    ],
    [i18n.language, t],
  );

  return (
    <>
      <PageMeta
        title={`${t("payrollPage.title")} | ERIS`}
        description={t("payrollPage.description")}
      />
      <div className="space-y-6">
        <PageBreadcrumb
          pageTitle={t("payrollPage.title")}
          showPageTitle={false}
        />
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
              {t("payrollPage.title")}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              {t("payrollPage.description")}
            </p>
          </div>
          <Link
            to="/employees"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            {t("payrollPage.manageEmployees")}
          </Link>
        </header>

        <section
          aria-label={t("payrollPage.overview")}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <HrStatCard
            label={t("payrollPage.stats.employeesOnPage")}
            value={isLoading ? "—" : numberFormat.format(rows.length)}
            icon={<UserCircleIcon className="size-5" />}
          />
          <HrStatCard
            label={t("payrollPage.stats.profilesConfigured")}
            value={isLoading ? "—" : numberFormat.format(configuredCount)}
            icon={<CheckLineIcon className="size-5" />}
            tone="success"
          />
        </section>

        <ComponentCard
          title={t("payrollPage.profiles.title")}
          desc={t("payrollPage.profiles.description")}
          spacing={false}
        >
          <section className="space-y-4">
            {errorKey ? (
              <p
                className="py-10 text-center text-sm text-error-600 dark:text-error-400"
                role="alert"
              >
                {t(errorKey)}
              </p>
            ) : (
              <DataTableTwo
                data={rows}
                columns={tableColumns}
                getRowKey={({ employee }) => employee.id}
                getSearchValue={({ employee, payroll }) => [
                  employee.displayName,
                  employee.employeeNumber,
                  employee.workEmail,
                  employee.department,
                  payroll.baseSalary,
                  payroll.payGrade,
                  payroll.payFrequency
                    ? t(`payrollPage.frequencies.${payroll.payFrequency}`)
                    : "",
                ].filter(Boolean).join(" ")}
                renderActions={({ employee }) => (
                  <Link
                    to={`/employees/${employee.id}?tab=payroll`}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    {t("payrollPage.table.manageProfile")}
                  </Link>
                )}
                labels={{
                  show: t("payrollPage.table.show"),
                  entries: t("payrollPage.table.entries"),
                  searchPlaceholder: t("payrollPage.searchPlaceholder"),
                  action: t("payrollPage.table.action"),
                  previous: t("payrollPage.previous"),
                  next: t("payrollPage.next"),
                  showing: (from, to, total) => t("payrollPage.table.showingEntries", { from, to, total }),
                }}
                pageSizeOptions={[10, 25, 50]}
                initialPageSize={10}
                loading={isLoading}
                loadingText={t("payrollPage.loading")}
                emptyState={t("payrollPage.empty")}
              />
            )}
            <p className="flex items-start gap-2 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <UserMoneyIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {t("payrollPage.scopeNote")}
            </p>
          </section>
        </ComponentCard>
      </div>
    </>
  );
}
