import {
  EmployeeDirectoryRequestError,
  getEmployeeHrDetails,
  updateEmployeeHrDetails,
  type EmployeeHrDetails,
} from "@/components/employee-directory/employeeDirectoryApi";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { PencilIcon } from "@/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type EmployeeHrDetailsSection = keyof EmployeeHrDetails;
type FieldKind = "text" | "number" | "amount" | "textarea" | "select";

interface FieldDefinition {
  key: string;
  kind: FieldKind;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

interface EmployeeHrDetailsTabProps {
  employeeId: string;
  section: EmployeeHrDetailsSection;
}

const emptyDetails: EmployeeHrDetails = {
  attendanceAndLeave: {
    workSchedule: null,
    weeklyHours: null,
    annualLeaveEntitlementDays: null,
    annualLeaveUsedDays: null,
  },
  payroll: {
    baseSalary: null,
    currency: null,
    payFrequency: null,
    payGrade: null,
    taxId: null,
    sssNumber: null,
    philhealthNumber: null,
    pagibigNumber: null,
  },
  medical: {
    allergies: null,
    medicalConditions: null,
    currentMedications: null,
    healthInsuranceProvider: null,
    healthInsurancePolicyNumber: null,
  },
};

export default function EmployeeHrDetailsTab({ employeeId, section }: EmployeeHrDetailsTabProps) {
  const { t, i18n } = useTranslation();
  const [details, setDetails] = useState<EmployeeHrDetails>(emptyDetails);
  const [draft, setDraft] = useState<EmployeeHrDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setErrorKey(null);
    void getEmployeeHrDetails(employeeId, controller.signal)
      .then(setDetails)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrorKey(
          error instanceof EmployeeDirectoryRequestError && error.status === 403
            ? "employeeDirectory.hrDetails.accessDenied"
            : "employeeDirectory.hrDetails.loadFailed",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [employeeId]);

  const sectionTitle = t(`employeeDirectory.hrDetails.${section}Title`);
  const fieldDefinitions: Record<EmployeeHrDetailsSection, FieldDefinition[]> = {
    attendanceAndLeave: [
      { key: "workSchedule", kind: "text", maxLength: 160 },
      { key: "weeklyHours", kind: "number", min: 0, max: 168, step: 0.25 },
      { key: "annualLeaveEntitlementDays", kind: "number", min: 0, max: 365, step: 0.5 },
      { key: "annualLeaveUsedDays", kind: "number", min: 0, max: 365, step: 0.5 },
    ],
    payroll: [
      { key: "baseSalary", kind: "amount", min: 0, step: 0.01 },
      { key: "currency", kind: "text", maxLength: 3 },
      {
        key: "payFrequency",
        kind: "select",
        options: [
          { value: "__none__", label: t("employeeDirectory.notProvided") },
          ...["weekly", "biweekly", "semimonthly", "monthly"].map((value) => ({
            value,
            label: t(`employeeDirectory.hrDetails.payFrequencies.${value}`),
          })),
        ],
      },
      { key: "payGrade", kind: "text", maxLength: 80 },
      { key: "taxId", kind: "text", maxLength: 80 },
      { key: "sssNumber", kind: "text", maxLength: 80 },
      { key: "philhealthNumber", kind: "text", maxLength: 80 },
      { key: "pagibigNumber", kind: "text", maxLength: 80 },
    ],
    medical: [
      { key: "allergies", kind: "textarea", maxLength: 2000 },
      { key: "medicalConditions", kind: "textarea", maxLength: 2000 },
      { key: "currentMedications", kind: "textarea", maxLength: 2000 },
      { key: "healthInsuranceProvider", kind: "text", maxLength: 160 },
      { key: "healthInsurancePolicyNumber", kind: "text", maxLength: 120 },
    ],
  };
  const fields = fieldDefinitions[section];

  const beginEditing = () => {
    setDraft({
      attendanceAndLeave: { ...details.attendanceAndLeave },
      payroll: { ...details.payroll },
      medical: { ...details.medical },
    });
    setErrorKey(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(null);
    setErrorKey(null);
    setIsEditing(false);
  };

  const setField = (field: FieldDefinition, rawValue: string) => {
    let value: string | number | null;
    if (field.kind === "number") {
      value = rawValue === "" ? null : Number(rawValue);
    } else if (field.key === "baseSalary") {
      value = rawValue || null;
    } else if (field.key === "currency") {
      value = rawValue.trim().toUpperCase() || null;
    } else if (field.kind === "select" && rawValue === "__none__") {
      value = null;
    } else {
      value = rawValue || null;
    }
    setDraft((current) => current
      ? {
          ...current,
          [section]: {
            ...(current[section] as unknown as Record<string, string | number | null>),
            [field.key]: value,
          },
        } as EmployeeHrDetails
      : current);
  };

  const saveChanges = async () => {
    if (!draft) return;
    setIsSaving(true);
    setErrorKey(null);
    try {
      const updated = await updateEmployeeHrDetails(employeeId, draft);
      setDetails(updated);
      setIsEditing(false);
      setDraft(null);
    } catch (error) {
      setErrorKey(
        error instanceof EmployeeDirectoryRequestError && error.status === 403
          ? "employeeDirectory.hrDetails.accessDenied"
          : "employeeDirectory.hrDetails.saveFailed",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const displayValue = (fieldKey: string, value: string | number | null) => {
    if (value === null || value === "") return t("employeeDirectory.notProvided");
    if (fieldKey === "payFrequency") {
      return t(`employeeDirectory.hrDetails.payFrequencies.${value}`);
    }
    if (fieldKey === "baseSalary") {
      const currency = details.payroll.currency || "PHP";
      try {
        return new Intl.NumberFormat(i18n.language, { style: "currency", currency }).format(Number(value));
      } catch {
        return `${currency} ${value}`;
      }
    }
    if (fieldKey === "weeklyHours") return t("employeeDirectory.hrDetails.units.hoursPerWeek", { value });
    if (
      fieldKey === "annualLeaveEntitlementDays" ||
      fieldKey === "annualLeaveUsedDays" ||
      fieldKey === "annualLeaveRemainingDays"
    ) {
      return t("employeeDirectory.hrDetails.units.days", { value });
    }
    return String(value);
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t("employeeDirectory.hrDetails.loading")}</p>;
  }

  if (errorKey === "employeeDirectory.hrDetails.loadFailed" || errorKey === "employeeDirectory.hrDetails.accessDenied") {
    return <p className="text-sm text-error-600 dark:text-error-400" role="alert">{t(errorKey)}</p>;
  }

  const editText = t("common.edit");
  const notProvided = t("employeeDirectory.notProvided");
  const currentRecord = details[section] as unknown as Record<string, string | number | null>;
  const draftRecord = draft?.[section] as unknown as Record<string, string | number | null> | undefined;
  const entitledDays = details.attendanceAndLeave.annualLeaveEntitlementDays;
  const usedDays = details.attendanceAndLeave.annualLeaveUsedDays;

  return (
    <section className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">{sectionTitle}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t(`employeeDirectory.hrDetails.${section}Description`)}
          </p>
        </div>
        {!isEditing && (
          <button
            type="button"
            aria-label={`${editText}: ${sectionTitle}`}
            title={editText}
            onClick={beginEditing}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-brand-300"
          >
            <PencilIcon className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {isEditing && draftRecord ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const id = `hr-${section}-${field.key}`;
              const label = t(`employeeDirectory.fields.${field.key}`);
              const value = draftRecord[field.key] ?? "";
              return (
                <div key={field.key} className={field.kind === "textarea" ? "sm:col-span-2" : "min-w-0"}>
                  <Label htmlFor={field.kind === "textarea" ? undefined : id}>{label}</Label>
                  {field.kind === "textarea" ? (
                    <TextArea
                      id={id}
                      maxLength={field.maxLength}
                      rows={3}
                      value={String(value)}
                      onChange={(nextValue) => setField(field, nextValue)}
                      className="dark:focus:ring-brand-500/20"
                    />
                  ) : field.kind === "select" ? (
                    <Select
                      key={`${id}-${String(value)}`}
                      id={id}
                      options={field.options ?? []}
                      placeholder={notProvided}
                      defaultValue={String(value)}
                      onChange={(nextValue) => setField(field, nextValue)}
                    />
                  ) : (
                    <Input
                      id={id}
                      name={id}
                      type={field.kind === "number" || field.kind === "amount" ? "number" : "text"}
                      value={String(value)}
                      onChange={(event) => setField(field, event.target.value)}
                      maxLength={field.maxLength}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {errorKey && <p className="text-sm text-error-600 dark:text-error-400" role="alert">{t(errorKey)}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              {t("employeeDirectory.create.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void saveChanges()}
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? t("employeeDirectory.edit.saving") : t("common.saveChanges")}
            </button>
          </div>
        </div>
      ) : (
        <dl className="divide-y divide-gray-100 dark:divide-gray-800">
          {fields.map((field) => (
            <div key={field.key} className="flex items-start gap-5 py-2.5">
              <dt className="w-1/2 text-sm text-gray-500 sm:w-1/3 dark:text-gray-400">
                {t(`employeeDirectory.fields.${field.key}`)}
              </dt>
              <dd className="w-1/2 break-words text-sm text-gray-700 sm:w-2/3 dark:text-gray-400">
                {displayValue(field.key, currentRecord[field.key] ?? null)}
              </dd>
            </div>
          ))}
          {section === "attendanceAndLeave" && (
            <div className="flex items-start gap-5 py-2.5">
              <dt className="w-1/2 text-sm text-gray-500 sm:w-1/3 dark:text-gray-400">
                {t("employeeDirectory.fields.annualLeaveRemainingDays")}
              </dt>
              <dd className="w-1/2 break-words text-sm text-gray-700 sm:w-2/3 dark:text-gray-400">
                {entitledDays === null || usedDays === null
                  ? notProvided
                  : displayValue("annualLeaveRemainingDays", Math.max(0, entitledDays - usedDays))}
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
