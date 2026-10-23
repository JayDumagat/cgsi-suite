import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  createEmployee,
  EmployeeDirectoryRequestError,
  getEmployee,
  updateEmployee,
  type BloodType,
  type EmployeeMasterRecord,
  type EmployeeMasterInput,
  type MaritalStatus,
} from "@/components/employee-directory/employeeDirectoryApi";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";

type ProbationaryStatus = "unspecified" | "probationary" | "not_probationary";

interface EducationHistoryFormEntry {
  id: string;
  educationLevel: string;
  institution: string;
  fieldOfStudy: string;
  startYear: string;
  graduationYear: string;
}

let educationEntrySequence = 0;

function createEducationHistoryEntry(): EducationHistoryFormEntry {
  educationEntrySequence += 1;
  return {
    id: `education-${educationEntrySequence}`,
    educationLevel: "",
    institution: "",
    fieldOfStudy: "",
    startYear: "",
    graduationYear: "",
  };
}

type FormValues = Omit<
  EmployeeMasterInput,
  | "employeeNumber"
  | "middleName"
  | "suffix"
  | "preferredName"
  | "gender"
  | "dateOfBirth"
  | "placeOfBirth"
  | "bloodType"
  | "maritalStatus"
  | "permanentAddress"
  | "currentAddress"
  | "personalEmail"
  | "personalPhone"
  | "emergencyContactName"
  | "emergencyContactRelationship"
  | "emergencyContactPhone"
  | "emergencyContactEmail"
  | "educationHistory"
  | "educationLevel"
  | "educationInstitution"
  | "educationField"
  | "graduationYear"
  | "department"
  | "managerWorkEmail"
  | "jobTitle"
  | "isProbationary"
  | "regularizationDate"
  | "hireDate"
  | "terminationDate"
  | "workPhone"
  | "workLocation"
> & {
  employeeNumber: string;
  middleName: string;
  suffix: string;
  gender: string;
  dateOfBirth: string;
  placeOfBirth: string;
  bloodType: string;
  maritalStatus: string;
  permanentAddress: string;
  currentAddress: string;
  department: string;
  preferredName: string;
  personalEmail: string;
  personalPhone: string;
  educationHistory: EducationHistoryFormEntry[];
  managerWorkEmail: string;
  jobTitle: string;
  probationaryStatus: ProbationaryStatus;
  regularizationDate: string;
  hireDate: string;
  terminationDate: string;
  workPhone: string;
  workLocation: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  emergencyContactEmail: string;
};

const initialValues: FormValues = {
  employeeNumber: "",
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  preferredName: "",
  gender: "",
  dateOfBirth: "",
  placeOfBirth: "",
  bloodType: "",
  maritalStatus: "",
  permanentAddress: "",
  currentAddress: "",
  personalEmail: "",
  personalPhone: "",
  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactPhone: "",
  emergencyContactEmail: "",
  educationHistory: [createEducationHistoryEntry()],
  workEmail: "",
  department: "",
  managerWorkEmail: "",
  jobTitle: "",
  employmentType: "full_time",
  employmentStatus: "active",
  probationaryStatus: "unspecified",
  regularizationDate: "",
  hireDate: "",
  terminationDate: "",
  workPhone: "",
  workLocation: "",
};

function errorKey(error: unknown, isEditing: boolean) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403) {
      return isEditing
        ? "employeeDirectory.errors.editDenied"
        : "employeeDirectory.errors.createDenied";
    }
    if (error.status === 404) return "employeeDirectory.errors.notFound";
    if (error.code === "manager_must_be_an_active_employee") {
      return "employeeDirectory.errors.invalidManager";
    }
  }
  return isEditing
    ? "employeeDirectory.errors.editFailed"
    : "employeeDirectory.errors.createFailed";
}

function recordToFormValues(record: EmployeeMasterRecord): FormValues {
  const educationHistory = record.educationHistory.length > 0
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
      : [];

  return {
    ...initialValues,
    employeeNumber: record.employeeNumber ?? "",
    firstName: record.firstName ?? "",
    middleName: record.middleName ?? "",
    lastName: record.lastName ?? "",
    suffix: record.suffix ?? "",
    preferredName: record.preferredName ?? "",
    gender: record.gender ?? "",
    dateOfBirth: record.dateOfBirth ?? "",
    placeOfBirth: record.placeOfBirth ?? "",
    bloodType: record.bloodType ?? "",
    maritalStatus: record.maritalStatus ?? "",
    permanentAddress: record.permanentAddress ?? "",
    currentAddress: record.currentAddress ?? "",
    personalEmail: record.personalEmail ?? "",
    personalPhone: record.personalPhone ?? "",
    emergencyContactName: record.emergencyContactName ?? "",
    emergencyContactRelationship: record.emergencyContactRelationship ?? "",
    emergencyContactPhone: record.emergencyContactPhone ?? "",
    emergencyContactEmail: record.emergencyContactEmail ?? "",
    educationHistory: educationHistory.length > 0
      ? educationHistory.map((entry) => ({
          id: createEducationHistoryEntry().id,
          educationLevel: entry.educationLevel ?? "",
          institution: entry.institution ?? "",
          fieldOfStudy: entry.fieldOfStudy ?? "",
          startYear: entry.startYear?.toString() ?? "",
          graduationYear: entry.graduationYear?.toString() ?? "",
        }))
      : [createEducationHistoryEntry()],
    workEmail: record.workEmail,
    department: record.department ?? "",
    managerWorkEmail: record.managerWorkEmail ?? "",
    jobTitle: record.jobTitle ?? "",
    employmentType: record.employmentType,
    employmentStatus: record.employmentStatus,
    probationaryStatus: record.isProbationary === null
      ? "unspecified"
      : record.isProbationary
        ? "probationary"
        : "not_probationary",
    regularizationDate: record.regularizationDate ?? "",
    hireDate: record.hireDate ?? "",
    terminationDate: record.terminationDate ?? "",
    workPhone: record.workPhone ?? "",
    workLocation: record.workLocation ?? "",
  };
}

export default function NewEmployeePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { employeeId } = useParams();
  const isEditing = Boolean(employeeId);
  const [values, setValues] = useState(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedRecordId, setLoadedRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) {
      setValues(initialValues);
      setLoadError(null);
      setLoadedRecordId(null);
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    setLoadedRecordId(null);

    void getEmployee(employeeId, controller.signal)
      .then((record) => {
        setValues(recordToFormValues(record));
        setLoadedRecordId(employeeId);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        if (requestError instanceof EmployeeDirectoryRequestError && requestError.status === 401) {
          setLoadError("employeeDirectory.errors.sessionExpired");
        } else if (requestError instanceof EmployeeDirectoryRequestError && requestError.status === 403) {
          setLoadError("employeeDirectory.errors.accessDenied");
        } else if (requestError instanceof EmployeeDirectoryRequestError && requestError.status === 404) {
          setLoadError("employeeDirectory.errors.notFound");
        } else {
          setLoadError("employeeDirectory.errors.loadFailed");
        }
      });

    return () => controller.abort();
  }, [employeeId]);

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const updateEducationHistoryField = (
    entryId: string,
    field: Exclude<keyof EducationHistoryFormEntry, "id">,
    value: string,
  ) => {
    setValues((current) => ({
      ...current,
      educationHistory: current.educationHistory.map((entry) =>
        entry.id === entryId ? { ...entry, [field]: value } : entry,
      ),
    }));
  };

  const addEducationHistoryEntry = () => {
    const newEntry = createEducationHistoryEntry();
    setValues((current) => ({
      ...current,
      educationHistory: [...current.educationHistory, newEntry],
    }));
  };

  const removeEducationHistoryEntry = (entryId: string) => {
    setValues((current) => ({
      ...current,
      educationHistory: current.educationHistory.filter((entry) => entry.id !== entryId),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const { probationaryStatus, educationHistory, ...employeeValues } = values;
      const normalizedEducationHistory = educationHistory
        .filter((entry) => Boolean(entry.educationLevel.trim() || entry.institution.trim() || entry.fieldOfStudy.trim()))
        .map((entry) => ({
          educationLevel: entry.educationLevel.trim() || null,
          institution: entry.institution.trim() || null,
          fieldOfStudy: entry.fieldOfStudy.trim() || null,
          startYear: entry.startYear ? Number(entry.startYear) : null,
          graduationYear: entry.graduationYear ? Number(entry.graduationYear) : null,
        }));
      const primaryEducation = normalizedEducationHistory[0];
      const input: EmployeeMasterInput = {
        ...employeeValues,
        employeeNumber: values.employeeNumber.trim() || null,
        middleName: values.middleName.trim() || null,
        suffix: values.suffix.trim() || null,
        preferredName: values.preferredName.trim() || null,
        gender: values.gender.trim() || null,
        dateOfBirth: values.dateOfBirth || null,
        placeOfBirth: values.placeOfBirth.trim() || null,
        bloodType: values.bloodType
          ? (values.bloodType as BloodType)
          : null,
        maritalStatus: values.maritalStatus
          ? (values.maritalStatus as MaritalStatus)
          : null,
        permanentAddress: values.permanentAddress.trim() || null,
        currentAddress: values.currentAddress.trim() || null,
        personalEmail: values.personalEmail.trim() || null,
        personalPhone: values.personalPhone.trim() || null,
        emergencyContactName: values.emergencyContactName.trim() || null,
        emergencyContactRelationship: values.emergencyContactRelationship.trim() || null,
        emergencyContactPhone: values.emergencyContactPhone.trim() || null,
        emergencyContactEmail: values.emergencyContactEmail.trim() || null,
        educationLevel: primaryEducation?.educationLevel ?? null,
        educationInstitution: primaryEducation?.institution ?? null,
        educationField: primaryEducation?.fieldOfStudy ?? null,
        graduationYear: primaryEducation?.graduationYear ?? null,
        educationHistory: normalizedEducationHistory,
        department: values.department.trim() || null,
        managerWorkEmail: values.managerWorkEmail.trim() || null,
        jobTitle: values.jobTitle.trim() || null,
        isProbationary:
          probationaryStatus === "unspecified"
            ? null
            : probationaryStatus === "probationary",
        regularizationDate: values.regularizationDate || null,
        hireDate: values.hireDate || null,
        terminationDate: values.terminationDate || null,
        workPhone: values.workPhone.trim() || null,
        workLocation: values.workLocation.trim() || null,
      };
      const employee = employeeId
        ? await updateEmployee(employeeId, input)
        : await createEmployee(input);
      navigate(`/employees/${employee.id}`);
    } catch (requestError) {
      setError(errorKey(requestError, isEditing));
    } finally {
      setIsSubmitting(false);
    }
  };

  const employmentTypeOptions = [
    "full_time",
    "part_time",
    "contractor",
    "temporary",
    "intern",
  ].map((value) => ({
    value,
    label: t(`employeeDirectory.employmentTypes.${value}`),
  }));
  const employmentStatusOptions = ["active", "on_leave", "disabled", "offboarded"].map(
    (value) => ({
      value,
      label: t(`employeeDirectory.statuses.${value}`),
    }),
  );
  const probationaryStatusOptions = [
    "unspecified",
    "probationary",
    "not_probationary",
  ].map((value) => ({
    value,
    label: t(`employeeDirectory.probationaryStatuses.${value}`),
  }));
  const bloodTypeOptions = [
    "a_positive",
    "a_negative",
    "b_positive",
    "b_negative",
    "ab_positive",
    "ab_negative",
    "o_positive",
    "o_negative",
  ].map((value) => ({
    value,
    label: t(`employeeDirectory.bloodTypes.${value}`),
  }));
  const maritalStatusOptions = [
    "single",
    "married",
    "separated",
    "divorced",
    "widowed",
    "domestic_partner",
    "other",
  ].map((value) => ({
    value,
    label: t(`employeeDirectory.maritalStatuses.${value}`),
  }));

  return (
    <>
      <PageMeta
        title={`${t(isEditing ? "employeeDirectory.edit.title" : "employeeDirectory.create.title")} | ERIS`}
        description={t(isEditing ? "employeeDirectory.edit.description" : "employeeDirectory.create.description")}
      />
      <PageBreadcrumb
        pageTitle={t(isEditing ? "employeeDirectory.edit.title" : "employeeDirectory.create.title")}
        parentBreadcrumb={{
          title: t("employeeDirectory.breadcrumb"),
          to: "/employees",
        }}
      />

      <p className="-mt-3 mb-6 text-sm text-gray-500 dark:text-gray-400">
        {t(isEditing ? "employeeDirectory.edit.description" : "employeeDirectory.create.description")}
      </p>

      {isEditing && loadedRecordId !== employeeId && !loadError ? (
        <div className="rounded-xl border border-gray-200 px-5 py-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {t("employeeDirectory.edit.loading")}
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400" role="alert">
          <p>{t(loadError)}</p>
          <Link to={employeeId ? `/employees/${employeeId}` : "/employees"} className="mt-3 inline-flex font-medium underline">
            {t("employeeDirectory.details.backToDirectory")}
          </Link>
        </div>
      ) : (
      <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div
              className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
              role="alert"
            >
              {t(error)}
            </div>
          )}

          <div className="space-y-6">
            <FormSection title={t("employeeDirectory.sections.personalInformation")}>
              <TextField
                id="firstName"
                label={t("employeeDirectory.fields.firstName")}
                required
                maxLength={100}
                autoComplete="given-name"
                value={values.firstName}
                onChange={(value) => setField("firstName", value)}
              />
              <TextField
                id="middleName"
                label={t("employeeDirectory.fields.middleName")}
                maxLength={100}
                autoComplete="additional-name"
                value={values.middleName}
                onChange={(value) => setField("middleName", value)}
              />
              <TextField
                id="lastName"
                label={t("employeeDirectory.fields.lastName")}
                required
                maxLength={100}
                autoComplete="family-name"
                value={values.lastName}
                onChange={(value) => setField("lastName", value)}
              />
              <TextField
                id="suffix"
                label={t("employeeDirectory.fields.suffixOptional")}
                maxLength={20}
                value={values.suffix}
                onChange={(value) => setField("suffix", value)}
              />
              <TextField
                id="preferredName"
                label={t("employeeDirectory.fields.preferredName")}
                maxLength={200}
                value={values.preferredName}
                onChange={(value) => setField("preferredName", value)}
              />
              <TextField
                id="gender"
                label={t("employeeDirectory.fields.gender")}
                maxLength={100}
                value={values.gender}
                onChange={(value) => setField("gender", value)}
              />
              <TextField
                id="dateOfBirth"
                label={t("employeeDirectory.fields.dateOfBirth")}
                type="date"
                value={values.dateOfBirth}
                onChange={(value) => setField("dateOfBirth", value)}
              />
              <TextField
                id="placeOfBirth"
                label={t("employeeDirectory.fields.placeOfBirth")}
                maxLength={200}
                value={values.placeOfBirth}
                onChange={(value) => setField("placeOfBirth", value)}
              />
              <SelectField
                id="bloodType"
                label={t("employeeDirectory.fields.bloodType")}
                placeholder={t("employeeDirectory.notProvided")}
                options={bloodTypeOptions}
                value={values.bloodType}
                onChange={(value) => setField("bloodType", value)}
              />
              <SelectField
                id="maritalStatus"
                label={t("employeeDirectory.fields.maritalStatus")}
                placeholder={t("employeeDirectory.notProvided")}
                options={maritalStatusOptions}
                value={values.maritalStatus}
                onChange={(value) => setField("maritalStatus", value)}
              />
            </FormSection>

            <FormSection title={t("employeeDirectory.sections.personalContact")}>
              <TextField
                id="personalEmail"
                label={t("employeeDirectory.fields.personalEmail")}
                type="email"
                autoComplete="email"
                value={values.personalEmail}
                onChange={(value) => setField("personalEmail", value)}
              />
              <TextField
                id="personalPhone"
                label={t("employeeDirectory.fields.personalPhone")}
                type="tel"
                autoComplete="tel"
                maxLength={50}
                value={values.personalPhone}
                onChange={(value) => setField("personalPhone", value)}
              />
            </FormSection>

            <FormSection title={t("employeeDirectory.sections.addresses")}>
              <TextAreaField
                id="permanentAddress"
                label={t("employeeDirectory.fields.permanentAddress")}
                maxLength={1000}
                value={values.permanentAddress}
                onChange={(value) => setField("permanentAddress", value)}
              />
              <TextAreaField
                id="currentAddress"
                label={t("employeeDirectory.fields.currentAddress")}
                maxLength={1000}
                value={values.currentAddress}
                onChange={(value) => setField("currentAddress", value)}
              />
            </FormSection>

            <FormSection title={t("employeeDirectory.sections.emergencyContact")}>
              <TextField
                id="emergencyContactName"
                label={t("employeeDirectory.fields.emergencyContactName")}
                maxLength={200}
                value={values.emergencyContactName}
                onChange={(value) => setField("emergencyContactName", value)}
              />
              <TextField
                id="emergencyContactRelationship"
                label={t("employeeDirectory.fields.emergencyContactRelationship")}
                maxLength={80}
                value={values.emergencyContactRelationship}
                onChange={(value) => setField("emergencyContactRelationship", value)}
              />
              <TextField
                id="emergencyContactPhone"
                label={t("employeeDirectory.fields.emergencyContactPhone")}
                type="tel"
                maxLength={50}
                value={values.emergencyContactPhone}
                onChange={(value) => setField("emergencyContactPhone", value)}
              />
              <TextField
                id="emergencyContactEmail"
                label={t("employeeDirectory.fields.emergencyContactEmail")}
                type="email"
                maxLength={320}
                value={values.emergencyContactEmail}
                onChange={(value) => setField("emergencyContactEmail", value)}
              />
            </FormSection>

            <FormSection title={t("employeeDirectory.sections.organization")}>
              <TextField
                id="employeeNumber"
                label={t("employeeDirectory.fields.employeeNumberOptional")}
                maxLength={50}
                value={values.employeeNumber}
                onChange={(value) => setField("employeeNumber", value)}
              />
              <TextField
                id="department"
                label={t("employeeDirectory.fields.department")}
                maxLength={120}
                value={values.department}
                onChange={(value) => setField("department", value)}
              />
              <TextField
                id="jobTitle"
                label={t("employeeDirectory.fields.jobTitle")}
                maxLength={120}
                value={values.jobTitle}
                onChange={(value) => setField("jobTitle", value)}
              />
              <TextField
                id="managerWorkEmail"
                label={t("employeeDirectory.fields.managerEmailOptional")}
                type="email"
                autoComplete="off"
                hint={t("employeeDirectory.fields.managerEmailHint")}
                value={values.managerWorkEmail}
                onChange={(value) => setField("managerWorkEmail", value)}
              />
              <TextField
                id="workLocation"
                label={t("employeeDirectory.fields.workLocation")}
                maxLength={120}
                value={values.workLocation}
                onChange={(value) => setField("workLocation", value)}
              />
            </FormSection>

            <FormSection title={t("employeeDirectory.sections.education")}>
              <div className="space-y-4 sm:col-span-2 xl:col-span-3">
                {values.educationHistory.map((entry, index) => (
                  <fieldset key={entry.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                    <legend className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {t("employeeDirectory.educationHistory.record", { number: index + 1 })}
                    </legend>
                    <div className="mb-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeEducationHistoryEntry(entry.id)}
                        className="text-sm font-medium text-error-600 hover:text-error-700 dark:text-error-400 dark:hover:text-error-300"
                      >
                        {t("employeeDirectory.educationHistory.remove")}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      <TextField
                        id={`${entry.id}-educationLevel`}
                        label={t("employeeDirectory.fields.educationLevel")}
                        maxLength={120}
                        value={entry.educationLevel}
                        onChange={(value) => updateEducationHistoryField(entry.id, "educationLevel", value)}
                      />
                      <TextField
                        id={`${entry.id}-educationInstitution`}
                        label={t("employeeDirectory.fields.educationInstitution")}
                        maxLength={200}
                        value={entry.institution}
                        onChange={(value) => updateEducationHistoryField(entry.id, "institution", value)}
                      />
                      <TextField
                        id={`${entry.id}-educationField`}
                        label={t("employeeDirectory.fields.educationField")}
                        maxLength={160}
                        value={entry.fieldOfStudy}
                        onChange={(value) => updateEducationHistoryField(entry.id, "fieldOfStudy", value)}
                      />
                      <TextField
                        id={`${entry.id}-startYear`}
                        label={t("employeeDirectory.fields.educationStartYear")}
                        type="number"
                        min={1900}
                        max={entry.graduationYear || 2200}
                        value={entry.startYear}
                        onChange={(value) => updateEducationHistoryField(entry.id, "startYear", value)}
                      />
                      <TextField
                        id={`${entry.id}-graduationYear`}
                        label={t("employeeDirectory.fields.graduationYear")}
                        type="number"
                        min={entry.startYear || 1900}
                        max={2200}
                        value={entry.graduationYear}
                        onChange={(value) => updateEducationHistoryField(entry.id, "graduationYear", value)}
                      />
                    </div>
                  </fieldset>
                ))}
                <button
                  type="button"
                  onClick={addEducationHistoryEntry}
                  disabled={values.educationHistory.length >= 30}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  {t("employeeDirectory.educationHistory.add")}
                </button>
              </div>
            </FormSection>

            <FormSection title={t("employeeDirectory.sections.employment")}>
              <SelectField
                id="employmentType"
                label={t("employeeDirectory.fields.employmentType")}
                options={employmentTypeOptions}
                value={values.employmentType}
                onChange={(value) => setField("employmentType", value as EmployeeMasterInput["employmentType"])}
              />
              <SelectField
                id="employmentStatus"
                label={t("employeeDirectory.fields.status")}
                options={employmentStatusOptions}
                value={values.employmentStatus}
                onChange={(value) => setField("employmentStatus", value as EmployeeMasterInput["employmentStatus"])}
              />
              <SelectField
                id="probationaryStatus"
                label={t("employeeDirectory.fields.probationaryStatus")}
                options={probationaryStatusOptions}
                value={values.probationaryStatus}
                onChange={(value) => setField("probationaryStatus", value as ProbationaryStatus)}
              />
              {values.probationaryStatus === "probationary" && (
                <TextField
                  id="regularizationDate"
                  label={t("employeeDirectory.fields.regularizationDate")}
                  type="date"
                  required
                  min={values.hireDate || undefined}
                  value={values.regularizationDate}
                  onChange={(value) => setField("regularizationDate", value)}
                />
              )}
              <TextField
                id="hireDate"
                label={t("employeeDirectory.fields.hireDate")}
                type="date"
                value={values.hireDate}
                onChange={(value) => setField("hireDate", value)}
              />
              <TextField
                id="terminationDate"
                label={t("employeeDirectory.fields.terminationDate")}
                type="date"
                value={values.terminationDate}
                onChange={(value) => setField("terminationDate", value)}
              />
            </FormSection>

            <FormSection title={t("employeeDirectory.sections.workContact")}>
              <TextField
                id="workEmail"
                label={t("employeeDirectory.fields.workEmail")}
                type="email"
                required
                autoComplete="work email"
                value={values.workEmail}
                onChange={(value) => setField("workEmail", value)}
              />
              <TextField
                id="workPhone"
                label={t("employeeDirectory.fields.workPhone")}
                type="tel"
                autoComplete="work tel"
                value={values.workPhone}
                onChange={(value) => setField("workPhone", value)}
              />
            </FormSection>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <Link
              to={employeeId ? `/employees/${employeeId}` : "/employees"}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/3"
            >
              {t("employeeDirectory.create.cancel")}
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? t(isEditing ? "employeeDirectory.edit.saving" : "employeeDirectory.create.creating")
                : t(isEditing ? "employeeDirectory.edit.submit" : "employeeDirectory.create.submit")}
            </button>
          </div>
      </form>
      )}
    </>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  autoComplete?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}

function TextField({ id, label, type = "text", required, maxLength, min, max, autoComplete, hint, value, onChange }: TextFieldProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}{required ? " *" : ""}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        required={required}
        maxLength={maxLength}
        min={min}
        max={max}
        autoComplete={autoComplete}
        hint={hint}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

interface FormSectionProps {
  title: string;
  children: ReactNode;
}

function FormSection({ title, children }: FormSectionProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">{title}</h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

function SelectField({ id, label, options, placeholder, value, onChange }: SelectFieldProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        options={options}
        placeholder={placeholder}
        defaultValue={value}
        onChange={onChange}
      />
    </div>
  );
}

interface TextAreaFieldProps {
  id: string;
  label: string;
  maxLength?: number;
  value: string;
  onChange: (value: string) => void;
}

function TextAreaField({ id, label, maxLength, value, onChange }: TextAreaFieldProps) {
  return (
    <div className="sm:col-span-2 xl:col-span-3">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        name={id}
        rows={3}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs outline-hidden placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500 dark:focus:border-brand-800"
      />
    </div>
  );
}
