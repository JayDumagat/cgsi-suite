import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import Select from "@/components/form/Select";
import Badge from "@/components/ui/badge/Badge";
import { Card } from "@/components/ui/card";
import Button from "@/components/ui/button/Button";
import { TabButton } from "@/components/ui/tabs/TabWithUnderline";
import {
  createPerformanceFeedback,
  createPerformanceGoal,
  EmployeeDirectoryRequestError,
  getPerformanceReport,
  savePerformanceRating,
  updatePerformanceGoal,
  type PerformanceEmployee,
  type PerformanceFeedback,
  type PerformanceGoal,
  type PerformanceGoalStatus,
  type PerformanceRating,
  type PerformanceReport,
} from "@/components/employee-directory/employeeDirectoryApi";
import { CheckLineIcon, ClockIcon, GroupIcon, PlusIcon, TaskIcon } from "@/icons";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { HrStatCard, ModuleSection } from "./HrModuleComponents";

type PerformanceTab = "goals" | "feedback" | "ratings";

interface GoalDraft {
  title: string;
  description: string;
  dueDate: string;
}

interface GoalProgressDraft {
  status: PerformanceGoalStatus;
  progress: string;
}

function performanceErrorKey(error: unknown, fallback: string) {
  if (!(error instanceof EmployeeDirectoryRequestError)) return fallback;
  if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
  if (error.status === 403 || error.code === "forbidden") {
    return "employeeDirectory.errors.accessDenied";
  }
  if (error.code === "employee_not_found") {
    return "performancePage.errors.employeeNotFound";
  }
  if (error.code === "goal_not_found") {
    return "performancePage.errors.goalNotFound";
  }
  return fallback;
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date)
    : value;
}

function goalStatusTone(status: PerformanceGoalStatus) {
  if (status === "completed") return "success" as const;
  if (status === "in_progress") return "warning" as const;
  return "light" as const;
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [item, ...items];
  return items.map((entry, currentIndex) =>
    currentIndex === index ? item : entry,
  );
}

export default function PerformanceManagementPage() {
  const { t, i18n } = useTranslation();
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [activeTab, setActiveTab] = useState<PerformanceTab>("goals");
  const [search, setSearch] = useState("");
  const [goalDraft, setGoalDraft] = useState<GoalDraft>({
    title: "",
    description: "",
    dueDate: "",
  });
  const [goalEdits, setGoalEdits] = useState<Record<string, GoalProgressDraft>>(
    {},
  );
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [ratingDraft, setRatingDraft] = useState({
    reviewYear: String(new Date().getFullYear()),
    rating: "",
    summary: "",
  });
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingGoalId, setSavingGoalId] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setErrorKey(null);
    void getPerformanceReport(controller.signal)
      .then((nextReport) => setReport(nextReport))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setReport(null);
          setErrorKey(
            performanceErrorKey(error, "performancePage.errors.loadFailed"),
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!report) return;
    setSelectedEmployeeId((current) =>
      report.employees.some((employee) => employee.employeeId === current)
        ? current
        : (report.employees[0]?.employeeId ?? ""),
    );
  }, [report]);

  const numberFormat = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }),
    [i18n.language],
  );
  const dateLocale = i18n.language;
  const canManage = report?.permissions.canManagePerformance === true;
  const employees = report?.employees ?? [];
  const selectedEmployee = employees.find(
    (employee) => employee.employeeId === selectedEmployeeId,
  );
  const visibleEmployees = employees.filter((employee) => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return true;
    return [
      employee.displayName,
      employee.employeeNumber,
      employee.department,
      employee.jobTitle,
    ].some((value) => value?.toLocaleLowerCase().includes(query));
  });
  const goals = (report?.goals ?? []).filter(
    (goal) => goal.employeeId === selectedEmployeeId,
  );
  const feedback = (report?.feedback ?? []).filter(
    (entry) => entry.employeeId === selectedEmployeeId,
  );
  const ratings = (report?.ratings ?? []).filter(
    (rating) => rating.employeeId === selectedEmployeeId,
  );
  const allGoals = report?.goals ?? [];
  const allRatings = report?.ratings ?? [];
  const averageRating = allRatings.length
    ? allRatings.reduce((total, item) => total + item.rating, 0) /
      allRatings.length
    : null;

  function replaceGoal(item: PerformanceGoal) {
    setReport((current) => {
      if (!current) return current;
      return { ...current, goals: upsertById(current.goals, item) };
    });
  }

  function replaceFeedback(item: PerformanceFeedback) {
    setReport((current) => {
      if (!current) return current;
      return { ...current, feedback: upsertById(current.feedback, item) };
    });
  }

  function replaceRating(item: PerformanceRating) {
    setReport((current) => {
      if (!current) return current;
      return { ...current, ratings: upsertById(current.ratings, item) };
    });
  }

  async function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEmployeeId) return;
    setIsSaving(true);
    setActionErrorKey(null);
    setSuccessKey(null);
    try {
      const saved = await createPerformanceGoal({
        employeeId: selectedEmployeeId,
        title: goalDraft.title.trim(),
        description: goalDraft.description.trim() || null,
        dueDate: goalDraft.dueDate || null,
        status: "not_started",
        progress: 0,
      });
      replaceGoal(saved);
      setGoalDraft({ title: "", description: "", dueDate: "" });
      setShowGoalForm(false);
      setSuccessKey("performancePage.messages.goalSaved");
    } catch (error) {
      setActionErrorKey(
        performanceErrorKey(error, "performancePage.errors.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitGoalProgress(
    event: FormEvent<HTMLFormElement>,
    goal: PerformanceGoal,
  ) {
    event.preventDefault();
    const draft = goalEdits[goal.id] ?? {
      status: goal.status,
      progress: String(goal.progress),
    };
    const progress = Number(draft.progress);
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) return;
    setSavingGoalId(goal.id);
    setActionErrorKey(null);
    setSuccessKey(null);
    try {
      const saved = await updatePerformanceGoal(goal.id, {
        employeeId: goal.employeeId,
        title: goal.title,
        description: goal.description,
        dueDate: goal.dueDate,
        status: draft.status,
        progress: draft.status === "completed" ? 100 : progress,
      });
      replaceGoal(saved);
      setGoalEdits((current) => {
        const next = { ...current };
        delete next[goal.id];
        return next;
      });
      setSuccessKey("performancePage.messages.goalUpdated");
    } catch (error) {
      setActionErrorKey(
        performanceErrorKey(error, "performancePage.errors.saveFailed"),
      );
    } finally {
      setSavingGoalId(null);
    }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEmployeeId) return;
    setIsSaving(true);
    setActionErrorKey(null);
    setSuccessKey(null);
    try {
      const saved = await createPerformanceFeedback({
        employeeId: selectedEmployeeId,
        feedback: feedbackDraft.trim(),
      });
      replaceFeedback(saved);
      setFeedbackDraft("");
      setSuccessKey("performancePage.messages.feedbackSaved");
    } catch (error) {
      setActionErrorKey(
        performanceErrorKey(error, "performancePage.errors.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitRating(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEmployeeId || !ratingDraft.rating) return;
    setIsSaving(true);
    setActionErrorKey(null);
    setSuccessKey(null);
    try {
      const saved = await savePerformanceRating({
        employeeId: selectedEmployeeId,
        reviewYear: Number(ratingDraft.reviewYear),
        rating: Number(ratingDraft.rating),
        summary: ratingDraft.summary.trim() || null,
      });
      replaceRating(saved);
      setRatingDraft((current) => ({ ...current, summary: "" }));
      setSuccessKey("performancePage.messages.ratingSaved");
    } catch (error) {
      setActionErrorKey(
        performanceErrorKey(error, "performancePage.errors.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const statusOptions = [
    { value: "not_started", label: t("performancePage.statuses.notStarted") },
    { value: "in_progress", label: t("performancePage.statuses.inProgress") },
    { value: "completed", label: t("performancePage.statuses.completed") },
  ];
  const ratingOptions = Array.from({ length: 5 }, (_, index) => ({
    value: String(index + 1),
    label: t("performancePage.ratingChoice", { rating: index + 1 }),
  }));
  const metrics = [
    {
      label: t("performancePage.stats.activeGoals"),
      value: numberFormat.format(
        allGoals.filter((goal) => goal.status !== "completed").length,
      ),
      icon: <TaskIcon className="size-5" />,
    },
    {
      label: t("performancePage.stats.completedGoals"),
      value: numberFormat.format(
        allGoals.filter((goal) => goal.status === "completed").length,
      ),
      icon: <CheckLineIcon className="size-5" />,
      tone: "success" as const,
    },
    {
      label: t("performancePage.stats.feedbackNotes"),
      value: numberFormat.format(report?.feedback.length ?? 0),
      icon: <GroupIcon className="size-5" />,
      tone: "purple" as const,
    },
    {
      label: t("performancePage.stats.averageRating"),
      value:
        averageRating === null
          ? "—"
          : `${numberFormat.format(averageRating)} / 5`,
      icon: <ClockIcon className="size-5" />,
      tone: "warning" as const,
    },
  ];

  function renderGoalsPanel() {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              {t("performancePage.goals.title")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("performancePage.goals.description")}
            </p>
          </div>
          {canManage && selectedEmployee && (
            <Button
              type="button"
              size="sm"
              startIcon={<PlusIcon className="size-4" />}
              onClick={() => setShowGoalForm((current) => !current)}
            >
              {showGoalForm
                ? t("common.close")
                : t("performancePage.goals.addGoal")}
            </Button>
          )}
        </div>

        {showGoalForm && selectedEmployee && (
          <form
            onSubmit={submitGoal}
            className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50 sm:grid-cols-2"
          >
            <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
              <span>{t("performancePage.goals.fields.title")}</span>
              <Input
                required
                maxLength={160}
                value={goalDraft.title}
                onChange={(event) =>
                  setGoalDraft((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
              <span>{t("performancePage.goals.fields.dueDate")}</span>
              <Input
                type="date"
                value={goalDraft.dueDate}
                onChange={(event) =>
                  setGoalDraft((current) => ({ ...current, dueDate: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300 sm:col-span-2">
              <span>{t("performancePage.goals.fields.description")}</span>
              <TextArea
                maxLength={2000}
                rows={3}
                value={goalDraft.description}
                onChange={(description) =>
                  setGoalDraft((current) => ({ ...current, description }))
                }
              />
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowGoalForm(false)}
              >
                {t("common.close")}
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving
                  ? t("performancePage.saving")
                  : t("performancePage.goals.saveGoal")}
              </Button>
            </div>
          </form>
        )}

        {goals.length === 0 ? (
          <EmptyState
            title={t("performancePage.goals.emptyTitle")}
            description={t("performancePage.goals.emptyDescription")}
          />
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => {
              const draft = goalEdits[goal.id] ?? {
                status: goal.status,
                progress: String(goal.progress),
              };
              return (
                <Card key={goal.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h4 className="font-medium text-gray-800 dark:text-white/90">
                        {goal.title}
                      </h4>
                      {goal.description && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-500 dark:text-gray-400">
                          {goal.description}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {t("performancePage.goals.dueDate", {
                          date: formatDate(goal.dueDate, dateLocale),
                        })}
                      </p>
                    </div>
                    <Badge color={goalStatusTone(goal.status)}>
                      {t(`performancePage.statuses.${goal.status === "not_started" ? "notStarted" : goal.status === "in_progress" ? "inProgress" : "completed"}`)}
                    </Badge>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-[width]"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{t("performancePage.goals.progress")}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {goal.progress}%
                    </span>
                  </div>
                  {canManage && (
                    <form
                      onSubmit={(event) => submitGoalProgress(event, goal)}
                      className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-gray-800 sm:flex-row sm:items-end"
                    >
                      <label className="min-w-0 flex-1 space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                        <span>{t("performancePage.goals.fields.status")}</span>
                        <Select
                          options={statusOptions}
                          value={draft.status}
                          onChange={(status) =>
                            setGoalEdits((current) => ({
                              ...current,
                              [goal.id]: {
                                ...draft,
                                status: status as PerformanceGoalStatus,
                                progress:
                                  status === "completed"
                                    ? "100"
                                    : draft.progress === "100"
                                      ? "0"
                                      : draft.progress,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="w-full space-y-1.5 text-sm text-gray-600 dark:text-gray-300 sm:w-32">
                        <span>{t("performancePage.goals.fields.progress")}</span>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={draft.progress}
                          disabled={draft.status === "completed"}
                          onChange={(event) =>
                            setGoalEdits((current) => ({
                              ...current,
                              [goal.id]: { ...draft, progress: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <Button
                        size="sm"
                        type="submit"
                        disabled={savingGoalId === goal.id}
                        className="shrink-0"
                      >
                        {savingGoalId === goal.id
                          ? t("performancePage.saving")
                          : t("performancePage.goals.updateGoal")}
                      </Button>
                    </form>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderFeedbackPanel() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("performancePage.feedback.title")}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("performancePage.feedback.description")}
          </p>
        </div>
        {canManage && selectedEmployee && (
          <form onSubmit={submitFeedback} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
            <label className="block space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
              <span>{t("performancePage.feedback.writeLabel")}</span>
              <TextArea
                required
                maxLength={2000}
                rows={4}
                value={feedbackDraft}
                onChange={setFeedbackDraft}
                placeholder={t("performancePage.feedback.placeholder")}
              />
            </label>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isSaving || !feedbackDraft.trim()}>
                {isSaving
                  ? t("performancePage.saving")
                  : t("performancePage.feedback.saveFeedback")}
              </Button>
            </div>
          </form>
        )}
        {feedback.length === 0 ? (
          <EmptyState
            title={t("performancePage.feedback.emptyTitle")}
            description={t("performancePage.feedback.emptyDescription")}
          />
        ) : (
          <ol className="space-y-3">
            {feedback.map((entry) => (
              <FeedbackCard
                key={entry.id}
                entry={entry}
                locale={dateLocale}
                authorFallback={t("performancePage.feedback.authorFallback")}
              />
            ))}
          </ol>
        )}
      </div>
    );
  }

  function renderRatingsPanel() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("performancePage.ratings.title")}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("performancePage.ratings.description")}
          </p>
        </div>
        {canManage && selectedEmployee && (
          <form onSubmit={submitRating} className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
              <span>{t("performancePage.ratings.reviewYear")}</span>
              <Input
                required
                type="number"
                min={1900}
                max={2200}
                value={ratingDraft.reviewYear}
                onChange={(event) =>
                  setRatingDraft((current) => ({ ...current, reviewYear: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
              <span>{t("performancePage.ratings.rating")}</span>
              <Select
                options={ratingOptions}
                value={ratingDraft.rating}
                placeholder={t("performancePage.ratings.selectRating")}
                onChange={(rating) =>
                  setRatingDraft((current) => ({ ...current, rating }))
                }
              />
            </label>
            <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300 sm:col-span-2">
              <span>{t("performancePage.ratings.summary")}</span>
              <TextArea
                maxLength={2000}
                rows={3}
                value={ratingDraft.summary}
                onChange={(summary) =>
                  setRatingDraft((current) => ({ ...current, summary }))
                }
              />
            </label>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" size="sm" disabled={isSaving || !ratingDraft.rating}>
                {isSaving
                  ? t("performancePage.saving")
                  : t("performancePage.ratings.saveRating")}
              </Button>
            </div>
          </form>
        )}
        {ratings.length === 0 ? (
          <EmptyState
            title={t("performancePage.ratings.emptyTitle")}
            description={t("performancePage.ratings.emptyDescription")}
          />
        ) : (
          <div className="space-y-3">
            {ratings.map((rating) => (
              <RatingCard
                key={rating.id}
                rating={rating}
                locale={dateLocale}
                numberFormat={numberFormat}
                reviewerFallback={t("performancePage.ratings.reviewerFallback")}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const title = t("performancePage.title");
  return (
    <>
      <PageMeta title={`${title} | ERIS`} description={t("performancePage.description")} />
      <div className="space-y-6">
        <PageBreadcrumb pageTitle={title} showPageTitle={false} />
        <header>
          <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            {t("performancePage.description")}
          </p>
        </header>

        {errorKey && <InlineMessage tone="error">{t(errorKey)}</InlineMessage>}
        {actionErrorKey && <InlineMessage tone="error">{t(actionErrorKey)}</InlineMessage>}
        {successKey && <InlineMessage tone="success">{t(successKey)}</InlineMessage>}

        <section
          aria-label={t("performancePage.overview")}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {metrics.map((metric) => (
            <HrStatCard
              key={metric.label}
              label={metric.label}
              value={isLoading ? "—" : metric.value}
              icon={metric.icon}
              tone={metric.tone}
            />
          ))}
        </section>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            {t("performancePage.loading")}
          </p>
        ) : errorKey ? null : employees.length === 0 ? (
          <ModuleSection
            title={t("performancePage.employees.title")}
            description={t("performancePage.employees.description")}
          >
            <EmptyState
              title={t("performancePage.employees.emptyTitle")}
              description={t("performancePage.employees.emptyDescription")}
            />
          </ModuleSection>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(16rem,0.8fr)_minmax(0,2fr)]">
            <ModuleSection
              title={t("performancePage.employees.title")}
              description={t("performancePage.employees.description")}
            >
              <div className="space-y-3">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("performancePage.employees.search")}
                  aria-label={t("performancePage.employees.search")}
                />
                <div className="max-h-[34rem] space-y-1 overflow-y-auto">
                  {visibleEmployees.map((employee) => (
                    <EmployeeOption
                      key={employee.employeeId}
                      employee={employee}
                      isSelected={employee.employeeId === selectedEmployeeId}
                      onClick={() => setSelectedEmployeeId(employee.employeeId)}
                    />
                  ))}
                  {visibleEmployees.length === 0 && (
                    <p className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      {t("performancePage.employees.noMatches")}
                    </p>
                  )}
                </div>
              </div>
            </ModuleSection>

            <ModuleSection
              title={selectedEmployee?.displayName ?? t("performancePage.details.title")}
              description={
                selectedEmployee
                  ? [selectedEmployee.jobTitle, selectedEmployee.department]
                      .filter(Boolean)
                      .join(" · ") || selectedEmployee.employeeNumber || ""
                  : t("performancePage.details.description")
              }
            >
              {selectedEmployee && (
                <div>
                  <div className="border-b border-gray-200 dark:border-gray-800">
                    <nav
                      className="-mb-px flex gap-2 overflow-x-auto"
                      role="tablist"
                      aria-label={t("performancePage.tabs.label")}
                    >
                      {(["goals", "feedback", "ratings"] as const).map((tab) => (
                        <TabButton
                          key={tab}
                          id={`performance-tab-${tab}`}
                          label={t(`performancePage.tabs.${tab}`)}
                          isActive={activeTab === tab}
                          onClick={() => setActiveTab(tab)}
                          role="tab"
                          ariaControls={`performance-panel-${tab}`}
                        />
                      ))}
                    </nav>
                  </div>
                  <div
                    id={`performance-panel-${activeTab}`}
                    role="tabpanel"
                    aria-labelledby={`performance-tab-${activeTab}`}
                    className="pt-5"
                  >
                    {activeTab === "goals"
                      ? renderGoalsPanel()
                      : activeTab === "feedback"
                        ? renderFeedbackPanel()
                        : renderRatingsPanel()}
                  </div>
                </div>
              )}
            </ModuleSection>
          </div>
        )}
      </div>
    </>
  );
}

function EmployeeOption({
  employee,
  isSelected,
  onClick,
}: {
  employee: PerformanceEmployee;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-start transition ${
        isSelected
          ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
      }`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-brand-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-brand-300 dark:ring-gray-700">
        {employee.displayName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toLocaleUpperCase())
          .join("")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {employee.displayName}
        </span>
        <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
          {employee.jobTitle || employee.department || employee.employeeNumber || "—"}
        </span>
      </span>
    </button>
  );
}

function FeedbackCard({
  entry,
  locale,
  authorFallback,
}: {
  entry: PerformanceFeedback;
  locale: string;
  authorFallback: string;
}) {
  const date = new Date(entry.createdAt);
  return (
    <li className="relative rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-gray-800 dark:text-white/90">
          {entry.authorName || authorFallback}
        </p>
        <time
          dateTime={entry.createdAt}
          className="text-xs text-gray-500 dark:text-gray-400"
        >
          {Number.isFinite(date.getTime())
            ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date)
            : entry.createdAt}
        </time>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">
        {entry.feedback}
      </p>
    </li>
  );
}

function RatingCard({
  rating,
  locale,
  numberFormat,
  reviewerFallback,
}: {
  rating: PerformanceRating;
  locale: string;
  numberFormat: Intl.NumberFormat;
  reviewerFallback: string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-gray-800 dark:text-white/90">
            {rating.reviewYear}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {rating.reviewerName || reviewerFallback} · {formatDate(rating.updatedAt, locale)}
          </p>
        </div>
        <Badge color={rating.rating >= 4 ? "success" : rating.rating <= 2 ? "warning" : "primary"}>
          {numberFormat.format(rating.rating)} / 5
        </Badge>
      </div>
      {rating.summary && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">
          {rating.summary}
        </p>
      )}
    </Card>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 px-5 py-10 text-center dark:border-gray-700">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}

function InlineMessage({
  children,
  tone,
}: {
  children: string;
  tone: "error" | "success";
}) {
  const toneClass =
    tone === "error"
      ? "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
      : "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300";
  return (
    <p className={`rounded-lg border px-4 py-3 text-sm ${toneClass}`} role="status">
      {children}
    </p>
  );
}
