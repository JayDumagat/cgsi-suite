import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import EducationHistoryTimeline from "@/components/employee-directory/EducationHistoryTimeline";
import EmployeeActivityTimeline from "@/components/employee-directory/EmployeeActivityTimeline";
import EmployeeHrDetailsTab from "@/components/employee-directory/EmployeeHrDetailsTab";
import EmployeeFamilyDetailsTab from "@/components/employee-directory/EmployeeFamilyDetailsTab";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  EmployeeDirectoryRequestError,
  getOrganizationStructure,
  getEmployee,
  updateEmployee,
  type EmployeeMasterRecord,
  type EmployeeMasterInput,
} from "@/components/employee-directory/employeeDirectoryApi";
import { BoxCubeIcon, DocsIcon, PencilIcon } from "@/icons";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router";

type EmployeeDetailTab =
  | "overview"
  | "personalInformation"
  | "family"
  | "employmentDetails"
  | "attendanceAndLeave"
  | "payroll"
  | "medical"
  | "documents"
  | "assets"
  | "activity";

type EditableEmployeeSection =
  | "personalInformation"
  | "addresses"
  | "personalContact"
  | "overviewContact"
  | "emergencyContact"
  | "education"
  | "employment"
  | "workContact";

type NullableTextField =
  | "employeeNumber"
  | "middleName"
  | "suffix"
  | "preferredName"
  | "gender"
  | "placeOfBirth"
  | "permanentAddress"
  | "currentAddress"
  | "nationality"
  | "religion"
  | "personalEmail"
  | "personalPhone"
  | "emergencyContactName"
  | "emergencyContactRelationship"
  | "emergencyContactPhone"
  | "emergencyContactEmail"
  | "emergencyContactAddress"
  | "department"
  | "managerWorkEmail"
  | "jobTitle"
  | "workPhone"
  | "workLocation";

type NullableDateField = "dateOfBirth" | "regularizationDate" | "hireDate" | "terminationDate";

interface EmployeePositionOption {
  id: string;
  name: string;
  departmentName: string;
  organizationName: string;
}

function initialsFor(name: string) {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

function formatDate(value: string | null, locale: string, emptyLabel: string) {
  if (!value) return emptyLabel;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function statusClass(status: EmployeeMasterRecord["employmentStatus"]) {
  if (status === "active") {
    return "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400";
  }
  if (status === "on_leave") {
    return "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300";
  }
  if (status === "disabled") {
    return "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400";
  }
  return "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300";
}

function employeeInputFromRecord(record: EmployeeMasterRecord): EmployeeMasterInput {
  const educationHistory = record.educationHistory.length > 0
    ? record.educationHistory.map(({ id: _id, ...entry }) => entry)
    : record.educationLevel || record.educationInstitution || record.educationField || record.graduationYear
      ? [{
          educationLevel: record.educationLevel,
          institution: record.educationInstitution,
          fieldOfStudy: record.educationField,
          startYear: null,
          graduationYear: record.graduationYear,
        }]
      : [];

  return {
    positionId: record.positionId,
    employeeNumber: record.employeeNumber,
    firstName: record.firstName ?? "",
    middleName: record.middleName,
    lastName: record.lastName ?? "",
    suffix: record.suffix,
    preferredName: record.preferredName,
    gender: record.gender?.toLowerCase() ?? null,
    dateOfBirth: record.dateOfBirth,
    placeOfBirth: record.placeOfBirth,
    bloodType: record.bloodType,
    maritalStatus: record.maritalStatus,
    permanentAddress: record.permanentAddress,
    currentAddress: record.currentAddress,
    nationality: record.nationality,
    religion: record.religion,
    personalEmail: record.personalEmail,
    personalPhone: record.personalPhone,
    emergencyContactName: record.emergencyContactName,
    emergencyContactRelationship: record.emergencyContactRelationship,
    emergencyContactPhone: record.emergencyContactPhone,
    emergencyContactEmail: record.emergencyContactEmail,
    emergencyContactAddress: record.emergencyContactAddress,
    educationLevel: record.educationLevel,
    educationInstitution: record.educationInstitution,
    educationField: record.educationField,
    graduationYear: record.graduationYear,
    educationHistory,
    workEmail: record.workEmail,
    department: record.department,
    managerWorkEmail: record.managerWorkEmail,
    jobTitle: record.jobTitle,
    employmentType: record.employmentType,
    employmentStatus: record.employmentStatus,
    isProbationary: record.isProbationary,
    regularizationDate: record.regularizationDate,
    hireDate: record.hireDate,
    terminationDate: record.terminationDate,
    workPhone: record.workPhone,
    workLocation: record.workLocation,
  };
}

function mapSaveErrorKey(error: unknown) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden") {
      return "employeeDirectory.errors.editDenied";
    }
    if (error.status === 404 || error.code === "employee_not_found") {
      return "employeeDirectory.errors.notFound";
    }
    if (error.code === "invalid_organization_position") {
      return "employeeDirectory.errors.invalidPosition";
    }
  }
  return "employeeDirectory.errors.editFailed";
}

function detailErrorKey(error: unknown) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden") {
      return "employeeDirectory.errors.accessDenied";
    }
    if (error.status === 404 || error.code === "employee_not_found") {
      return "employeeDirectory.errors.notFound";
    }
  }
  return "employeeDirectory.errors.loadFailed";
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-5 py-2.5">
      <dt className="w-1/2 text-sm text-gray-500 sm:w-1/3 dark:text-gray-400">
        {label}
      </dt>
      <dd className="w-1/2 break-words text-sm text-gray-700 sm:w-2/3 dark:text-gray-400">
        {value}
      </dd>
    </div>
  );
}

interface InfoSectionProps {
  title: string;
  children: ReactNode;
  editor?: ReactNode;
  isEditing?: boolean;
  editDisabled?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
  error?: string | null;
  editText?: string;
  saveText?: string;
  cancelText?: string;
  savingText?: string;
  isCustomContent?: boolean;
}

function InfoSection({
  title,
  children,
  editor,
  isEditing = false,
  editDisabled = false,
  onEdit,
  onSave,
  onCancel,
  isSaving = false,
  error,
  editText = "Edit",
  saveText = "Save changes",
  cancelText = "Cancel",
  savingText = "Saving...",
  isCustomContent = false,
}: InfoSectionProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h2>
        {onEdit && !isEditing && (
          <button
            type="button"
            aria-label={`${editText}: ${title}`}
            title={editText}
            onClick={onEdit}
            disabled={editDisabled}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-brand-300"
          >
            <PencilIcon className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-5">
          {editor}
          {error && (
            <p className="text-sm text-error-600 dark:text-error-400" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? savingText : saveText}
            </button>
          </div>
        </div>
      ) : isCustomContent ? (
        children
      ) : (
        <dl className="divide-y divide-gray-100 dark:divide-gray-800">{children}</dl>
      )}
    </section>
  );
}

interface EditorFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  required?: boolean;
}

function EditorField({ id, label, value, onChange, type = "text", maxLength, min, max, required }: EditorFieldProps) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}{required ? " *" : ""}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        min={min}
        max={max}
        required={required}
      />
    </div>
  );
}

interface EditorSelectProps {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}

function EditorSelect({ id, label, value, options, onChange, placeholder }: EditorSelectProps) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        options={options}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { t, i18n } = useTranslation();
  const { employeeId } = useParams();
  const location = useLocation();
  const [employee, setEmployee] = useState<EmployeeMasterRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EmployeeDetailTab>("overview");
  const [editingSection, setEditingSection] = useState<EditableEmployeeSection | null>(null);
  const [draft, setDraft] = useState<EmployeeMasterInput | null>(null);
  const [organizationPositions, setOrganizationPositions] = useState<EmployeePositionOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrorKey, setSaveErrorKey] = useState<string | null>(null);
  const notProvided = t("employeeDirectory.notProvided");

  useEffect(() => {
    if (new URLSearchParams(location.search).get("tab") === "payroll") {
      setActiveTab("payroll");
    }
  }, [location.search]);

  useEffect(() => {
    const controller = new AbortController();
    void getOrganizationStructure(controller.signal)
      .then(({ organizations }) => {
        setOrganizationPositions(organizations.flatMap((organization) =>
          organization.departments.flatMap((department) =>
            department.positions.map((position) => ({
              id: position.id,
              name: position.name,
              departmentName: department.name,
              organizationName: organization.name,
            })),
          ),
        ));
      })
      .catch(() => {
        if (!controller.signal.aborted) setOrganizationPositions([]);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!employeeId) {
      setErrorKey("employeeDirectory.errors.notFound");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setErrorKey(null);

    void getEmployee(employeeId, controller.signal)
      .then((record) => setEmployee(record))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setEmployee(null);
        setErrorKey(detailErrorKey(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [employeeId]);

  const displayedName = employee?.displayName ?? t("employeeDirectory.details.title");
  const pageTitle = `${displayedName} | ERIS`;
  const tabKeys: EmployeeDetailTab[] = [
    "overview",
    "personalInformation",
    "family",
    "employmentDetails",
    "attendanceAndLeave",
    "payroll",
    "medical",
    "documents",
    "assets",
    "activity",
  ];

  const beginEditing = (section: EditableEmployeeSection) => {
    if (!employee) return;
    setDraft(employeeInputFromRecord(employee));
    setEditingSection(section);
    setSaveErrorKey(null);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setDraft(null);
    setSaveErrorKey(null);
  };

  const setDraftField = (
    key: keyof EmployeeMasterInput,
    value: EmployeeMasterInput[keyof EmployeeMasterInput],
  ) => {
    setDraft((current) => current
      ? { ...current, [key]: value } as EmployeeMasterInput
      : current);
  };

  const setDraftPosition = (positionId: string) => {
    const position = organizationPositions.find((item) => item.id === positionId);
    setDraft((current) => current
      ? {
          ...current,
          positionId: position?.id ?? null,
          department: position?.departmentName ?? null,
          jobTitle: position?.name ?? null,
        }
      : current);
  };

  const setNullableText = (key: NullableTextField, value: string) => {
    setDraftField(key, value || null);
  };

  const setRequiredText = (key: "firstName" | "lastName" | "workEmail", value: string) => {
    setDraftField(key, value);
  };

  const setNullableDate = (key: NullableDateField, value: string) => {
    setDraftField(key, value || null);
  };

  const saveSection = async () => {
    if (!employee || !draft || !editingSection) return;
    setIsSaving(true);
    setSaveErrorKey(null);
    try {
      let input = draft;
      if (editingSection === "education") {
        const educationHistory = (draft.educationHistory ?? []).filter((entry) => Boolean(
          entry.educationLevel || entry.institution || entry.fieldOfStudy,
        ));
        const primaryEducation = educationHistory[0];
        input = {
          ...draft,
          educationHistory,
          educationLevel: primaryEducation?.educationLevel ?? null,
          educationInstitution: primaryEducation?.institution ?? null,
          educationField: primaryEducation?.fieldOfStudy ?? null,
          graduationYear: primaryEducation?.graduationYear ?? null,
        };
      }
      const updated = await updateEmployee(employee.id, input);
      setEmployee(updated);
      cancelEditing();
    } catch (error) {
      setSaveErrorKey(mapSaveErrorKey(error));
    } finally {
      setIsSaving(false);
    }
  };

  const sectionEditProps = (section: EditableEmployeeSection) => ({
    onEdit: () => beginEditing(section),
    isEditing: editingSection === section,
    editDisabled: editingSection !== null && editingSection !== section,
    onSave: saveSection,
    onCancel: cancelEditing,
    isSaving,
    error: editingSection === section && saveErrorKey ? t(saveErrorKey) : null,
    editText: t("common.edit"),
    saveText: t("common.saveChanges"),
    cancelText: t("employeeDirectory.create.cancel"),
    savingText: t("employeeDirectory.edit.saving"),
  });

  const nullableTextEditor = (
    id: string,
    label: string,
    key: NullableTextField,
    type = "text",
    maxLength?: number,
  ) => (
    <EditorField
      id={id}
      label={label}
      type={type}
      maxLength={maxLength}
      value={draft?.[key] ?? ""}
      onChange={(value) => setNullableText(key, value)}
    />
  );

  const requiredTextEditor = (
    id: string,
    label: string,
    key: "firstName" | "lastName" | "workEmail",
    type = "text",
    maxLength?: number,
  ) => (
    <EditorField
      id={id}
      label={label}
      type={type}
      maxLength={maxLength}
      required
      value={draft?.[key] ?? ""}
      onChange={(value) => setRequiredText(key, value)}
    />
  );

  const dateEditor = (id: string, label: string, key: NullableDateField) => (
    <EditorField
      id={id}
      label={label}
      type="date"
      value={draft?.[key] ?? ""}
      onChange={(value) => setNullableDate(key, value)}
    />
  );

  const selectEditor = (
    id: string,
    label: string,
    value: string,
    options: { value: string; label: string }[],
    onChange: (value: string) => void,
    placeholder?: string,
  ) => (
    <EditorSelect
      id={id}
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      placeholder={placeholder}
    />
  );

  const positionOptions = [
    { value: "__no_position__", label: t("employeeDirectory.fields.noJobPosition") },
    ...organizationPositions.map((position) => ({
      value: position.id,
      label: `${position.name} · ${position.departmentName} · ${position.organizationName}`,
    })),
  ];

  const positionSelectEditor = (id: string) => (
    <EditorSelect
      id={id}
      label={t("employeeDirectory.fields.jobPosition")}
      value={draft?.positionId ?? ""}
      options={positionOptions}
      placeholder={t("employeeDirectory.fields.selectJobPosition")}
      onChange={setDraftPosition}
    />
  );

  const departmentValueEditor = (id: string) => (
    <div className="min-w-0">
      <Label htmlFor={id}>{t("employeeDirectory.fields.department")}</Label>
      <div
        id={id}
        className="flex min-h-11 items-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600 dark:border-gray-800 dark:bg-white/5 dark:text-gray-300"
      >
        {draft?.department || notProvided}
      </div>
    </div>
  );

  const editorGrid = (children: ReactNode) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  );

  const bloodTypeOptions = [
    "a_positive", "a_negative", "b_positive", "b_negative",
    "ab_positive", "ab_negative", "o_positive", "o_negative",
  ].map((value) => ({ value, label: t(`employeeDirectory.bloodTypes.${value}`) }));
  const maritalStatusOptions = [
    "single", "married", "separated", "divorced", "widowed", "domestic_partner", "other",
  ].map((value) => ({ value, label: t(`employeeDirectory.maritalStatuses.${value}`) }));
  const genderOptions = ["female", "male"].map((value) => ({
    value,
    label: t(`employeeDirectory.genders.${value}`),
  }));
  const employmentTypeOptions = [
    "full_time", "part_time", "contractor", "temporary", "intern",
  ].map((value) => ({ value, label: t(`employeeDirectory.employmentTypes.${value}`) }));
  const employmentStatusOptions = ["active", "on_leave", "disabled", "offboarded"]
    .map((value) => ({ value, label: t(`employeeDirectory.statuses.${value}`) }));
  const probationaryStatusOptions = ["unspecified", "probationary", "not_probationary"]
    .map((value) => ({ value, label: t(`employeeDirectory.probationaryStatuses.${value}`) }));

  const renderTabPanel = (record: EmployeeMasterRecord) => {
    if (activeTab === "family") {
      return <EmployeeFamilyDetailsTab employeeId={record.id} />;
    }
    if (activeTab === "personalInformation") {
      return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <InfoSection
            title={t("employeeDirectory.sections.personalInformation")}
            {...sectionEditProps("personalInformation")}
            editor={draft && editorGrid(
              <>
                {requiredTextEditor("edit-firstName", t("employeeDirectory.fields.firstName"), "firstName", "text", 100)}
                {nullableTextEditor("edit-middleName", t("employeeDirectory.fields.middleName"), "middleName", "text", 100)}
                {requiredTextEditor("edit-lastName", t("employeeDirectory.fields.lastName"), "lastName", "text", 100)}
                {nullableTextEditor("edit-suffix", t("employeeDirectory.fields.suffix"), "suffix", "text", 20)}
                {nullableTextEditor("edit-preferredName", t("employeeDirectory.fields.preferredName"), "preferredName", "text", 200)}
                {selectEditor(
                  "edit-gender",
                  t("employeeDirectory.fields.gender"),
                  draft.gender ?? "",
                  genderOptions,
                  (value) => setDraftField("gender", value || null),
                  notProvided,
                )}
                {dateEditor("edit-dateOfBirth", t("employeeDirectory.fields.dateOfBirth"), "dateOfBirth")}
                {nullableTextEditor("edit-placeOfBirth", t("employeeDirectory.fields.placeOfBirth"), "placeOfBirth", "text", 200)}
                {nullableTextEditor("edit-nationality", t("employeeDirectory.fields.nationality"), "nationality", "text", 120)}
                {nullableTextEditor("edit-religion", t("employeeDirectory.fields.religion"), "religion", "text", 120)}
                {selectEditor(
                  "edit-bloodType",
                  t("employeeDirectory.fields.bloodType"),
                  draft.bloodType ?? "",
                  bloodTypeOptions,
                  (value) => setDraftField("bloodType", value ? value as EmployeeMasterInput["bloodType"] : null),
                  notProvided,
                )}
                {selectEditor(
                  "edit-maritalStatus",
                  t("employeeDirectory.fields.maritalStatus"),
                  draft.maritalStatus ?? "",
                  maritalStatusOptions,
                  (value) => setDraftField("maritalStatus", value ? value as EmployeeMasterInput["maritalStatus"] : null),
                  notProvided,
                )}
              </>,
            )}
          >
            <InfoRow label={t("employeeDirectory.fields.firstName")} value={record.firstName || notProvided} />
            <InfoRow label={t("employeeDirectory.fields.middleName")} value={record.middleName || notProvided} />
            <InfoRow label={t("employeeDirectory.fields.lastName")} value={record.lastName || notProvided} />
            <InfoRow label={t("employeeDirectory.fields.suffix")} value={record.suffix || notProvided} />
            <InfoRow label={t("employeeDirectory.fields.preferredName")} value={record.preferredName || notProvided} />
            <InfoRow
              label={t("employeeDirectory.fields.gender")}
              value={record.gender && ["female", "male"].includes(record.gender.toLowerCase())
                ? t(`employeeDirectory.genders.${record.gender.toLowerCase()}`)
                : record.gender || notProvided}
            />
            <InfoRow label={t("employeeDirectory.fields.nationality")} value={record.nationality || notProvided} />
            <InfoRow label={t("employeeDirectory.fields.religion")} value={record.religion || notProvided} />
            <InfoRow label={t("employeeDirectory.fields.dateOfBirth")} value={formatDate(record.dateOfBirth, i18n.language, notProvided)} />
            <InfoRow label={t("employeeDirectory.fields.placeOfBirth")} value={record.placeOfBirth || notProvided} />
            <InfoRow
              label={t("employeeDirectory.fields.bloodType")}
              value={record.bloodType ? t(`employeeDirectory.bloodTypes.${record.bloodType}`) : notProvided}
            />
            <InfoRow
              label={t("employeeDirectory.fields.maritalStatus")}
              value={record.maritalStatus ? t(`employeeDirectory.maritalStatuses.${record.maritalStatus}`) : notProvided}
            />
          </InfoSection>
          <div className="space-y-6">
          <InfoSection
            title={t("employeeDirectory.sections.addresses")}
            {...sectionEditProps("addresses")}
            editor={draft && editorGrid(
              <>
                {nullableTextEditor("edit-currentAddress", t("employeeDirectory.fields.currentAddress"), "currentAddress", "text", 1000)}
                {nullableTextEditor("edit-permanentAddress", t("employeeDirectory.fields.permanentAddress"), "permanentAddress", "text", 1000)}
              </>,
            )}
          >
              <InfoRow label={t("employeeDirectory.fields.currentAddress")} value={record.currentAddress || notProvided} />
              <InfoRow label={t("employeeDirectory.fields.permanentAddress")} value={record.permanentAddress || notProvided} />
            </InfoSection>
            <InfoSection
              title={t("employeeDirectory.sections.personalContact")}
              {...sectionEditProps("personalContact")}
              editor={draft && editorGrid(
                <>
                  {nullableTextEditor("edit-personalEmail", t("employeeDirectory.fields.personalEmail"), "personalEmail", "email", 320)}
                  {nullableTextEditor("edit-personalPhone", t("employeeDirectory.fields.personalPhone"), "personalPhone", "tel", 50)}
                </>,
              )}
            >
              <InfoRow label={t("employeeDirectory.fields.personalEmail")} value={record.personalEmail || notProvided} />
              <InfoRow label={t("employeeDirectory.fields.personalPhone")} value={record.personalPhone || notProvided} />
            </InfoSection>
            <InfoSection
              title={t("employeeDirectory.sections.education")}
              {...sectionEditProps("education")}
              isCustomContent
              editor={draft && (
                <div className="space-y-4">
                  {(draft.educationHistory ?? []).map((entry, index) => (
                    <fieldset key={`education-${index}`} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                      <legend className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {t("employeeDirectory.educationHistory.record", { number: index + 1 })}
                      </legend>
                      <div className="mb-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setDraftField(
                            "educationHistory",
                            (draft.educationHistory ?? []).filter((_, entryIndex) => entryIndex !== index),
                          )}
                          className="text-sm font-medium text-error-600 hover:text-error-700 dark:text-error-400 dark:hover:text-error-300"
                        >
                          {t("employeeDirectory.educationHistory.remove")}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <EditorField
                          id={`edit-education-level-${index}`}
                          label={t("employeeDirectory.fields.educationLevel")}
                          maxLength={120}
                          value={entry.educationLevel ?? ""}
                          onChange={(value) => setDraftField("educationHistory", (draft.educationHistory ?? []).map((current, entryIndex) => entryIndex === index ? { ...current, educationLevel: value || null } : current))}
                        />
                        <EditorField
                          id={`edit-education-institution-${index}`}
                          label={t("employeeDirectory.fields.educationInstitution")}
                          maxLength={200}
                          value={entry.institution ?? ""}
                          onChange={(value) => setDraftField("educationHistory", (draft.educationHistory ?? []).map((current, entryIndex) => entryIndex === index ? { ...current, institution: value || null } : current))}
                        />
                        <EditorField
                          id={`edit-education-field-${index}`}
                          label={t("employeeDirectory.fields.educationField")}
                          maxLength={160}
                          value={entry.fieldOfStudy ?? ""}
                          onChange={(value) => setDraftField("educationHistory", (draft.educationHistory ?? []).map((current, entryIndex) => entryIndex === index ? { ...current, fieldOfStudy: value || null } : current))}
                        />
                        <EditorField
                          id={`edit-education-start-${index}`}
                          label={t("employeeDirectory.fields.educationStartYear")}
                          type="number"
                          min={1900}
                          max={entry.graduationYear || 2200}
                          value={entry.startYear?.toString() ?? ""}
                          onChange={(value) => setDraftField("educationHistory", (draft.educationHistory ?? []).map((current, entryIndex) => entryIndex === index ? { ...current, startYear: value ? Number(value) : null } : current))}
                        />
                        <EditorField
                          id={`edit-education-graduation-${index}`}
                          label={t("employeeDirectory.fields.graduationYear")}
                          type="number"
                          min={entry.startYear || 1900}
                          max={2200}
                          value={entry.graduationYear?.toString() ?? ""}
                          onChange={(value) => setDraftField("educationHistory", (draft.educationHistory ?? []).map((current, entryIndex) => entryIndex === index ? { ...current, graduationYear: value ? Number(value) : null } : current))}
                        />
                      </div>
                    </fieldset>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDraftField("educationHistory", [
                      ...(draft.educationHistory ?? []),
                      { educationLevel: null, institution: null, fieldOfStudy: null, startYear: null, graduationYear: null },
                    ])}
                    disabled={(draft.educationHistory ?? []).length >= 30}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    {t("employeeDirectory.educationHistory.add")}
                  </button>
                </div>
              )}
            >
              <EducationHistoryTimeline
                bare
                entries={record.educationHistory.length > 0
                  ? record.educationHistory
                  : record.educationLevel || record.educationInstitution || record.educationField || record.graduationYear
                    ? [{
                        id: "legacy-education-record",
                        educationLevel: record.educationLevel,
                        institution: record.educationInstitution,
                        fieldOfStudy: record.educationField,
                        startYear: null,
                        graduationYear: record.graduationYear,
                      }]
                    : []}
              />
            </InfoSection>
            <InfoSection
              title={t("employeeDirectory.sections.emergencyContact")}
              {...sectionEditProps("emergencyContact")}
              editor={draft && editorGrid(
                <>
                  {nullableTextEditor("edit-emergency-name", t("employeeDirectory.fields.emergencyContactName"), "emergencyContactName", "text", 200)}
                  {nullableTextEditor("edit-emergency-relationship", t("employeeDirectory.fields.emergencyContactRelationship"), "emergencyContactRelationship", "text", 80)}
                  {nullableTextEditor("edit-emergency-phone", t("employeeDirectory.fields.emergencyContactPhone"), "emergencyContactPhone", "tel", 50)}
                  {nullableTextEditor("edit-emergency-email", t("employeeDirectory.fields.emergencyContactEmail"), "emergencyContactEmail", "email", 320)}
                  {nullableTextEditor("edit-emergency-address", t("employeeDirectory.fields.emergencyContactAddress"), "emergencyContactAddress", "text", 1000)}
                </>,
              )}
            >
              <InfoRow label={t("employeeDirectory.fields.emergencyContactName")} value={record.emergencyContactName || notProvided} />
              <InfoRow label={t("employeeDirectory.fields.emergencyContactRelationship")} value={record.emergencyContactRelationship || notProvided} />
              <InfoRow label={t("employeeDirectory.fields.emergencyContactPhone")} value={record.emergencyContactPhone || notProvided} />
              <InfoRow label={t("employeeDirectory.fields.emergencyContactEmail")} value={record.emergencyContactEmail || notProvided} />
              <InfoRow label={t("employeeDirectory.fields.emergencyContactAddress")} value={record.emergencyContactAddress || notProvided} />
            </InfoSection>
          </div>
        </div>
      );
    }

    if (activeTab === "employmentDetails") {
      return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <InfoSection
            title={t("employeeDirectory.details.employmentInformation")}
            {...sectionEditProps("employment")}
            editor={draft && editorGrid(
              <>
                {nullableTextEditor("edit-employeeNumber", t("employeeDirectory.fields.employeeNumber"), "employeeNumber", "text", 50)}
                {positionSelectEditor("edit-jobPosition")}
                {departmentValueEditor("edit-department")}
                {selectEditor(
                  "edit-employmentType",
                  t("employeeDirectory.fields.employmentType"),
                  draft.employmentType,
                  employmentTypeOptions,
                  (value) => setDraftField("employmentType", value as EmployeeMasterInput["employmentType"]),
                )}
                {selectEditor(
                  "edit-employmentStatus",
                  t("employeeDirectory.fields.status"),
                  draft.employmentStatus,
                  employmentStatusOptions,
                  (value) => setDraftField("employmentStatus", value as EmployeeMasterInput["employmentStatus"]),
                )}
                {selectEditor(
                  "edit-probationaryStatus",
                  t("employeeDirectory.fields.probationaryStatus"),
                  draft.isProbationary === null ? "unspecified" : draft.isProbationary ? "probationary" : "not_probationary",
                  probationaryStatusOptions,
                  (value) => setDraftField("isProbationary", value === "unspecified" ? null : value === "probationary"),
                )}
                {dateEditor("edit-regularizationDate", t("employeeDirectory.fields.regularizationDate"), "regularizationDate")}
                {dateEditor("edit-hireDate", t("employeeDirectory.fields.hireDate"), "hireDate")}
                {dateEditor("edit-terminationDate", t("employeeDirectory.fields.terminationDate"), "terminationDate")}
                {nullableTextEditor("edit-workLocation", t("employeeDirectory.fields.workLocation"), "workLocation", "text", 120)}
              </>,
            )}
          >
            <InfoRow label={t("employeeDirectory.fields.employeeNumber")} value={record.employeeNumber || notProvided} />
            <InfoRow label={t("employeeDirectory.fields.department")} value={record.department || notProvided} />
            <InfoRow label={t("employeeDirectory.fields.jobPosition")} value={record.jobTitle || notProvided} />
            <InfoRow label={t("employeeDirectory.fields.employmentType")} value={t(`employeeDirectory.employmentTypes.${record.employmentType}`)} />
            <InfoRow label={t("employeeDirectory.fields.status")} value={t(`employeeDirectory.statuses.${record.employmentStatus}`)} />
            <InfoRow
              label={t("employeeDirectory.fields.probationaryStatus")}
              value={
                record.isProbationary === null
                  ? t("employeeDirectory.probationaryStatuses.unspecified")
                  : t(`employeeDirectory.probationaryStatuses.${record.isProbationary ? "probationary" : "not_probationary"}`)
              }
            />
            <InfoRow label={t("employeeDirectory.fields.regularizationDate")} value={formatDate(record.regularizationDate, i18n.language, notProvided)} />
            <InfoRow label={t("employeeDirectory.fields.hireDate")} value={formatDate(record.hireDate, i18n.language, notProvided)} />
            <InfoRow label={t("employeeDirectory.fields.terminationDate")} value={formatDate(record.terminationDate, i18n.language, notProvided)} />
            <InfoRow label={t("employeeDirectory.fields.workLocation")} value={record.workLocation || notProvided} />
          </InfoSection>
          <div className="space-y-6">
            <InfoSection
              title={t("employeeDirectory.details.workContact")}
              {...sectionEditProps("workContact")}
              editor={draft && editorGrid(
                <>
                  {requiredTextEditor("edit-workEmail", t("employeeDirectory.fields.workEmail"), "workEmail", "email", 320)}
                  {nullableTextEditor("edit-workPhone", t("employeeDirectory.fields.workPhone"), "workPhone", "tel", 50)}
                  {nullableTextEditor("edit-managerEmail", t("employeeDirectory.fields.managerEmail"), "managerWorkEmail", "email", 320)}
                </>,
              )}
            >
              <InfoRow label={t("employeeDirectory.fields.workEmail")} value={record.workEmail} />
              <InfoRow label={t("employeeDirectory.fields.workPhone")} value={record.workPhone || notProvided} />
              <InfoRow label={t("employeeDirectory.fields.manager")} value={record.managerName || notProvided} />
              <InfoRow label={t("employeeDirectory.fields.managerEmail")} value={record.managerWorkEmail || notProvided} />
            </InfoSection>
            <InfoSection title={t("employeeDirectory.details.recordInformation")}>
              <InfoRow label={t("employeeDirectory.fields.updatedAt")} value={formatDate(record.updatedAt, i18n.language, notProvided)} />
            </InfoSection>
          </div>
        </div>
      );
    }

    if (activeTab === "documents") {
      return (
        <section className="py-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <DocsIcon className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("employeeDirectory.documents.emptyTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500 dark:text-gray-400">
            {t("employeeDirectory.documents.emptyDescription")}
          </p>
        </section>
      );
    }

    if (activeTab === "assets") {
      return (
        <section className="py-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <BoxCubeIcon className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("employeeDirectory.assets.emptyTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500 dark:text-gray-400">
            {t("employeeDirectory.assets.emptyDescription")}
          </p>
        </section>
      );
    }

    if (activeTab === "attendanceAndLeave" || activeTab === "payroll" || activeTab === "medical") {
      return <EmployeeHrDetailsTab employeeId={record.id} section={activeTab} />;
    }

    if (activeTab === "activity") {
      return (
        <section>
          <h2 className="mb-6 text-base font-semibold text-gray-800 dark:text-white/90">
            {t("employeeDirectory.activity.title")}
          </h2>
          <EmployeeActivityTimeline employeeId={record.id} />
        </section>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <InfoSection
          title={t("employeeDirectory.details.employmentInformation")}
          {...sectionEditProps("employment")}
          editor={draft && editorGrid(
            <>
              {nullableTextEditor("overview-edit-employeeNumber", t("employeeDirectory.fields.employeeNumber"), "employeeNumber", "text", 50)}
              {positionSelectEditor("overview-edit-jobPosition")}
              {departmentValueEditor("overview-edit-department")}
              {selectEditor(
                "overview-edit-employmentType",
                t("employeeDirectory.fields.employmentType"),
                draft.employmentType,
                employmentTypeOptions,
                (value) => setDraftField("employmentType", value as EmployeeMasterInput["employmentType"]),
              )}
              {selectEditor(
                "overview-edit-employmentStatus",
                t("employeeDirectory.fields.status"),
                draft.employmentStatus,
                employmentStatusOptions,
                (value) => setDraftField("employmentStatus", value as EmployeeMasterInput["employmentStatus"]),
              )}
              {selectEditor(
                "overview-edit-probationaryStatus",
                t("employeeDirectory.fields.probationaryStatus"),
                draft.isProbationary === null ? "unspecified" : draft.isProbationary ? "probationary" : "not_probationary",
                probationaryStatusOptions,
                (value) => setDraftField("isProbationary", value === "unspecified" ? null : value === "probationary"),
              )}
              {dateEditor("overview-edit-regularizationDate", t("employeeDirectory.fields.regularizationDate"), "regularizationDate")}
              {dateEditor("overview-edit-hireDate", t("employeeDirectory.fields.hireDate"), "hireDate")}
            </>,
          )}
        >
          <InfoRow label={t("employeeDirectory.fields.department")} value={record.department || notProvided} />
          <InfoRow label={t("employeeDirectory.fields.jobPosition")} value={record.jobTitle || notProvided} />
          <InfoRow label={t("employeeDirectory.fields.employmentType")} value={t(`employeeDirectory.employmentTypes.${record.employmentType}`)} />
          <InfoRow label={t("employeeDirectory.fields.status")} value={t(`employeeDirectory.statuses.${record.employmentStatus}`)} />
          <InfoRow
            label={t("employeeDirectory.fields.probationaryStatus")}
            value={
              record.isProbationary === null
                ? t("employeeDirectory.probationaryStatuses.unspecified")
                : t(`employeeDirectory.probationaryStatuses.${record.isProbationary ? "probationary" : "not_probationary"}`)
            }
          />
          <InfoRow label={t("employeeDirectory.fields.regularizationDate")} value={formatDate(record.regularizationDate, i18n.language, notProvided)} />
          <InfoRow label={t("employeeDirectory.fields.hireDate")} value={formatDate(record.hireDate, i18n.language, notProvided)} />
        </InfoSection>
        <InfoSection
          title={t("employeeDirectory.sections.personalContact")}
          {...sectionEditProps("overviewContact")}
          editor={draft && editorGrid(
            <>
              {requiredTextEditor("overview-edit-workEmail", t("employeeDirectory.fields.workEmail"), "workEmail", "email", 320)}
              {nullableTextEditor("overview-edit-workPhone", t("employeeDirectory.fields.workPhone"), "workPhone", "tel", 50)}
              {nullableTextEditor("overview-edit-personalEmail", t("employeeDirectory.fields.personalEmail"), "personalEmail", "email", 320)}
              {nullableTextEditor("overview-edit-personalPhone", t("employeeDirectory.fields.personalPhone"), "personalPhone", "tel", 50)}
            </>,
          )}
        >
          <InfoRow label={t("employeeDirectory.fields.workEmail")} value={record.workEmail} />
          <InfoRow label={t("employeeDirectory.fields.workPhone")} value={record.workPhone || notProvided} />
          <InfoRow label={t("employeeDirectory.fields.personalEmail")} value={record.personalEmail || notProvided} />
          <InfoRow label={t("employeeDirectory.fields.personalPhone")} value={record.personalPhone || notProvided} />
        </InfoSection>
      </div>
    );
  };

  return (
    <>
      <PageMeta title={pageTitle} description={t("employeeDirectory.details.description")} />
      <PageBreadcrumb pageTitle={t("employeeDirectory.details.title")} />

      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400">
          {t("employeeDirectory.table.loading")}
        </div>
      ) : errorKey ? (
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6 dark:border-error-500/30 dark:bg-error-500/10" role="alert">
          <p className="text-sm text-error-700 dark:text-error-400">{t(errorKey)}</p>
          <Link to="/employees" className="mt-4 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/3">
            {t("employeeDirectory.details.backToDirectory")}
          </Link>
        </div>
      ) : employee ? (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-6 rounded-2xl border border-gray-200 bg-white px-6 py-5 sm:flex-row sm:items-center dark:border-gray-800 dark:bg-white/3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                {initialsFor(employee.displayName)}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-semibold text-gray-800 dark:text-white/90">{employee.displayName}</h1>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(employee.employmentStatus)}`}>
                    {t(`employeeDirectory.statuses.${employee.employmentStatus}`)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {employee.jobTitle || notProvided}{employee.department ? ` · ${employee.department}` : ""}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t("employeeDirectory.fields.employeeNumber")}: {employee.employeeNumber || notProvided}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to={`/employees/${employee.id}/edit`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
              >
                <PencilIcon className="size-4" aria-hidden="true" />
                {t("employeeDirectory.details.editEmployee")}
              </Link>
              <Link to="/employees" className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/3">
                {t("employeeDirectory.details.backToDirectory")}
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <div className="overflow-x-auto border-b border-gray-200 dark:border-gray-800">
              <div className="flex min-w-max gap-1" role="tablist" aria-orientation="horizontal" aria-label={t("employeeDirectory.details.tabs.label")}>
                {tabKeys.map((tab) => (
                  <button
                    key={tab}
                    id={`employee-tab-${tab}`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    aria-controls="employee-detail-panel"
                    tabIndex={activeTab === tab ? 0 : -1}
                    onClick={() => setActiveTab(tab)}
                    onKeyDown={(event) => {
                      const currentIndex = tabKeys.indexOf(tab);
                      const rightward = i18n.dir(i18n.language) === "rtl" ? -1 : 1;
                      const previousIndex = (currentIndex - rightward + tabKeys.length) % tabKeys.length;
                      const nextIndex = (currentIndex + rightward) % tabKeys.length;
                      const nextTab = event.key === "Home"
                        ? tabKeys[0]
                        : event.key === "End"
                          ? tabKeys[tabKeys.length - 1]
                          : event.key === "ArrowRight"
                            ? tabKeys[nextIndex]
                            : event.key === "ArrowLeft"
                              ? tabKeys[previousIndex]
                              : undefined;
                      if (!nextTab) return;
                      event.preventDefault();
                      setActiveTab(nextTab);
                      document.getElementById(`employee-tab-${nextTab}`)?.focus();
                    }}
                    className={`border-b-2 px-4 py-4 text-sm font-medium transition ${activeTab === tab ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
                  >
                    {t(`employeeDirectory.details.tabs.${tab}`)}
                  </button>
                ))}
              </div>
            </div>
            <div id="employee-detail-panel" role="tabpanel" aria-labelledby={`employee-tab-${activeTab}`} tabIndex={0} className="p-5 outline-hidden sm:p-6">
              {renderTabPanel(employee)}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
