import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import DataTableOne, {
  type DataTableOneColumn,
} from "@/components/tables/DataTables/TableOne/DataTableOne";
import {
  EmployeeDirectoryRequestError,
  listEmployees,
  type EmployeeDirectoryItem,
  type EmployeeDirectoryResponse,
  type EmployeeSortKey,
} from "@/components/employee-directory/employeeDirectoryApi";
import { PlusIcon } from "@/icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

type SortOrder = "asc" | "desc";

function initialsFor(name: string) {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

function formatHireDate(value: string | null, locale: string) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function statusClass(status: EmployeeDirectoryItem["employmentStatus"]) {
  if (status === "active") {
    return "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400";
  }
  if (status === "on_leave") {
    return "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300";
  }
  if (status === "disabled") {
    return "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400";
  }
  return "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300";
}

function requestErrorKey(error: unknown) {
  if (!(error instanceof EmployeeDirectoryRequestError)) {
    return "employeeDirectory.errors.loadFailed";
  }
  if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
  if (error.status === 403 || error.code === "forbidden") {
    return "employeeDirectory.errors.accessDenied";
  }
  return "employeeDirectory.errors.loadFailed";
}

export default function EmployeeDirectoryPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [directory, setDirectory] = useState<EmployeeDirectoryResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<EmployeeSortKey>("displayName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchTerm.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setErrorKey(null);

    void listEmployees(
      {
        query: searchQuery,
        page,
        pageSize,
        sortBy: sortKey,
        sortOrder,
      },
      controller.signal,
    )
      .then((result) => setDirectory(result))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDirectory(null);
        setErrorKey(requestErrorKey(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [searchQuery, page, pageSize, sortKey, sortOrder]);

  const columns = useMemo<DataTableOneColumn<EmployeeDirectoryItem>[]>(
    () => [
      {
        key: "employee",
        label: t("employeeDirectory.fields.employee"),
        sortKey: "displayName",
        className: "min-w-64",
        render: (employee) => (
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
            >
              {initialsFor(employee.displayName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-gray-800 dark:text-white/90">
                {employee.displayName}
              </span>
              <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">
                {employee.workEmail}
              </span>
            </span>
          </div>
        ),
      },
      {
        key: "department",
        label: t("employeeDirectory.fields.department"),
        sortKey: "department",
        render: (employee) => employee.department || "—",
      },
      {
        key: "jobTitle",
        label: t("employeeDirectory.fields.jobTitle"),
        sortKey: "jobTitle",
        render: (employee) => employee.jobTitle || "—",
      },
      {
        key: "hireDate",
        label: t("employeeDirectory.fields.hireDate"),
        sortKey: "hireDate",
        render: (employee) => formatHireDate(employee.hireDate, i18n.language),
      },
      {
        key: "employmentStatus",
        label: t("employeeDirectory.fields.status"),
        sortKey: "employmentStatus",
        render: (employee) => (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(employee.employmentStatus)}`}
          >
            {t(`employeeDirectory.statuses.${employee.employmentStatus}`)}
          </span>
        ),
      },
    ],
    [i18n.language, t],
  );

  const summary = directory?.summary;
  const numberFormat = new Intl.NumberFormat(i18n.language);
  const tenureFormat = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  const totalItems = directory?.total ?? 0;
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const showingMessage = t("employeeDirectory.table.showing", {
    start: numberFormat.format(start),
    end: numberFormat.format(end),
    total: numberFormat.format(totalItems),
  });

  const sortByColumn = (nextKey: string) => {
    if (nextKey === sortKey) {
      setSortOrder((previous) => (previous === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(nextKey as EmployeeSortKey);
      setSortOrder("asc");
    }
    setPage(1);
  };

  return (
    <>
      <PageMeta
        title={`${t("employeeDirectory.title")} | ERIS`}
        description={t("employeeDirectory.description")}
      />
      <PageBreadcrumb
        pageTitle={t("employeeDirectory.title")}
        breadcrumbTitle={t("employeeDirectory.breadcrumb")}
      />
      <div className="-mt-3 mb-6 flex justify-end">
        {directory?.permissions.canCreateEmployees && (
          <Link
            to="/employees/new"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
          >
            <PlusIcon className="size-5" aria-hidden="true" />
            {t("employeeDirectory.create.addEmployee")}
          </Link>
        )}
      </div>

      {summary && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: t("employeeDirectory.summary.totalEmployees"),
              value: summary.totalEmployees,
            },
            {
              label: t("employeeDirectory.summary.onLeave"),
              value: summary.onLeaveEmployees,
            },
            {
              label: t("employeeDirectory.summary.newHires"),
              value: summary.newHires,
            },
            {
              label: t("employeeDirectory.summary.averageTenure"),
              value: summary.averageTenureYears === null
                ? "—"
                : `${tenureFormat.format(summary.averageTenureYears)} ${t("employeeDirectory.summary.years")}`,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                {typeof item.value === "number" ? numberFormat.format(item.value) : item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {errorKey && (
        <div
          className="mb-6 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
          role="alert"
        >
          {t(errorKey)}
        </div>
      )}

      <DataTableOne
        rows={directory?.items ?? []}
        columns={columns}
        getRowKey={(employee) => employee.id}
        getRowLabel={(employee) => employee.displayName}
        onRowClick={(employee) => navigate(`/employees/${employee.id}`)}
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        pageSizeOptions={[10, 25, 50]}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
        searchTerm={searchTerm}
        onSearchTermChange={(value) => {
          setSearchTerm(value);
          setPage(1);
        }}
        searchPlaceholder={t("employeeDirectory.table.searchPlaceholder")}
        showLabel={t("employeeDirectory.table.show")}
        entriesLabel={t("employeeDirectory.table.entries")}
        emptyMessage={t("employeeDirectory.table.empty")}
        loadingMessage={t("employeeDirectory.table.loading")}
        showingMessage={showingMessage}
        isLoading={isLoading}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSortChange={sortByColumn}
      />
    </>
  );
}
