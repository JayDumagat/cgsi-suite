import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import Input from "@/components/form/input/InputField";
import { Card } from "@/components/ui/card";
import {
  EmployeeDirectoryRequestError,
  getEmployeeHrDetails,
  listEmployees,
  type EmployeeDirectoryItem,
  type EmployeeHrDetails,
} from "@/components/employee-directory/employeeDirectoryApi";
import { UserMoneyIcon, UserCircleIcon, CheckLineIcon } from "@/icons";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { HrStatCard } from "./HrModuleComponents";

const pageSize = 25;

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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadPayrollProfiles() {
      setIsLoading(true);
      setErrorKey(null);
      try {
        const directory = await listEmployees(
          {
            query,
            page,
            pageSize,
            sortBy: "displayName",
            sortOrder: "asc",
          },
          controller.signal,
        );
        const payrollRows = await Promise.all(
          directory.items.map(async (employee) => ({
            employee,
            payroll: (
              await getEmployeeHrDetails(employee.id, controller.signal)
            ).payroll,
          })),
        );
        if (controller.signal.aborted) return;
        setRows(payrollRows);
        setTotal(directory.total);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRows([]);
        setTotal(0);
        setErrorKey(payrollErrorKey(error));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    void loadPayrollProfiles();
    return () => controller.abort();
  }, [page, query]);

  const configuredCount = rows.filter(
    ({ payroll }) => payroll.baseSalary !== null && payroll.baseSalary !== "",
  ).length;
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language],
  );
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(searchDraft.trim());
  }

  return (
    <>
      <PageMeta
        title={`${t("payrollPage.title")} | ERIS`}
        description={t("payrollPage.description")}
      />
      <div className="space-y-6">
        <PageBreadcrumb pageTitle={t("payrollPage.title")} />
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

        <Card>
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
                  {t("payrollPage.profiles.title")}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("payrollPage.profiles.description")}
                </p>
              </div>
              <form
                onSubmit={submitSearch}
                className="flex w-full gap-2 sm:max-w-md"
              >
                <Input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder={t("payrollPage.searchPlaceholder")}
                  aria-label={t("payrollPage.searchPlaceholder")}
                />
                <button
                  type="submit"
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600"
                >
                  {t("common.search")}
                </button>
              </form>
            </div>

            {errorKey ? (
              <p
                className="py-10 text-center text-sm text-error-600 dark:text-error-400"
                role="alert"
              >
                {t(errorKey)}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                    <thead>
                      <tr className="text-start text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                        <th scope="col" className="px-3 py-3 text-start">
                          {t("payrollPage.table.employee")}
                        </th>
                        <th scope="col" className="px-3 py-3 text-start">
                          {t("payrollPage.table.department")}
                        </th>
                        <th scope="col" className="px-3 py-3 text-start">
                          {t("payrollPage.table.baseSalary")}
                        </th>
                        <th scope="col" className="px-3 py-3 text-start">
                          {t("payrollPage.table.frequency")}
                        </th>
                        <th scope="col" className="px-3 py-3 text-start">
                          {t("payrollPage.table.grade")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {rows.map(({ employee, payroll }) => (
                        <tr key={employee.id} className="text-sm">
                          <td className="px-3 py-4 whitespace-nowrap">
                            <Link
                              to={`/employees/${employee.id}`}
                              className="font-medium text-gray-800 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-300"
                            >
                              {employee.displayName}
                            </Link>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {employee.employeeNumber || employee.workEmail}
                            </p>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                            {employee.department ||
                              t("payrollPage.notProvided")}
                          </td>
                          <td className="px-3 py-4 font-medium whitespace-nowrap text-gray-800 dark:text-gray-200">
                            {formatSalary(
                              payroll.baseSalary,
                              payroll.currency,
                              i18n.language,
                            ) || t("payrollPage.notProvided")}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                            {payroll.payFrequency
                              ? t(
                                  `payrollPage.frequencies.${payroll.payFrequency}`,
                                )
                              : t("payrollPage.notProvided")}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                            {payroll.payGrade || t("payrollPage.notProvided")}
                          </td>
                        </tr>
                      ))}
                      {!isLoading && rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                          >
                            {t("payrollPage.empty")}
                          </td>
                        </tr>
                      )}
                      {isLoading && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                          >
                            {t("payrollPage.loading")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("payrollPage.pagination", {
                      from: total === 0 ? 0 : (page - 1) * pageSize + 1,
                      to: Math.min(page * pageSize, total),
                      total,
                    })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPage((current) => Math.max(1, current - 1))
                      }
                      disabled={page <= 1 || isLoading}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                    >
                      {t("payrollPage.previous")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPage((current) => Math.min(pageCount, current + 1))
                      }
                      disabled={page >= pageCount || isLoading}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                    >
                      {t("payrollPage.next")}
                    </button>
                  </div>
                </div>
                <p className="flex items-start gap-2 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <UserMoneyIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  {t("payrollPage.scopeNote")}
                </p>
              </>
            )}
          </section>
        </Card>
      </div>
    </>
  );
}
