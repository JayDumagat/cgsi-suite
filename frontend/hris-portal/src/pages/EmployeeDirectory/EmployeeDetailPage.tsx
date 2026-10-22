import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import {
  EmployeeDirectoryRequestError,
  getEmployee,
  type EmployeeMasterRecord,
} from "@/components/employee-directory/employeeDirectoryApi";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

function initialsFor(name: string) {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

function formatDate(value: string | null, locale: string, emptyLabel: string) {
  if (!value) return emptyLabel;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function statusClass(status: EmployeeMasterRecord["employmentStatus"]) {
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

function detailErrorKey(error: unknown) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden") {
      return "employeeDirectory.errors.accessDenied";
    }
    if (error.status === 404 || error.code === "employee_not_found") {
      return "employeeDirectory.errors.notFound";
    }
  }
  return "employeeDirectory.errors.loadFailed";
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-5 py-2.5">
      <dt className="w-1/2 text-sm text-gray-500 sm:w-1/3 dark:text-gray-400">
        {label}
      </dt>
      <dd className="w-1/2 break-words text-sm text-gray-700 sm:w-2/3 dark:text-gray-400">
        {value}
      </dd>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { t, i18n } = useTranslation();
  const { employeeId } = useParams();
  const [employee, setEmployee] = useState<EmployeeMasterRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const notProvided = t("employeeDirectory.notProvided");

  useEffect(() => {
    if (!employeeId) {
      setErrorKey("employeeDirectory.errors.notFound");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setErrorKey(null);

    void getEmployee(employeeId, controller.signal)
      .then((record) => setEmployee(record))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setEmployee(null);
        setErrorKey(detailErrorKey(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [employeeId]);

  const displayedName = employee?.displayName ?? t("employeeDirectory.details.title");
  const pageTitle = `${displayedName} | ERIS`;

  return (
    <>
      <PageMeta
        title={pageTitle}
        description={t("employeeDirectory.details.description")}
      />
      <PageBreadcrumb pageTitle={t("employeeDirectory.details.title")} />

      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400">
          {t("employeeDirectory.table.loading")}
        </div>
      ) : errorKey ? (
        <div
          className="rounded-2xl border border-error-200 bg-error-50 p-6 dark:border-error-500/30 dark:bg-error-500/10"
          role="alert"
        >
          <p className="text-sm text-error-700 dark:text-error-400">{t(errorKey)}</p>
          <Link
            to="/employees"
            className="mt-4 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/3"
          >
            {t("employeeDirectory.details.backToDirectory")}
          </Link>
        </div>
      ) : employee ? (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-6 rounded-2xl border border-gray-200 bg-white px-6 py-5 sm:flex-row sm:items-center dark:border-gray-800 dark:bg-white/3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
              >
                {initialsFor(employee.displayName)}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-semibold text-gray-800 dark:text-white/90">
                    {employee.displayName}
                  </h1>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(employee.employmentStatus)}`}
                  >
                    {t(`employeeDirectory.statuses.${employee.employmentStatus}`)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {employee.jobTitle || notProvided}
                  {employee.department ? ` · ${employee.department}` : ""}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t("employeeDirectory.fields.employeeNumber")}: {employee.employeeNumber || notProvided}
                </p>
              </div>
            </div>

            <Link
              to="/employees"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/3"
            >
              {t("employeeDirectory.details.backToDirectory")}
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8 2xl:col-span-9">
              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3">
                <h2 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
                  {t("employeeDirectory.sections.personalInformation")}
                </h2>
                <dl className="divide-y divide-gray-100 dark:divide-gray-800">
                  <InfoRow label={t("employeeDirectory.fields.firstName")} value={employee.firstName || notProvided} />
                  <InfoRow label={t("employeeDirectory.fields.middleName")} value={employee.middleName || notProvided} />
                  <InfoRow label={t("employeeDirectory.fields.lastName")} value={employee.lastName || notProvided} />
                  <InfoRow label={t("employeeDirectory.fields.suffix")} value={employee.suffix || notProvided} />
                  <InfoRow label={t("employeeDirectory.fields.preferredName")} value={employee.preferredName || notProvided} />
                </dl>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3">
                <h2 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
                  {t("employeeDirectory.sections.education")}
                </h2>
                <dl className="divide-y divide-gray-100 dark:divide-gray-800">
                  <InfoRow label={t("employeeDirectory.fields.educationLevel")} value={employee.educationLevel || notProvided} />
                  <InfoRow label={t("employeeDirectory.fields.educationInstitution")} value={employee.educationInstitution || notProvided} />
                  <InfoRow label={t("employeeDirectory.fields.educationField")} value={employee.educationField || notProvided} />
                  <InfoRow label={t("employeeDirectory.fields.graduationYear")} value={employee.graduationYear?.toString() || notProvided} />
                </dl>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3">
                <h2 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
                  {t("employeeDirectory.details.employmentInformation")}
                </h2>
                <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
                  <dl className="divide-y divide-gray-100 dark:divide-gray-800">
                  <InfoRow
                    label={t("employeeDirectory.fields.department")}
                    value={employee.department || notProvided}
                  />
                  <InfoRow
                    label={t("employeeDirectory.fields.jobTitle")}
                    value={employee.jobTitle || notProvided}
                  />
                  <InfoRow
                    label={t("employeeDirectory.fields.employmentType")}
                    value={t(`employeeDirectory.employmentTypes.${employee.employmentType}`)}
                  />
                  <InfoRow
                    label={t("employeeDirectory.fields.status")}
                    value={t(`employeeDirectory.statuses.${employee.employmentStatus}`)}
                  />
                  <InfoRow
                    label={t("employeeDirectory.fields.hireDate")}
                    value={formatDate(employee.hireDate, i18n.language, notProvided)}
                  />
                  <InfoRow
                    label={t("employeeDirectory.fields.terminationDate")}
                    value={formatDate(employee.terminationDate, i18n.language, notProvided)}
                  />
                  <InfoRow
                    label={t("employeeDirectory.fields.workLocation")}
                    value={employee.workLocation || notProvided}
                  />
                  </dl>
                </div>
              </section>
            </div>

            <div className="space-y-6 lg:col-span-4 2xl:col-span-3">
              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3">
                <h2 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
                  {t("employeeDirectory.sections.personalContact")}
                </h2>
                <dl className="divide-y divide-gray-100 dark:divide-gray-800">
                  <InfoRow
                    label={t("employeeDirectory.fields.personalEmail")}
                    value={employee.personalEmail || notProvided}
                  />
                  <InfoRow
                    label={t("employeeDirectory.fields.personalPhone")}
                    value={employee.personalPhone || notProvided}
                  />
                </dl>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3">
                <h2 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
                  {t("employeeDirectory.details.workContact")}
                </h2>
                <dl className="divide-y divide-gray-100 dark:divide-gray-800">
                  <InfoRow
                    label={t("employeeDirectory.fields.workEmail")}
                    value={employee.workEmail}
                  />
                  <InfoRow
                    label={t("employeeDirectory.fields.workPhone")}
                    value={employee.workPhone || notProvided}
                  />
                  <InfoRow
                    label={t("employeeDirectory.fields.manager")}
                    value={employee.managerName || notProvided}
                  />
                  {employee.managerWorkEmail && (
                    <InfoRow
                      label={t("employeeDirectory.fields.managerEmail")}
                      value={employee.managerWorkEmail}
                    />
                  )}
                </dl>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3">
                <h2 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
                  {t("employeeDirectory.details.recordInformation")}
                </h2>
                <dl className="divide-y divide-gray-100 dark:divide-gray-800">
                  <InfoRow
                    label={t("employeeDirectory.fields.updatedAt")}
                    value={formatDate(employee.updatedAt, i18n.language, notProvided)}
                  />
                </dl>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
