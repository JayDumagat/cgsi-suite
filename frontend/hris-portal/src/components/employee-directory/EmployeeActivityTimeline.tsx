import {
  getEmployeeActivity,
  type EmployeeActivityEntry,
} from "@/components/employee-directory/employeeDirectoryApi";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface EmployeeActivityTimelineProps {
  employeeId: string;
}

function initialsFor(name: string) {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

export default function EmployeeActivityTimeline({ employeeId }: EmployeeActivityTimelineProps) {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<EmployeeActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setHasError(false);

    void getEmployeeActivity(employeeId, controller.signal)
      .then(setEntries)
      .catch(() => {
        if (!controller.signal.aborted) {
          setEntries([]);
          setHasError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [employeeId]);

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t("employeeDirectory.activity.loading")}</p>;
  }

  if (hasError) {
    return <p className="text-sm text-error-600 dark:text-error-400" role="alert">{t("employeeDirectory.activity.loadFailed")}</p>;
  }

  if (entries.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t("employeeDirectory.activity.empty")}</p>;
  }

  const dateTimeFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="relative" role="list">
      <div aria-hidden="true" className="absolute inset-s-5 top-5 bottom-5 w-px bg-gray-200 dark:bg-gray-800" />
      {entries.map((entry, index) => {
        const actorName = entry.actorName || t("employeeDirectory.activity.unknownActor");
        const timestamp = new Date(entry.occurredAt);

        return (
          <article
            key={entry.id}
            role="listitem"
            className={`relative flex ${index < entries.length - 1 ? "mb-7" : ""}`}
          >
            <div aria-hidden="true" className="z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600 ring-4 ring-white dark:bg-brand-500/15 dark:text-brand-300 dark:ring-gray-900">
              {initialsFor(actorName) || "?"}
            </div>
            <div className="ms-4 min-w-0 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">{actorName}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t(`employeeDirectory.activity.actions.${entry.action}`)}
                </p>
              </div>
              {entry.changedFields.length > 0 && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  {t("employeeDirectory.activity.changedFields")}: {entry.changedFields
                    .map((field) => t(`employeeDirectory.fields.${field}`, { defaultValue: field }))
                    .join(", ")}
                </p>
              )}
              <time dateTime={entry.occurredAt} className="mt-2 block text-xs text-gray-400 dark:text-gray-500">
                {Number.isFinite(timestamp.getTime()) ? dateTimeFormat.format(timestamp) : entry.occurredAt}
              </time>
            </div>
          </article>
        );
      })}
    </div>
  );
}
