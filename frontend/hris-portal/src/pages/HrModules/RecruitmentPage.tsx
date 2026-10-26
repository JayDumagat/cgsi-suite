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

const pipelineStages = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
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
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
              {t("recruitmentPage.title")}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              {t("recruitmentPage.description")}
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-warning-200 bg-warning-50 px-3 py-1.5 text-xs font-medium text-warning-700 dark:border-warning-500/25 dark:bg-warning-500/10 dark:text-warning-300">
            <span className="size-1.5 rounded-full bg-warning-500" aria-hidden="true" />
            {t("recruitmentPage.pipeline.notConnected")}
          </div>
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
          <ol
            aria-label={t("recruitmentPage.pipeline.title")}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
          >
            {pipelineStages.map((stage, index) => (
              <li
                key={stage}
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">
                    —
                  </span>
                </div>
                <p className="mt-4 text-sm font-medium text-gray-800 dark:text-white/90">
                  {t(`recruitmentPage.pipeline.stages.${stage}`)}
                </p>
              </li>
            ))}
          </ol>
        </ModuleSection>

        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
          <ModuleSection
            title={t("recruitmentPage.stats.openings")}
            description={t("recruitmentPage.positions.description")}
          >
            <EmptyModuleState
              title={t("recruitmentPage.positions.emptyTitle")}
              description={t("recruitmentPage.positions.emptyDescription")}
            />
          </ModuleSection>

          <ModuleSection
            title={t("recruitmentPage.interviewSchedule.title")}
            description={t("recruitmentPage.interviewSchedule.description")}
          >
            <EmptyModuleState
              title={t("recruitmentPage.interviewSchedule.emptyTitle")}
              description={t("recruitmentPage.interviewSchedule.emptyDescription")}
            />
          </ModuleSection>
        </div>
      </div>
    </>
  );
}
