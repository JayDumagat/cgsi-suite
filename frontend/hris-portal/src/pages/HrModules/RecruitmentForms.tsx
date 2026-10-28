import type {
  EmployeeDirectoryItem,
  OrganizationStructureResponse,
  RecruitmentCandidate,
  RecruitmentCandidateInput,
  RecruitmentInterview,
  RecruitmentInterviewInput,
  RecruitmentOpening,
  RecruitmentOpeningInput,
} from "@/components/employee-directory/employeeDirectoryApi";
import { Modal } from "@/components/ui/modal";
import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

const fieldClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800";
const labelClass = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

export function RecruitmentFormModal({
  isOpen,
  onClose,
  title,
  saving,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  saving: boolean;
  children: ReactNode;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="mx-4 max-h-[90vh] max-w-2xl overflow-y-auto p-6 sm:p-8">
      <h2 className="mb-6 pe-12 text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h2>
      <fieldset disabled={saving} className="disabled:opacity-70">{children}</fieldset>
    </Modal>
  );
}

export function RecruitmentOpeningForm({
  initial,
  organization,
  saving,
  onSubmit,
}: {
  initial?: RecruitmentOpening;
  organization: OrganizationStructureResponse | null;
  saving: boolean;
  onSubmit: (input: RecruitmentOpeningInput) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [positionId, setPositionId] = useState(initial?.positionId ?? "");
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [employmentType, setEmploymentType] = useState<RecruitmentOpeningInput["employmentType"]>(initial?.employmentType ?? "full_time");
  const [headcount, setHeadcount] = useState(initial?.headcount ?? 1);
  const [status, setStatus] = useState<RecruitmentOpeningInput["status"]>(initial?.status ?? "draft");
  const [description, setDescription] = useState(initial?.description ?? "");
  const positions = organization?.organizations.flatMap((org) =>
    org.departments.flatMap((item) => item.positions.map((position) => ({
      id: position.id,
      name: position.name,
      department: item.name,
    }))),
  ) ?? [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      title: title.trim(),
      positionId: positionId || null,
      department: department.trim() || null,
      location: location.trim() || null,
      employmentType,
      headcount,
      status,
      description: description.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="recruitment-opening-title" className={labelClass}>{t("recruitmentPage.form.title")}</label>
        <input id="recruitment-opening-title" className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="recruitment-opening-position" className={labelClass}>{t("recruitmentPage.form.position")}</label>
          <select id="recruitment-opening-position" className={fieldClass} value={positionId} onChange={(event) => {
            setPositionId(event.target.value);
            const selected = positions.find((position) => position.id === event.target.value);
            if (selected) {
              setTitle(selected.name);
              setDepartment(selected.department);
            }
          }}>
            <option value="">{t("recruitmentPage.form.noLinkedPosition")}</option>
            {positions.map((position) => <option key={position.id} value={position.id}>{position.name} · {position.department}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="recruitment-opening-department" className={labelClass}>{t("recruitmentPage.form.department")}</label>
          <input id="recruitment-opening-department" className={fieldClass} value={department} onChange={(event) => setDepartment(event.target.value)} maxLength={120} />
        </div>
        <div>
          <label htmlFor="recruitment-opening-location" className={labelClass}>{t("recruitmentPage.form.location")}</label>
          <input id="recruitment-opening-location" className={fieldClass} value={location} onChange={(event) => setLocation(event.target.value)} maxLength={120} />
        </div>
        <div>
          <label htmlFor="recruitment-opening-type" className={labelClass}>{t("recruitmentPage.form.employmentType")}</label>
          <select id="recruitment-opening-type" className={fieldClass} value={employmentType} onChange={(event) => setEmploymentType(event.target.value as RecruitmentOpeningInput["employmentType"])}>
            {(["full_time", "part_time", "contractor", "temporary", "intern"] as const).map((type) => <option key={type} value={type}>{t(`recruitmentPage.employmentTypes.${type}`)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="recruitment-opening-headcount" className={labelClass}>{t("recruitmentPage.form.headcount")}</label>
          <input id="recruitment-opening-headcount" type="number" min={1} max={1000} className={fieldClass} value={headcount} onChange={(event) => setHeadcount(Number(event.target.value))} required />
        </div>
        <div>
          <label htmlFor="recruitment-opening-status" className={labelClass}>{t("recruitmentPage.form.openingStatus")}</label>
          <select id="recruitment-opening-status" className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value as RecruitmentOpeningInput["status"])}>
            {(["draft", "open", "closed"] as const).map((item) => <option key={item} value={item}>{t(`recruitmentPage.openingStatuses.${item}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="recruitment-opening-description" className={labelClass}>{t("recruitmentPage.form.description")}</label>
        <textarea id="recruitment-opening-description" className={`${fieldClass} min-h-24`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} />
      </div>
      <FormActions saving={saving} />
    </form>
  );
}

export function RecruitmentCandidateForm({
  initial,
  openings,
  saving,
  onSubmit,
}: {
  initial?: RecruitmentCandidate;
  openings: RecruitmentOpening[];
  saving: boolean;
  onSubmit: (input: RecruitmentCandidateInput) => void;
}) {
  const { t } = useTranslation();
  const [openingId, setOpeningId] = useState(initial?.openingId ?? openings[0]?.id ?? "");
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [source, setSource] = useState(initial?.source ?? "");
  const [stage, setStage] = useState<RecruitmentCandidateInput["stage"]>(initial?.stage ?? "applied");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ openingId, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim() || null, source: source.trim() || null, stage, notes: notes.trim() || null });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="recruitment-candidate-opening" className={labelClass}>{t("recruitmentPage.form.opening")}</label>
        <select id="recruitment-candidate-opening" className={fieldClass} value={openingId} onChange={(event) => setOpeningId(event.target.value)} required>
          {openings.map((opening) => <option key={opening.id} value={opening.id}>{opening.title}</option>)}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="recruitment-candidate-first-name" className={labelClass}>{t("recruitmentPage.form.firstName")}</label>
          <input id="recruitment-candidate-first-name" className={fieldClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} required maxLength={100} />
        </div>
        <div>
          <label htmlFor="recruitment-candidate-last-name" className={labelClass}>{t("recruitmentPage.form.lastName")}</label>
          <input id="recruitment-candidate-last-name" className={fieldClass} value={lastName} onChange={(event) => setLastName(event.target.value)} required maxLength={100} />
        </div>
        <div>
          <label htmlFor="recruitment-candidate-email" className={labelClass}>{t("recruitmentPage.form.email")}</label>
          <input id="recruitment-candidate-email" type="email" className={fieldClass} value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={320} />
        </div>
        <div>
          <label htmlFor="recruitment-candidate-phone" className={labelClass}>{t("recruitmentPage.form.phone")}</label>
          <input id="recruitment-candidate-phone" className={fieldClass} value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={50} />
        </div>
        <div>
          <label htmlFor="recruitment-candidate-source" className={labelClass}>{t("recruitmentPage.form.source")}</label>
          <input id="recruitment-candidate-source" className={fieldClass} value={source} onChange={(event) => setSource(event.target.value)} maxLength={120} />
        </div>
        <div>
          <label htmlFor="recruitment-candidate-stage" className={labelClass}>{t("recruitmentPage.form.stage")}</label>
          <select id="recruitment-candidate-stage" className={fieldClass} value={stage} onChange={(event) => setStage(event.target.value as RecruitmentCandidateInput["stage"])}>
            {(["applied", "screening", "interview", "offer", "hired", "rejected"] as const).map((item) => <option key={item} value={item}>{t(`recruitmentPage.pipeline.stages.${item}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="recruitment-candidate-notes" className={labelClass}>{t("recruitmentPage.form.notes")}</label>
        <textarea id="recruitment-candidate-notes" className={`${fieldClass} min-h-24`} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
      </div>
      <FormActions saving={saving} />
    </form>
  );
}

export function RecruitmentInterviewForm({
  initial,
  candidates,
  employees,
  initialCandidateId,
  saving,
  onSubmit,
}: {
  initial?: RecruitmentInterview;
  candidates: RecruitmentCandidate[];
  employees: EmployeeDirectoryItem[];
  initialCandidateId?: string;
  saving: boolean;
  onSubmit: (input: RecruitmentInterviewInput) => void;
}) {
  const { t } = useTranslation();
  const [candidateId, setCandidateId] = useState(initial?.candidateId ?? initialCandidateId ?? candidates[0]?.id ?? "");
  const [scheduledAt, setScheduledAt] = useState(initial ? toLocalDateTime(initial.scheduledAt) : defaultInterviewDate());
  const [durationMinutes, setDurationMinutes] = useState(initial?.durationMinutes ?? 60);
  const [interviewType, setInterviewType] = useState(initial?.interviewType ?? "interview");
  const [interviewerEmployeeId, setInterviewerEmployeeId] = useState(initial?.interviewerEmployeeId ?? "");
  const [status, setStatus] = useState<RecruitmentInterviewInput["status"]>(initial?.status ?? "scheduled");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ candidateId, scheduledAt: new Date(scheduledAt).toISOString(), durationMinutes, interviewType: interviewType.trim(), interviewerEmployeeId: interviewerEmployeeId || null, status, notes: notes.trim() || null });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="recruitment-interview-candidate" className={labelClass}>{t("recruitmentPage.form.candidate")}</label>
        <select id="recruitment-interview-candidate" className={fieldClass} value={candidateId} onChange={(event) => setCandidateId(event.target.value)} required>
          {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.firstName} {candidate.lastName} · {candidate.openingTitle}</option>)}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="recruitment-interview-time" className={labelClass}>{t("recruitmentPage.form.scheduledAt")}</label>
          <input id="recruitment-interview-time" type="datetime-local" className={fieldClass} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required />
        </div>
        <div>
          <label htmlFor="recruitment-interview-duration" className={labelClass}>{t("recruitmentPage.form.durationMinutes")}</label>
          <input id="recruitment-interview-duration" type="number" min={15} max={480} step={15} className={fieldClass} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} required />
        </div>
        <div>
          <label htmlFor="recruitment-interview-type" className={labelClass}>{t("recruitmentPage.form.interviewType")}</label>
          <input id="recruitment-interview-type" className={fieldClass} value={interviewType} onChange={(event) => setInterviewType(event.target.value)} required maxLength={80} />
        </div>
        <div>
          <label htmlFor="recruitment-interview-interviewer" className={labelClass}>{t("recruitmentPage.form.interviewer")}</label>
          <select id="recruitment-interview-interviewer" className={fieldClass} value={interviewerEmployeeId} onChange={(event) => setInterviewerEmployeeId(event.target.value)}>
            <option value="">{t("recruitmentPage.form.unassigned")}</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.displayName}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="recruitment-interview-status" className={labelClass}>{t("recruitmentPage.form.interviewStatus")}</label>
          <select id="recruitment-interview-status" className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value as RecruitmentInterviewInput["status"])}>
            {(["scheduled", "completed", "cancelled"] as const).map((item) => <option key={item} value={item}>{t(`recruitmentPage.interviewStatuses.${item}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="recruitment-interview-notes" className={labelClass}>{t("recruitmentPage.form.notes")}</label>
        <textarea id="recruitment-interview-notes" className={`${fieldClass} min-h-24`} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
      </div>
      <FormActions saving={saving} />
    </form>
  );
}

function FormActions({ saving }: { saving: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
      <button type="submit" disabled={saving} className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60">
        {saving ? t("recruitmentPage.actions.saving") : t("recruitmentPage.actions.save")}
      </button>
    </div>
  );
}

function defaultInterviewDate(): string {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  value.setHours(10, 0, 0, 0);
  return toLocalDateTime(value.toISOString());
}

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
