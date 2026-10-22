import ApplicationCard from "@/components/cube/ApplicationCard";
import PageMeta from "@/components/common/PageMeta";
import { usePortalSession } from "@/context/PortalSessionContext";
import type { PortalApplication } from "@/types/portal";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";

export default function Applications() {
  const { t } = useTranslation();
  const { refresh } = usePortalSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [apps, setApps] = useState<PortalApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const query = (searchParams.get("q") ?? "").trim().toLocaleLowerCase();

  useEffect(() => {
    const controller = new AbortController();

    const loadApplications = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const response = await fetch("/api/v1/apps", {
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (response.status === 401) {
          await refresh();
          navigate("/signin?error=session", { replace: true });
          return;
        }
        if (!response.ok) throw new Error("catalog_unavailable");

        const payload = (await response.json()) as { apps?: unknown };
        if (!Array.isArray(payload.apps)) throw new Error("invalid_catalog");

        const receivedApps = payload.apps.filter((entry): entry is PortalApplication => {
          if (!entry || typeof entry !== "object") return false;
          const app = entry as Partial<PortalApplication>;
          return typeof app.id === "string" &&
            typeof app.name === "string" &&
            typeof app.description === "string" &&
            typeof app.href === "string" &&
            typeof app.status === "string" &&
            typeof app.canAccess === "boolean";
        });
        setApps(receivedApps);
      } catch {
        if (!controller.signal.aborted) setHasError(true);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadApplications();
    return () => controller.abort();
  }, [navigate, refresh, retryCount]);

  const filteredApps = useMemo(() => {
    if (!query) return apps;
    return apps.filter((app) =>
      `${app.name} ${app.id} ${app.description}`.toLocaleLowerCase().includes(query),
    );
  }, [apps, query]);

  return (
    <>
      <PageMeta title={`${t("cubePortal.applications")} | CGSI Cube`} description={t("cubePortal.description")} />
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">
            {t("cubePortal.eyebrow")}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-800 sm:text-title-sm dark:text-white/90">
            {t("cubePortal.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t("cubePortal.description")}
          </p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {t("cubePortal.applicationCount", { count: filteredApps.length })}
        </div>
      </div>

      {isLoading ? (
        <div aria-busy="true" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="min-h-56 animate-pulse rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-dark">
              <div className="size-12 rounded-xl bg-gray-100 dark:bg-white/5" />
              <div className="mt-5 h-4 w-24 rounded bg-gray-100 dark:bg-white/5" />
              <div className="mt-3 h-3 w-4/5 rounded bg-gray-100 dark:bg-white/5" />
            </div>
          ))}
        </div>
      ) : hasError ? (
        <section className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-dark">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("cubePortal.loadErrorTitle")}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t("cubePortal.loadErrorDescription")}
          </p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            {t("cubePortal.tryAgain")}
          </button>
        </section>
      ) : filteredApps.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredApps.map((app) => <ApplicationCard key={app.id} app={app} />)}
        </div>
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-dark">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("cubePortal.emptyTitle")}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t("cubePortal.emptyDescription")}
          </p>
        </section>
      )}
    </>
  );
}
