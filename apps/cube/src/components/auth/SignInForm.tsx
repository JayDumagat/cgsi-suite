import { ChevronLeftIcon } from "@/icons";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export default function SignInForm() {
  const { t } = useTranslation();
  const hasProviderError = new URLSearchParams(window.location.search).has("error");
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-md pt-10">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="size-5 rtl:rotate-180" />
          {t("auth.backToCube")}
        </Link>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
              {t("auth.signInTitle")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("auth.signInDescription")}
            </p>
            {hasProviderError && (
              <p
                className="mt-3 rounded-lg bg-error-50 p-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
                role="alert"
              >
                {t("auth.providerError")}
              </p>
            )}
          </div>
          <div>
            <a
              className="inline-flex w-full items-center justify-center gap-3 rounded-lg bg-gray-100 px-7 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
              href={`/api/auth/login?returnTo=${encodeURIComponent(new URLSearchParams(window.location.search).get("returnTo") || "/")}`}
            >
              <span aria-hidden="true" className="grid size-5 grid-cols-2 gap-0.5">
                <span className="bg-error-500" />
                <span className="bg-success-500" />
                <span className="bg-blue-light-500" />
                <span className="bg-warning-500" />
              </span>
              {t("auth.signInWithMicrosoft")}
            </a>
            <p className="mt-4 text-center text-sm leading-6 text-gray-500 dark:text-gray-400">
              {t("auth.organizationAccountOnly")}
            </p>
            <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-white/5">
              <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
                {t("auth.deviceComplianceNote")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
