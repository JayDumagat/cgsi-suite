import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import { Card } from "@/components/ui/card";
import {
  EmployeeDirectoryRequestError,
  listEmployees,
  type EmployeeDirectoryItem,
  type EmployeeDirectoryResponse,
  type EmploymentStatus,
  type EmploymentType,
} from "@/components/employee-directory/employeeDirectoryApi";
import { GroupIcon, TimeIcon, UserCircleIcon } from "@/icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

const pageSize = 100;
const unassignedKey = "__unassigned__";
const employmentTypes: EmploymentType[] = [
  "full_time",
  "part_time",
  "contractor",
  "temporary",
  "intern",
];
const employmentStatuses: EmploymentStatus[] = [
  "active",
  "on_leave",
  "disabled",
  "offboarded",
];

interface DepartmentGroup {
  key: string;
  name: string;
  employees: EmployeeDirectoryItem[];
}

function loadErrorKey(error: unknown) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden") {
      return "employeeDirectory.errors.accessDenied";
    }
  }
  return "organizationPage.errors.loadFailed";
}

export default function OrganizationPage() {
  const { t, i18n } = useTranslation();
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [summary, setSummary] = useState<
    EmployeeDirectoryResponse["summary"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrganization() {
      setIsLoading(true);
      setErrorKey(null);
      try {
        const firstPage = await listEmployees(
          {
            query: "",
            page: 1,
            pageSize,
            sortBy: "department",
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
                sortBy: "department",
                sortOrder: "asc",
              },
              controller.signal,
            ),
          ),
        );

        if (controller.signal.aborted) return;
        setEmployees([
          ...firstPage.items,
          ...remainingPages.flatMap((page) => page.items),
        ]);
        setSummary(firstPage.summary);
      } catch (error) {
        if (controller.signal.aborted) return;
        setEmployees([]);
        setSummary(null);
        setErrorKey(loadErrorKey(error));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadOrganization();
    return () => controller.abort();
  }, []);

  const numberFormat = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language],
  );
  const departmentGroups = useMemo(() => {
    const groups = new Map<string, DepartmentGroup>();
    for (const employee of employees) {
      const label = employee.department?.trim();
      const key = label ? label.toLocaleLowerCase() : unassignedKey;
      const group = groups.get(key) ?? {
        key,
        name: label || t("organizationPage.unassigned"),
        employees: [],
      };
      group.employees.push(employee);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => {
      if (a.key === unassignedKey) return 1;
      if (b.key === unassignedKey) return -1;
      return a.name.localeCompare(b.name, i18n.language, {
        sensitivity: "base",
      });
    });
  }, [employees, i18n.language, t]);
  const activeCount = employees.filter(
    (employee) => employee.employmentStatus === "active",
  ).length;
  const departmentCount = departmentGroups.filter(
    (group) => group.key !== unassignedKey,
  ).length;
  const employmentTypeCounts = employmentTypes.map((type) => ({
    key: type,
    label: t(`employeeDirectory.employmentTypes.${type}`),
    count: employees.filter((employee) => employee.employmentType === type)
      .length,
  }));
  const employmentStatusCounts = employmentStatuses.map((status) => ({
    key: status,
    label: t(`employeeDirectory.statuses.${status}`),
    count: employees.filter((employee) => employee.employmentStatus === status)
      .length,
  }));

  const statCards = [
    {
      label: t("organizationPage.totalEmployees"),
      value: summary?.totalEmployees ?? employees.length,
      icon: <UserCircleIcon className="size-5" aria-hidden="true" />,
    },
    {
      label: t("organizationPage.departments"),
      value: departmentCount,
      icon: <GroupIcon className="size-5" aria-hidden="true" />,
    },
    {
      label: t("organizationPage.activeEmployees"),
      value: activeCount,
      icon: <UserCircleIcon className="size-5" aria-hidden="true" />,
    },
    {
      label: t("organizationPage.onLeave"),
      value: summary?.onLeaveEmployees ?? 0,
      icon: <TimeIcon className="size-5" aria-hidden="true" />,
    },
  ];

  return (
    <>
      <PageMeta
        title={`${t("organizationPage.title")} | ERIS`}
        description={t("organizationPage.description")}
      />
      <div className="space-y-6">
        <PageBreadcrumb pageTitle={t("organizationPage.title")} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            {t("organizationPage.description")}
          </p>
          <Link
            to="/employees"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            {t("organizationPage.viewEmployeeDirectory")}
          </Link>
        </div>

        {errorKey ? (
          <div className="py-12 text-center">
            <p
              className="text-sm text-error-600 dark:text-error-400"
              role="alert"
            >
              {t(errorKey)}
            </p>
          </div>
        ) : (
          <>
            <section
              aria-label={t("organizationPage.overview")}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              {statCards.map((card) => (
                <Card key={card.label}>
                  <article>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {card.label}
                      </p>
                      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                        {card.icon}
                      </span>
                    </div>
                    <p className="mt-4 text-2xl font-semibold text-gray-800 dark:text-white/90">
                      {isLoading ? "—" : numberFormat.format(card.value)}
                    </p>
                  </article>
                </Card>
              ))}
            </section>

            <section
              aria-labelledby="organization-departments-heading"
              className="space-y-4"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id="organization-departments-heading"
                    className="text-lg font-semibold text-gray-800 dark:text-white/90"
                  >
                    {t("organizationPage.departmentOverview")}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t("organizationPage.departmentDescription")}
                  </p>
                </div>
              </div>

              {isLoading ? (
                <p className="py-5 text-sm text-gray-500 dark:text-gray-400">
                  {t("organizationPage.loading")}
                </p>
              ) : departmentGroups.length === 0 ? (
                <p className="py-5 text-sm text-gray-500 dark:text-gray-400">
                  {t("organizationPage.noDepartments")}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {departmentGroups.map((department) => {
                    const percentage =
                      employees.length > 0
                        ? Math.round(
                            (department.employees.length / employees.length) *
                              100,
                          )
                        : 0;
                    const activeEmployees = department.employees.filter(
                      (employee) => employee.employmentStatus === "active",
                    ).length;
                    const onLeaveEmployees = department.employees.filter(
                      (employee) => employee.employmentStatus === "on_leave",
                    ).length;
                    return (
                      <Card key={department.key}>
                        <article>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300">
                                <GroupIcon
                                  className="size-5"
                                  aria-hidden="true"
                                />
                              </span>
                              <span className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                                {department.name}
                              </span>
                            </div>
                            <span className="shrink-0 text-sm font-medium text-gray-600 dark:text-gray-300">
                              {numberFormat.format(department.employees.length)}
                            </span>
                          </div>
                          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className="h-full rounded-full bg-brand-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="mt-4 flex items-center justify-between gap-4 text-xs">
                            <span className="text-gray-500 dark:text-gray-400">
                              {t("organizationPage.activeInDepartment")}
                              <strong className="ms-2 font-semibold text-gray-700 dark:text-gray-200">
                                {numberFormat.format(activeEmployees)}
                              </strong>
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {t("organizationPage.onLeave")}
                              <strong className="ms-2 font-semibold text-gray-700 dark:text-gray-200">
                                {numberFormat.format(onLeaveEmployees)}
                              </strong>
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                            {numberFormat.format(percentage)}%{" "}
                            {t("organizationPage.ofWorkforce")}
                          </p>
                        </article>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            <section
              aria-labelledby="organization-workforce-heading"
              className="space-y-4"
            >
              <div>
                <h2
                  id="organization-workforce-heading"
                  className="text-lg font-semibold text-gray-800 dark:text-white/90"
                >
                  {t("organizationPage.workforceComposition")}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("organizationPage.workforceDescription")}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card>
                  <section>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                      {t("organizationPage.employmentTypeDistribution")}
                    </h3>
                    <div className="mt-5 space-y-4">
                      {employmentTypeCounts.map((item) => {
                        const percentage =
                          employees.length > 0
                            ? (item.count / employees.length) * 100
                            : 0;
                        return (
                          <div key={item.key}>
                            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                              <span className="text-gray-600 dark:text-gray-300">
                                {item.label}
                              </span>
                              <span className="font-medium text-gray-800 dark:text-white/90">
                                {numberFormat.format(item.count)}
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </Card>

                <Card>
                  <section>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                      {t("organizationPage.employmentStatusDistribution")}
                    </h3>
                    <div className="mt-5 space-y-4">
                      {employmentStatusCounts.map((item) => {
                        const percentage =
                          employees.length > 0
                            ? (item.count / employees.length) * 100
                            : 0;
                        return (
                          <div key={item.key}>
                            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                              <span className="text-gray-600 dark:text-gray-300">
                                {item.label}
                              </span>
                              <span className="font-medium text-gray-800 dark:text-white/90">
                                {numberFormat.format(item.count)}
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </Card>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
