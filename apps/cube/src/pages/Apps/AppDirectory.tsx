import PageMeta from "@/components/common/PageMeta";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import type { ApplicationCatalogItem } from "@cgsi/contracts/catalog";
import { WorkspaceAppCard } from "@cgsi/ui";

export default function AppDirectory() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [apps, setApps] = useState<ApplicationCatalogItem[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadApps = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      const response = await fetch("/api/v1/apps", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (response.status === 401) {
        const returnTo = encodeURIComponent(location.pathname);
        navigate(`/signin?returnTo=${returnTo}`, { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error("catalog_unavailable");
      }

      const data = (await response.json()) as { apps: ApplicationCatalogItem[] };
      setApps(data.apps);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  const filteredApps = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return apps;
    }

    return apps.filter((app) => {
      const name = t(`cube.apps.${app.id}.name`, { defaultValue: app.name });
      const description = t(`cube.apps.${app.id}.description`, {
        defaultValue: app.description,
      });
      return `${name} ${description}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  }, [apps, query, t]);

  return (
    <>
      <PageMeta
        title={t("cube.directory.pageTitle")}
        description={t("cube.directory.pageDescription")}
      />
      <PageBreadcrumb pageTitle={t("cube.directory.appsHeading")} />
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] md:p-8">
          <p className="text-sm font-medium text-brand-600 dark:text-brand-400">
            {t("cube.directory.eyebrow")}
          </p>
          <div className="mt-3 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90 sm:text-title-md">
                {t("cube.directory.heading")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
                {t("cube.directory.subtitle")}
              </p>
            </div>
            <label className="relative w-full md:max-w-xs">
              <span className="sr-only">{t("cube.directory.searchLabel")}</span>
              <input
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:text-white/90 dark:placeholder:text-gray-500"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("cube.directory.searchPlaceholder")}
                type="search"
                value={query}
              />
            </label>
          </div>
        </section>

        <section aria-labelledby="app-list-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                className="text-lg font-semibold text-gray-800 dark:text-white/90"
                id="app-list-heading"
              >
                {t("cube.directory.appsHeading")}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("cube.directory.appsCount", { count: filteredApps.length })}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
              {t("cube.directory.loading")}
            </div>
          ) : hasError ? (
            <div className="rounded-xl border border-error-200 bg-error-50 p-6 dark:border-error-500/30 dark:bg-error-500/10">
              <p className="text-sm font-medium text-error-600 dark:text-error-400">
                {t("cube.directory.loadError")}
              </p>
              <div className="mt-4">
                <Button onClick={() => void loadApps()} size="sm">
                  {t("cube.directory.retry")}
                </Button>
              </div>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
              {t("cube.directory.noResults")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredApps.map((app) => (
                <WorkspaceAppCard
                  actionText={
                    app.status !== "available"
                      ? t("cube.directory.actions.comingSoon")
                      : app.canAccess
                        ? t("cube.directory.actions.open")
                        : t("cube.directory.actions.noAccess")
                  }
                  accent={app.accent}
                  available={app.status === "available"}
                  canAccess={app.canAccess}
                  description={t(`cube.apps.${app.id}.description`, {
                    defaultValue: app.description,
                  })}
                  href={app.href}
                  initials={app.initials}
                  key={app.id}
                  name={t(`cube.apps.${app.id}.name`, {
                    defaultValue: app.name,
                  })}
                  statusText={t(`cube.directory.status.${app.status}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
