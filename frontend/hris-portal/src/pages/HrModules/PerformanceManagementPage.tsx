import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import { CheckLineIcon, ClockIcon, GroupIcon, TaskIcon } from "@/icons";
import { useTranslation } from "react-i18next";
import {
  EmptyModuleState,
  HrStatCard,
  ModuleSection,
} from "./HrModuleComponents";

const reviewSteps = ["planning", "feedback", "review", "followUp"] as const;

export default function PerformanceManagementPage() {
  const { t } = useTranslation();

  return (
    <>
      <PageMeta
        title={`${t("performancePage.title")} | ERIS`}
        description={t("performancePage.description")}
      />
      <div className="space-y-6">
        <PageBreadcrumb pageTitle={t("performancePage.title")} />
        <header>
          <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
            {t("performancePage.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            {t("performancePage.description")}
          </p>
        </header>

        <section
          aria-label={t("performancePage.overview")}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <HrStatCard
            label={t("performancePage.stats.cycles")}
            value="—"
            icon={<TaskIcon className="size-5" />}
          />
          <HrStatCard
            label={t("performancePage.stats.dueReviews")}
            value="—"
            icon={<ClockIcon className="size-5" />}
            tone="warning"
          />
          <HrStatCard
            label={t("performancePage.stats.completed")}
            value="—"
            icon={<CheckLineIcon className="size-5" />}
            tone="success"
          />
          <HrStatCard
            label={t("performancePage.stats.participants")}
            value="—"
            icon={<GroupIcon className="size-5" />}
            tone="purple"
          />
        </section>

        <ModuleSection
          title={t("performancePage.process.title")}
          description={t("performancePage.process.description")}
        >
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {reviewSteps.map((step, index) => (
              <li
                key={step}
                className="flex gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {t(`performancePage.steps.${step}.title`)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t(`performancePage.steps.${step}.description`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </ModuleSection>

        <ModuleSection
          title={t("performancePage.reviews.title")}
          description={t("performancePage.reviews.description")}
        >
          <EmptyModuleState
            title={t("performancePage.empty.title")}
            description={t("performancePage.empty.description")}
          />
        </ModuleSection>
      </div>
    </>
  );
}
