import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  createEmployee,
  EmployeeDirectoryRequestError,
  type EmployeeMasterInput,
} from "@/components/employee-directory/employeeDirectoryApi";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

type FormValues = Omit<EmployeeMasterInput, "employeeNumber" | "middleName" | "suffix" | "preferredName" | "personalEmail" | "personalPhone" | "educationLevel" | "educationInstitution" | "educationField" | "graduationYear" | "department" | "managerWorkEmail" | "jobTitle" | "hireDate" | "terminationDate" | "workPhone" | "workLocation"> & {
  employeeNumber: string;
  middleName: string;
  suffix: string;
  department: string;
  preferredName: string;
  personalEmail: string;
  personalPhone: string;
  educationLevel: string;
  educationInstitution: string;
  educationField: string;
  graduationYear: string;
  managerWorkEmail: string;
  jobTitle: string;
  hireDate: string;
  terminationDate: string;
  workPhone: string;
  workLocation: string;
};

const initialValues: FormValues = {
  employeeNumber: "",
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  preferredName: "",
  personalEmail: "",
  personalPhone: "",
  educationLevel: "",
  educationInstitution: "",
  educationField: "",
  graduationYear: "",
  workEmail: "",
  department: "",
  managerWorkEmail: "",
  jobTitle: "",
  employmentType: "full_time",
  employmentStatus: "active",
  hireDate: "",
  terminationDate: "",
  workPhone: "",
  workLocation: "",
};

function errorKey(error: unknown) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403) return "employeeDirectory.errors.createDenied";
    if (error.code === "manager_must_be_an_active_employee") {
      return "employeeDirectory.errors.invalidManager";
    }
  }
  return "employeeDirectory.errors.createFailed";
}

export default function NewEmployeePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const employee = await createEmployee({
        ...values,
        employeeNumber: values.employeeNumber.trim() || null,
        middleName: values.middleName.trim() || null,
        suffix: values.suffix.trim() || null,
        preferredName: values.preferredName.trim() || null,
        personalEmail: values.personalEmail.trim() || null,
        personalPhone: values.personalPhone.trim() || null,
        educationLevel: values.educationLevel.trim() || null,
        educationInstitution: values.educationInstitution.trim() || null,
        educationField: values.educationField.trim() || null,
        graduationYear: values.graduationYear ? Number(values.graduationYear) : null,
        department: values.department.trim() || null,
        managerWorkEmail: values.managerWorkEmail.trim() || null,
        jobTitle: values.jobTitle.trim() || null,
        hireDate: values.hireDate || null,
        terminationDate: values.terminationDate || null,
        workPhone: values.workPhone.trim() || null,
        workLocation: values.workLocation.trim() || null,
      });
      navigate(`/employees/${employee.id}`);
    } catch (requestError) {
      setError(errorKey(requestError));
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

  return (
    <>
      <PageMeta
        title={`${t("employeeDirectory.create.title")} | ERIS`}
        description={t("employeeDirectory.create.description")}
      />
      <PageBreadcrumb
        pageTitle={t("employeeDirectory.create.title")}
        parentBreadcrumb={{
          title: t("employeeDirectory.breadcrumb"),
          to: "/employees",
        }}
      />

      <p className="-mt-3 mb-6 text-sm text-gray-500 dark:text-gray-400">
        {t("employeeDirectory.create.description")}
      </p>

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
              <TextField
                id="educationLevel"
                label={t("employeeDirectory.fields.educationLevel")}
                maxLength={120}
                value={values.educationLevel}
                onChange={(value) => setField("educationLevel", value)}
              />
              <TextField
                id="educationInstitution"
                label={t("employeeDirectory.fields.educationInstitution")}
                maxLength={200}
                value={values.educationInstitution}
                onChange={(value) => setField("educationInstitution", value)}
              />
              <TextField
                id="educationField"
                label={t("employeeDirectory.fields.educationField")}
                maxLength={160}
                value={values.educationField}
                onChange={(value) => setField("educationField", value)}
              />
              <TextField
                id="graduationYear"
                label={t("employeeDirectory.fields.graduationYear")}
                type="number"
                min={1900}
                max={2200}
                value={values.graduationYear}
                onChange={(value) => setField("graduationYear", value)}
              />
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
              to="/employees"
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
                ? t("employeeDirectory.create.creating")
                : t("employeeDirectory.create.submit")}
            </button>
          </div>
      </form>
    </>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
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
  value: string;
  onChange: (value: string) => void;
}

function SelectField({ id, label, options, value, onChange }: SelectFieldProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        options={options}
        defaultValue={value}
        onChange={onChange}
      />
    </div>
  );
}
