import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import {
  GroupIcon,
  MultiUserIcon,
  UserCircleIcon,
  UserMoneyIcon,
} from "@/icons";
import { useTranslation } from "react-i18next";
import {
  EmptyModuleState,
  HrStatCard,
  ModuleSection,
} from "./HrModuleComponents";

const recruitmentAreas = [
  "openings",
  "candidates",
  "interviews",
  "offers",
] as const;

export default function RecruitmentPage() {
  const { t } = useTranslation();

  return (
    <>
      <PageMeta
        title={`${t("recruitmentPage.title")} | ERIS`}
        description={t("recruitmentPage.description")}
      />
      <div className="space-y-6">
        <PageBreadcrumb pageTitle={t("recruitmentPage.title")} />
        <header>
          <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
            {t("recruitmentPage.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            {t("recruitmentPage.description")}
          </p>
        </header>

        <section
          aria-label={t("recruitmentPage.overview")}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <HrStatCard
            label={t("recruitmentPage.stats.openings")}
            value="—"
            icon={<GroupIcon className="size-5" />}
          />
          <HrStatCard
            label={t("recruitmentPage.stats.candidates")}
            value="—"
            icon={<MultiUserIcon className="size-5" />}
            tone="purple"
          />
          <HrStatCard
            label={t("recruitmentPage.stats.interviews")}
            value="—"
            icon={<UserCircleIcon className="size-5" />}
            tone="warning"
          />
          <HrStatCard
            label={t("recruitmentPage.stats.offers")}
            value="—"
            icon={<UserMoneyIcon className="size-5" />}
            tone="success"
          />
        </section>

        <ModuleSection
          title={t("recruitmentPage.pipeline.title")}
          description={t("recruitmentPage.pipeline.description")}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {recruitmentAreas.map((area) => (
              <div
                key={area}
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
              >
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {t(`recruitmentPage.areas.${area}`)}
                </p>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {t("recruitmentPage.pipeline.notConnected")}
                </p>
              </div>
            ))}
          </div>
          <EmptyModuleState
            title={t("recruitmentPage.empty.title")}
            description={t("recruitmentPage.empty.description")}
          />
        </ModuleSection>
      </div>
    </>
  );
}
