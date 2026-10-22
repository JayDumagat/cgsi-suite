import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import { usePortalSession } from "@/context/PortalSessionContext";
import { useTranslation } from "react-i18next";

export default function Profile() {
  const { t } = useTranslation();
  const { user } = usePortalSession();
  const displayName = user?.name ?? "";
  const initials = displayName
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join("");

  return (
    <>
      <PageMeta
        title={`${t("cubePortal.profile")} | CGSI Cube`}
        description={t("cubePortal.profileDescription")}
      />
      <PageBreadcrumb pageTitle={t("cubePortal.profile")} />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/3">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 lg:mb-7 dark:text-white/90">
          {t("cubePortal.profile")}
        </h3>

        <div className="rounded-2xl border border-gray-200 p-5 lg:p-6 dark:border-gray-800">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between xl:gap-10">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <div
                aria-hidden="true"
                className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-brand-50 text-xl font-semibold text-brand-600 dark:border-gray-800 dark:bg-brand-500/15 dark:text-brand-300"
              >
                {initials}
              </div>
              <div className="text-start">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {displayName}
                </h4>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {user?.email}
                </p>
              </div>
            </div>

            <span className="w-fit rounded-full bg-success-50 px-3 py-1 text-xs font-medium text-success-700 dark:bg-success-500/15 dark:text-success-400">
              {t("cubePortal.signedInWith")}
            </span>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-6 dark:border-gray-800">
            <h5 className="mb-5 text-base font-semibold text-gray-800 dark:text-white/90">
              {t("cubePortal.accountInformation")}
            </h5>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-x-11">
              <div>
                <dt className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                  {t("cubePortal.name")}
                </dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {displayName}
                </dd>
              </div>
              <div>
                <dt className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                  {t("cubePortal.email")}
                </dt>
                <dd className="break-all text-sm font-medium text-gray-800 dark:text-white/90">
                  {user?.email}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
