import { useTranslation } from "react-i18next";

export default function PortalLoading() {
  const { t } = useTranslation();

  return (
    <main
      aria-busy="true"
      className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900"
    >
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span className="size-5 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
        {t("cubePortal.loading")}
      </div>
    </main>
  );
}
