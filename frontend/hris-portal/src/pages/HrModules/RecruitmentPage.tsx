import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import {
  createRecruitmentCandidate,
  createRecruitmentInterview,
  createRecruitmentOpening,
  EmployeeDirectoryRequestError,
  getOrganizationStructure,
  getRecruitmentReport,
  listEmployees,
  updateRecruitmentCandidate,
  updateRecruitmentInterview,
  updateRecruitmentOpening,
  type EmployeeDirectoryItem,
  type OrganizationStructureResponse,
  type RecruitmentCandidate,
  type RecruitmentCandidateInput,
  type RecruitmentInterview,
  type RecruitmentInterviewInput,
  type RecruitmentOpening,
  type RecruitmentOpeningInput,
  type RecruitmentReport,
} from "@/components/employee-directory/employeeDirectoryApi";
import {
  GroupIcon,
  MultiUserIcon,
  UserCircleIcon,
  UserMoneyIcon,
} from "@/icons";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { EmptyModuleState, HrStatCard, ModuleSection } from "./HrModuleComponents";
import {
  RecruitmentCandidateForm,
  RecruitmentFormModal,
  RecruitmentInterviewForm,
  RecruitmentOpeningForm,
} from "./RecruitmentForms";

const tabs = ["openings", "candidates", "interviews"] as const;
type RecruitmentTab = (typeof tabs)[number];
type RecruitmentDialog =
  | { kind: "opening"; record?: RecruitmentOpening }
  | { kind: "candidate"; record?: RecruitmentCandidate }
  | { kind: "interview"; record?: RecruitmentInterview; candidateId?: string }
  | null;

const pipelineStages: RecruitmentCandidateInput["stage"][] = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
];

function requestErrorKey(error: unknown, saving = false): string {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403) return "recruitmentPage.errors.accessDenied";
    if (error.code === "duplicate_candidate") return "recruitmentPage.errors.duplicateCandidate";
    if (error.code === "opening_not_open") return "recruitmentPage.errors.openingNotOpen";
    if (error.code === "invalid_position") return "recruitmentPage.errors.invalidPosition";
  }
  return saving ? "recruitmentPage.errors.saveFailed" : "recruitmentPage.errors.loadFailed";
}

export default function RecruitmentPage() {
  const { t, i18n } = useTranslation();
  const [report, setReport] = useState<RecruitmentReport | null>(null);
  const [organization, setOrganization] = useState<OrganizationStructureResponse | null>(null);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<RecruitmentTab>("candidates");
  const [dialog, setDialog] = useState<RecruitmentDialog>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    getRecruitmentReport(controller.signal)
      .then((result) => setReport(result))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(requestErrorKey(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    getOrganizationStructure(controller.signal)
      .then(setOrganization)
      .catch(() => undefined);
    listEmployees(
      { query: "", page: 1, pageSize: 100, sortBy: "displayName", sortOrder: "asc" },
      controller.signal,
    )
      .then((result) => setEmployees(result.items))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const openings = report?.openings ?? [];
  const candidates = report?.candidates ?? [];
  const interviews = report?.interviews ?? [];
  const canManage = report?.permissions.canManageRecruitment === true;
  const openOpenings = useMemo(
    () => openings.filter((opening) => opening.status === "open"),
    [openings],
  );
  const upcomingInterviews = useMemo(() => {
    const now = Date.now();
    return interviews.filter(
      (interview) => interview.status === "scheduled" && new Date(interview.scheduledAt).getTime() >= now,
    );
  }, [interviews]);
  const numberFormat = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language]);

  function closeDialog() {
    if (isSaving) return;
    setActionError(null);
    setDialog(null);
  }

  async function saveOpening(input: RecruitmentOpeningInput) {
    if (dialog?.kind !== "opening") return;
    setIsSaving(true);
    setActionError(null);
    try {
      const saved = dialog.record
        ? await updateRecruitmentOpening(dialog.record.id, input)
        : await createRecruitmentOpening(input);
      setReport((current) => current ? {
        ...current,
        openings: dialog.record
          ? current.openings.map((opening) => opening.id === saved.id ? saved : opening)
          : [saved, ...current.openings],
      } : current);
      setDialog(null);
    } catch (error) {
      setActionError(requestErrorKey(error, true));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCandidate(input: RecruitmentCandidateInput) {
    if (dialog?.kind !== "candidate") return;
    setIsSaving(true);
    setActionError(null);
    try {
      const saved = dialog.record
        ? await updateRecruitmentCandidate(dialog.record.id, input)
        : await createRecruitmentCandidate(input);
      setReport((current) => current ? {
        ...current,
        candidates: dialog.record
          ? current.candidates.map((candidate) => candidate.id === saved.id ? saved : candidate)
          : [saved, ...current.candidates],
        openings: current.openings.map((opening) => {
          const openingDelta = dialog.record
            ? Number(saved.openingId === opening.id) - Number(dialog.record.openingId === opening.id)
            : Number(saved.openingId === opening.id);
          return { ...opening, applicantCount: opening.applicantCount + openingDelta };
        }),
      } : current);
      setDialog(null);
    } catch (error) {
      setActionError(requestErrorKey(error, true));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveInterview(input: RecruitmentInterviewInput) {
    if (dialog?.kind !== "interview") return;
    setIsSaving(true);
    setActionError(null);
    try {
      const saved = dialog.record
        ? await updateRecruitmentInterview(dialog.record.id, input)
        : await createRecruitmentInterview(input);
      setReport((current) => current ? {
        ...current,
        interviews: dialog.record
          ? current.interviews.map((interview) => interview.id === saved.id ? saved : interview).sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
          : [...current.interviews, saved].sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt)),
      } : current);
      setDialog(null);
    } catch (error) {
      setActionError(requestErrorKey(error, true));
    } finally {
      setIsSaving(false);
    }
  }

  async function changeCandidateStage(candidate: RecruitmentCandidate, stage: RecruitmentCandidateInput["stage"]) {
    setActionError(null);
    try {
      const updated = await updateRecruitmentCandidate(candidate.id, {
        openingId: candidate.openingId,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        phone: candidate.phone,
        source: candidate.source,
        stage,
        notes: candidate.notes,
      });
      setReport((current) => current ? {
        ...current,
        candidates: current.candidates.map((item) => item.id === updated.id ? updated : item),
      } : current);
    } catch (error) {
      setActionError(requestErrorKey(error, true));
    }
  }

  function openDialog(next: Exclude<RecruitmentDialog, null>) {
    setActionError(null);
    setDialog(next);
  }

  const stageCounts = useMemo(
    () => Object.fromEntries(pipelineStages.map((stage) => [stage, candidates.filter((candidate) => candidate.stage === stage).length])) as Record<RecruitmentCandidateInput["stage"], number>,
    [candidates],
  );

  return (
    <>
      <PageMeta title={`${t("recruitmentPage.title")} | ERIS`} description={t("recruitmentPage.description")} />
      <div className="space-y-6">
        <PageBreadcrumb
          pageTitle={t("recruitmentPage.title")}
          showPageTitle={false}
        />
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">{t("recruitmentPage.title")}</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">{t("recruitmentPage.description")}</p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={() => openDialog({ kind: "opening" })}>{t("recruitmentPage.actions.addOpening")}</ActionButton>
              <ActionButton onClick={() => openDialog({ kind: "candidate" })} disabled={openOpenings.length === 0}>{t("recruitmentPage.actions.addCandidate")}</ActionButton>
            </div>
          )}
        </header>

        <section aria-label={t("recruitmentPage.overview")} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HrStatCard label={t("recruitmentPage.stats.openings")} value={isLoading ? "—" : numberFormat.format(openOpenings.length)} icon={<GroupIcon className="size-5" />} />
          <HrStatCard label={t("recruitmentPage.stats.candidates")} value={isLoading ? "—" : numberFormat.format(candidates.length)} icon={<MultiUserIcon className="size-5" />} tone="purple" />
          <HrStatCard label={t("recruitmentPage.stats.interviews")} value={isLoading ? "—" : numberFormat.format(upcomingInterviews.length)} icon={<UserCircleIcon className="size-5" />} tone="warning" />
          <HrStatCard label={t("recruitmentPage.stats.offers")} value={isLoading ? "—" : numberFormat.format(stageCounts.offer)} icon={<UserMoneyIcon className="size-5" />} tone="success" />
        </section>

        <nav aria-label={t("recruitmentPage.tabs.label")} className="flex gap-6 border-b border-gray-200 dark:border-gray-800">
          {tabs.map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`border-b-2 px-1 pb-3 text-sm font-medium transition ${activeTab === tab ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`} aria-current={activeTab === tab ? "page" : undefined}>
              {t(`recruitmentPage.tabs.${tab}`)}
            </button>
          ))}
        </nav>

        {loadError && (
          <div role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/25 dark:bg-error-500/10 dark:text-error-300">
            {t(loadError)}
          </div>
        )}
        {actionError && (
          <div role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/25 dark:bg-error-500/10 dark:text-error-300">
            {t(actionError)}
          </div>
        )}

        {activeTab === "openings" && (
          <ModuleSection title={t("recruitmentPage.tabs.openings")} description={t("recruitmentPage.positions.description")}>
            {isLoading ? <LoadingState label={t("recruitmentPage.loading")} /> : openings.length === 0 ? (
              <EmptyModuleState title={t("recruitmentPage.positions.emptyTitle")} description={t("recruitmentPage.positions.emptyDescription")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead>
                    <tr className="text-start text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <th className="px-4 py-3">{t("recruitmentPage.table.opening")}</th>
                      <th className="px-4 py-3">{t("recruitmentPage.table.department")}</th>
                      <th className="px-4 py-3">{t("recruitmentPage.table.applicants")}</th>
                      <th className="px-4 py-3">{t("recruitmentPage.table.status")}</th>
                      <th className="px-4 py-3"><span className="sr-only">{t("recruitmentPage.table.actions")}</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {openings.map((opening) => (
                      <tr key={opening.id} className="text-sm text-gray-700 dark:text-gray-300">
                        <td className="px-4 py-4"><p className="font-medium text-gray-800 dark:text-white/90">{opening.title}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{[opening.location, t(`recruitmentPage.employmentTypes.${opening.employmentType}`)].filter(Boolean).join(" · ")}</p></td>
                        <td className="px-4 py-4">{opening.department || "—"}</td>
                        <td className="px-4 py-4">{numberFormat.format(opening.applicantCount)}</td>
                        <td className="px-4 py-4"><StatusPill label={t(`recruitmentPage.openingStatuses.${opening.status}`)} tone={opening.status === "open" ? "success" : opening.status === "closed" ? "neutral" : "warning"} /></td>
                        <td className="px-4 py-4 text-end">{canManage && <TextAction onClick={() => openDialog({ kind: "opening", record: opening })}>{t("recruitmentPage.actions.edit")}</TextAction>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ModuleSection>
        )}

        {activeTab === "candidates" && (
          <ModuleSection title={t("recruitmentPage.pipeline.title")} description={t("recruitmentPage.pipeline.description")}>
            {isLoading ? <LoadingState label={t("recruitmentPage.loading")} /> : candidates.length === 0 ? (
              <EmptyModuleState title={t("recruitmentPage.candidates.emptyTitle")} description={openOpenings.length ? t("recruitmentPage.candidates.emptyDescription") : t("recruitmentPage.candidates.noOpenings")} />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {pipelineStages.map((stage) => {
                  const stageCandidates = candidates.filter((candidate) => candidate.stage === stage);
                  return (
                    <section key={stage} className="min-h-44 rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/50">
                      <div className="mb-3 flex items-center justify-between gap-3 px-1">
                        <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">{t(`recruitmentPage.pipeline.stages.${stage}`)}</h2>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">{numberFormat.format(stageCandidates.length)}</span>
                      </div>
                      {stageCandidates.length === 0 ? <p className="px-1 py-4 text-xs text-gray-400 dark:text-gray-500">{t("recruitmentPage.candidates.emptyStage")}</p> : (
                        <ul className="space-y-3">
                          {stageCandidates.map((candidate) => (
                            <li key={candidate.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{candidate.firstName} {candidate.lastName}</p>
                                  <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{candidate.openingTitle}</p>
                                </div>
                                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{t(`recruitmentPage.pipeline.stages.${candidate.stage}`)}</span>
                              </div>
                              <a href={`mailto:${candidate.email}`} className="mt-3 block truncate text-xs text-brand-600 hover:underline dark:text-brand-400">{candidate.email}</a>
                              {candidate.phone && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{candidate.phone}</p>}
                              {candidate.notes && <p className="mt-3 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{candidate.notes}</p>}
                              {canManage && (
                                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                                  <label className="sr-only" htmlFor={`candidate-stage-${candidate.id}`}>{t("recruitmentPage.form.stage")}: {candidate.firstName} {candidate.lastName}</label>
                                  <select id={`candidate-stage-${candidate.id}`} className="max-w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" value={candidate.stage} onChange={(event) => void changeCandidateStage(candidate, event.target.value as RecruitmentCandidateInput["stage"])}>
                                    {pipelineStages.map((option) => <option key={option} value={option}>{t(`recruitmentPage.pipeline.stages.${option}`)}</option>)}
                                  </select>
                                  <TextAction onClick={() => openDialog({ kind: "candidate", record: candidate })}>{t("recruitmentPage.actions.edit")}</TextAction>
                                  <TextAction onClick={() => openDialog({ kind: "interview", candidateId: candidate.id })}>{t("recruitmentPage.actions.scheduleInterview")}</TextAction>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </ModuleSection>
        )}

        {activeTab === "interviews" && (
          <ModuleSection title={t("recruitmentPage.interviewSchedule.title")} description={t("recruitmentPage.interviewSchedule.description")}>
            <div className="mb-4 flex justify-end">
              {canManage && <ActionButton onClick={() => openDialog({ kind: "interview" })} disabled={candidates.length === 0}>{t("recruitmentPage.actions.scheduleInterview")}</ActionButton>}
            </div>
            {isLoading ? <LoadingState label={t("recruitmentPage.loading")} /> : interviews.length === 0 ? (
              <EmptyModuleState title={t("recruitmentPage.interviewSchedule.emptyTitle")} description={t("recruitmentPage.interviewSchedule.emptyDescription")} />
            ) : (
              <div className="space-y-3">
                {interviews.map((interview) => (
                  <article key={interview.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                        <span className="text-[10px] font-medium uppercase">{new Intl.DateTimeFormat(i18n.language, { month: "short" }).format(new Date(interview.scheduledAt))}</span>
                        <span className="text-sm font-semibold">{new Intl.DateTimeFormat(i18n.language, { day: "numeric" }).format(new Date(interview.scheduledAt))}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{interview.candidateName}</p>
                        <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{interview.openingTitle} · {interview.interviewType}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatInterviewDate(interview.scheduledAt, i18n.language)} · {numberFormat.format(interview.durationMinutes)} {t("recruitmentPage.minutes")}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("recruitmentPage.form.interviewer")}: {interview.interviewerName || t("recruitmentPage.form.unassigned")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:shrink-0">
                      <StatusPill label={t(`recruitmentPage.interviewStatuses.${interview.status}`)} tone={interview.status === "scheduled" ? "brand" : interview.status === "completed" ? "success" : "neutral"} />
                      {canManage && <TextAction onClick={() => openDialog({ kind: "interview", record: interview })}>{t("recruitmentPage.actions.edit")}</TextAction>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </ModuleSection>
        )}
      </div>

      <RecruitmentFormModal isOpen={dialog?.kind === "opening"} onClose={closeDialog} title={t(dialog?.kind === "opening" && dialog.record ? "recruitmentPage.actions.editOpening" : "recruitmentPage.actions.addOpening")} saving={isSaving}>
        {dialog?.kind === "opening" && <RecruitmentOpeningForm key={dialog.record?.id ?? "new-opening"} initial={dialog.record} organization={organization} saving={isSaving} onSubmit={(input) => void saveOpening(input)} />}
      </RecruitmentFormModal>
      <RecruitmentFormModal isOpen={dialog?.kind === "candidate"} onClose={closeDialog} title={t(dialog?.kind === "candidate" && dialog.record ? "recruitmentPage.actions.editCandidate" : "recruitmentPage.actions.addCandidate")} saving={isSaving}>
        {dialog?.kind === "candidate" && <RecruitmentCandidateForm key={dialog.record?.id ?? "new-candidate"} initial={dialog.record} openings={dialog.record ? openings : openOpenings} saving={isSaving} onSubmit={(input) => void saveCandidate(input)} />}
      </RecruitmentFormModal>
      <RecruitmentFormModal isOpen={dialog?.kind === "interview"} onClose={closeDialog} title={t(dialog?.kind === "interview" && dialog.record ? "recruitmentPage.actions.editInterview" : "recruitmentPage.actions.scheduleInterview")} saving={isSaving}>
        {dialog?.kind === "interview" && <RecruitmentInterviewForm key={dialog.record?.id ?? dialog.candidateId ?? "new-interview"} initial={dialog.record} initialCandidateId={dialog.candidateId} candidates={candidates} employees={employees} saving={isSaving} onSubmit={(input) => void saveInterview(input)} />}
      </RecruitmentFormModal>
    </>
  );
}

function ActionButton({ children, onClick, disabled = false }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">{children}</button>;
}

function TextAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">{children}</button>;
}

function StatusPill({ label, tone }: { label: string; tone: "brand" | "success" | "warning" | "neutral" }) {
  const styles = {
    brand: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
    success: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300",
    warning: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300",
    neutral: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>{label}</span>;
}

function LoadingState({ label }: { label: string }) {
  return <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400" role="status">{label}</p>;
}

function formatInterviewDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
