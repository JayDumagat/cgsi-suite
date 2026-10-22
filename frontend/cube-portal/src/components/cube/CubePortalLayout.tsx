import PortalHeader from "@/components/cube/PortalHeader";
import PortalLoading from "@/components/cube/PortalLoading";
import { usePortalSession } from "@/context/PortalSessionContext";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router";

export default function CubePortalLayout() {
  const { t } = useTranslation();
  const { status, refresh } = usePortalSession();
  const location = useLocation();
  const [isRetrying, setIsRetrying] = useState(false);

  if (status === "loading") return <PortalLoading />;
  if (status === "anonymous") {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (status === "unavailable") {
    const retry = async () => {
      setIsRetrying(true);
      await refresh();
      setIsRetrying(false);
    };

    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
        <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("cubePortal.sessionUnavailableTitle")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t("cubePortal.sessionUnavailableDescription")}
          </p>
          <button
            type="button"
            disabled={isRetrying}
            onClick={() => void retry()}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60"
          >
            {isRetrying ? t("cubePortal.loading") : t("cubePortal.tryAgain")}
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PortalHeader />
      <main className="mx-auto min-h-[calc(100vh-76px)] max-w-(--breakpoint-2xl) px-4 py-7 md:px-6 md:py-9">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-4 text-xs text-gray-500 dark:text-gray-400 md:px-6">
          {t("cubePortal.portalFooter")}
        </div>
      </footer>
    </div>
  );
}
