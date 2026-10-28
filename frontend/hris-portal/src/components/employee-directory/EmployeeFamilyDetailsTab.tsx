import {
  EmployeeDirectoryRequestError,
  getEmployeeHrDetails,
  updateEmployeeHrDetails,
  type EmployeeFamilyChild,
  type EmployeeFamilyDetails,
  type EmployeeFamilyPerson,
  type EmployeeHrDetails,
} from "@/components/employee-directory/employeeDirectoryApi";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PencilIcon } from "@/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface EmployeeFamilyDetailsTabProps {
  employeeId: string;
}

type AdultKey = "spouse" | "mother" | "father";
type FamilyField = keyof EmployeeFamilyPerson;

function cloneFamily(family: EmployeeFamilyDetails): EmployeeFamilyDetails {
  return {
    spouse: { ...family.spouse },
    mother: { ...family.mother },
    father: { ...family.father },
    children: family.children.map((child) => ({ ...child })),
  };
}

function formatDate(value: string | null, locale: string, emptyLabel: string) {
  if (!value) return emptyLabel;
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date)
    : value;
}

export default function EmployeeFamilyDetailsTab({ employeeId }: EmployeeFamilyDetailsTabProps) {
  const { t, i18n } = useTranslation();
  const [details, setDetails] = useState<EmployeeHrDetails | null>(null);
  const [draft, setDraft] = useState<EmployeeFamilyDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

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

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t("employeeDirectory.hrDetails.loading")}</p>;
  }
  if (errorKey || !details) {
    return <p className="text-sm text-error-600 dark:text-error-400" role="alert">
      {t(errorKey ?? "employeeDirectory.hrDetails.loadFailed")}
    </p>;
  }

  const family = draft ?? details.family;
  const notProvided = t("employeeDirectory.notProvided");
  const memberFields: Array<{ key: FamilyField; label: string; type?: string }> = [
    { key: "lastName", label: t("employeeDirectory.fields.lastName") },
    { key: "firstName", label: t("employeeDirectory.fields.firstName") },
    { key: "middleInitial", label: t("employeeDirectory.hrDetails.familyFields.middleInitial") },
    { key: "birthDate", label: t("employeeDirectory.fields.dateOfBirth"), type: "date" },
    { key: "nationality", label: t("employeeDirectory.fields.nationality") },
  ];

  const updateAdult = (key: AdultKey, field: FamilyField, value: string) => {
    setDraft((current) => current
      ? { ...current, [key]: { ...current[key], [field]: value || null } }
      : current);
  };

  const updateChild = (index: number, field: keyof EmployeeFamilyChild, value: string) => {
    setDraft((current) => current
      ? {
          ...current,
          children: current.children.map((child, childIndex) =>
            childIndex === index ? { ...child, [field]: value || null } : child,
          ),
        }
      : current);
  };

  const renderEditorFields = (
    idPrefix: string,
    member: EmployeeFamilyPerson,
    onChange: (field: FamilyField, value: string) => void,
    gender?: EmployeeFamilyChild["gender"],
    onGenderChange?: (value: string) => void,
  ) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {memberFields.map((field) => {
        const id = `${idPrefix}-${field.key}`;
        return (
          <div key={field.key}>
            <Label htmlFor={id}>{field.label}</Label>
            <Input
              id={id}
              name={id}
              type={field.type ?? "text"}
              maxLength={field.type ? undefined : field.key === "middleInitial" ? 20 : 120}
              value={member[field.key] ?? ""}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          </div>
        );
      })}
      {onGenderChange && (
        <div>
          <Label htmlFor={`${idPrefix}-gender`}>{t("employeeDirectory.fields.gender")}</Label>
          <select
            id={`${idPrefix}-gender`}
            name={`${idPrefix}-gender`}
            value={gender ?? ""}
            onChange={(event) => onGenderChange(event.target.value)}
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          >
            <option value="">{notProvided}</option>
            <option value="female">{t("employeeDirectory.genders.female")}</option>
            <option value="male">{t("employeeDirectory.genders.male")}</option>
          </select>
        </div>
      )}
    </div>
  );

  const renderReadFields = (member: EmployeeFamilyPerson, gender?: EmployeeFamilyChild["gender"]) => (
    <dl className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
      {memberFields.map((field) => (
        <div key={field.key}>
          <dt className="text-xs text-gray-500 dark:text-gray-400">{field.label}</dt>
          <dd className="mt-1 break-words text-sm text-gray-800 dark:text-white/90">
            {field.key === "birthDate"
              ? formatDate(member.birthDate, i18n.language, notProvided)
              : member[field.key] || notProvided}
          </dd>
        </div>
      ))}
      {gender !== undefined && (
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">{t("employeeDirectory.fields.gender")}</dt>
          <dd className="mt-1 text-sm text-gray-800 dark:text-white/90">
            {gender ? t(`employeeDirectory.genders.${gender}`) : notProvided}
          </dd>
        </div>
      )}
    </dl>
  );

  const adultSections: Array<{ key: AdultKey; title: string }> = [
    { key: "spouse", title: t("employeeDirectory.hrDetails.familyMembers.spouse") },
    { key: "mother", title: t("employeeDirectory.hrDetails.familyMembers.mother") },
    { key: "father", title: t("employeeDirectory.hrDetails.familyMembers.father") },
  ];

  const save = async () => {
    if (!draft || !details) return;
    setIsSaving(true);
    setErrorKey(null);
    try {
      const updated = await updateEmployeeHrDetails(employeeId, { ...details, family: draft });
      setDetails(updated);
      setDraft(null);
      setIsEditing(false);
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

  return (
    <section className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("employeeDirectory.hrDetails.familyTitle")}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("employeeDirectory.hrDetails.familyDescription")}
          </p>
        </div>
        {!isEditing && (
          <button
            type="button"
            aria-label={`${t("common.edit")}: ${t("employeeDirectory.hrDetails.familyTitle")}`}
            title={t("common.edit")}
            onClick={() => {
              setDraft(cloneFamily(details.family));
              setErrorKey(null);
              setIsEditing(true);
            }}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-brand-300"
          >
            <PencilIcon className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {adultSections.map(({ key, title }) => (
          <fieldset key={key} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <legend className="px-1 text-sm font-medium text-gray-800 dark:text-white/90">{title}</legend>
            {isEditing && draft
              ? renderEditorFields(`family-${key}`, family[key], (field, value) => updateAdult(key, field, value))
              : renderReadFields(family[key])}
          </fieldset>
        ))}
        {family.children.map((child, index) => (
          <fieldset key={`child-${index}`} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <legend className="px-1 text-sm font-medium text-gray-800 dark:text-white/90">
              {t("employeeDirectory.hrDetails.familyMembers.child", { number: index + 1 })}
            </legend>
            {isEditing && draft
              ? renderEditorFields(
                  `family-child-${index + 1}`,
                  child,
                  (field, value) => updateChild(index, field, value),
                  child.gender,
                  (value) => updateChild(index, "gender", value),
                )
              : renderReadFields(child, child.gender)}
          </fieldset>
        ))}
      </div>

      {errorKey && <p className="mt-4 text-sm text-error-600 dark:text-error-400" role="alert">{t(errorKey)}</p>}
      {isEditing && (
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setErrorKey(null);
              setIsEditing(false);
            }}
            disabled={isSaving}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            {t("employeeDirectory.create.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={isSaving}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? t("employeeDirectory.edit.saving") : t("common.saveChanges")}
          </button>
        </div>
      )}
    </section>
  );
}
