import type { EmployeeEducationHistoryEntry } from "@/components/employee-directory/employeeDirectoryApi";
import { DocsIcon } from "@/icons";
import { useTranslation } from "react-i18next";

interface EducationHistoryTimelineProps {
  entries: EmployeeEducationHistoryEntry[];
  bare?: boolean;
}

export default function EducationHistoryTimeline({ entries, bare = false }: EducationHistoryTimelineProps) {
  const { t } = useTranslation();

  return (
    <div className={bare ? "" : "rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3"}>
      {!bare && (
        <h2 className="mb-5 text-base font-semibold text-gray-800 dark:text-white/90">
          {t("employeeDirectory.sections.education")}
        </h2>
      )}
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("employeeDirectory.educationHistory.empty")}
        </p>
      ) : (
        <div className="relative" role="list">
          <div
            aria-hidden="true"
            className="absolute inset-s-5 top-5 bottom-5 w-px bg-gray-200 dark:bg-gray-800"
          />
          {entries.map((entry, index) => {
            const title = entry.institution || entry.fieldOfStudy || entry.educationLevel || t("employeeDirectory.notProvided");
            const subtitle = [entry.educationLevel, entry.fieldOfStudy]
              .filter((value) => value && value !== title)
              .join(" · ");
            const period = entry.startYear && entry.graduationYear
              ? t("employeeDirectory.educationHistory.attended", {
                  startYear: entry.startYear,
                  endYear: entry.graduationYear,
                })
              : entry.graduationYear
                ? t("employeeDirectory.educationHistory.graduatedIn", { year: entry.graduationYear })
                : entry.startYear
                  ? t("employeeDirectory.educationHistory.startedIn", { year: entry.startYear })
                  : null;

            return (
              <article
                key={entry.id}
                role="listitem"
                className={`relative flex ${index < entries.length - 1 ? "mb-6" : ""}`}
              >
                <div className="z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-4 ring-white dark:bg-brand-500/15 dark:text-brand-300 dark:ring-gray-900">
                  <DocsIcon className="size-5" aria-hidden="true" />
                </div>
                <div className="ms-4 min-w-0 pt-0.5">
                  <p className="mb-1 text-theme-xs font-medium text-brand-500">
                    {t("employeeDirectory.educationHistory.entry")}
                  </p>
                  <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
                      {subtitle}
                    </p>
                  )}
                  {period && (
                    <p className="mt-2 text-theme-xs text-gray-400">
                      {period}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
