import type {
  PayrollRunComponent,
  PayrollRunInput,
  PayrollRunItem,
  PayrollRunItemInput,
} from "@/components/employee-directory/employeeDirectoryApi";
import { Modal } from "@/components/ui/modal";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

const fieldClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800";
const labelClass = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const buttonClass = "inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";
const primaryButtonClass = "inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60";

export function CreatePayrollRunModal({
  isOpen,
  onClose,
  saving,
  error,
  defaultPeriodStart,
  defaultPeriodEnd,
  defaultPayDate,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  saving: boolean;
  error: string | null;
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
  defaultPayDate: string;
  onSubmit: (input: PayrollRunInput) => void;
}) {
  const { t, i18n } = useTranslation();
  const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd);
  const [payDate, setPayDate] = useState(defaultPayDate);

  useEffect(() => {
    if (!isOpen) return;
    setPeriodStart(defaultPeriodStart);
    setPeriodEnd(defaultPeriodEnd);
    setPayDate(defaultPayDate);
  }, [defaultPayDate, defaultPeriodEnd, defaultPeriodStart, isOpen]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ periodStart, periodEnd, payDate });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="mx-4 max-h-[90vh] max-w-xl overflow-y-auto p-6 sm:p-8">
      <h2 className="mb-2 pe-12 text-lg font-semibold text-gray-800 dark:text-white/90">
        {t("payrollPage.runs.createTitle")}
      </h2>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        {t("payrollPage.runs.createDescription")}
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 sm:col-span-2 dark:border-gray-800 dark:bg-white/5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("payrollPage.salaryPeriod")}</p>
            <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-white/90">
              {formatPayrollDate(periodStart, i18n.language)} – {formatPayrollDate(periodEnd, i18n.language)}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="payroll-pay-date">{t("payrollPage.runs.payDate")}</label>
            <input id="payroll-pay-date" className={fieldClass} type="date" min={periodEnd} value={payDate} onChange={(event) => setPayDate(event.target.value)} required />
          </div>
        </div>
        {error && <p className="text-sm text-error-600 dark:text-error-400" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <button type="button" className={buttonClass} onClick={onClose} disabled={saving}>{t("payrollPage.runs.cancel")}</button>
          <button type="submit" className={primaryButtonClass} disabled={saving}>{saving ? t("payrollPage.runs.creating") : t("payrollPage.runs.create")}</button>
        </div>
      </form>
    </Modal>
  );
}

function formatPayrollDate(value: string, locale: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function PayrollItemEditorModal({
  isOpen,
  item,
  currency,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  item: PayrollRunItem | null;
  currency: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: PayrollRunItemInput) => void;
}) {
  const { t, i18n } = useTranslation();
  const [basePay, setBasePay] = useState("0");
  const [earnings, setEarnings] = useState<PayrollRunComponent[]>([]);
  const [deductions, setDeductions] = useState<PayrollRunComponent[]>([]);
  const [contributions, setContributions] = useState<PayrollRunComponent[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!isOpen || !item) return;
    setBasePay(String(item.basePay));
    setEarnings(item.earnings.map((entry) => ({ ...entry })));
    setDeductions(item.deductions.map((entry) => ({ ...entry })));
    setContributions(item.contributions.map((entry) => ({ ...entry })));
    setNotes(item.notes ?? "");
  }, [isOpen, item]);

  if (!item) return null;

  const baseAmount = parseAmount(basePay);
  const earningTotal = totalComponents(earnings);
  const deductionTotal = totalComponents(deductions);
  const contributionTotal = totalComponents(contributions);
  const grossPay = baseAmount + earningTotal;
  const netPay = grossPay - deductionTotal - contributionTotal;

  function setGroup(key: "earnings" | "deductions" | "contributions", next: PayrollRunComponent[]) {
    if (key === "earnings") setEarnings(next);
    else if (key === "deductions") setDeductions(next);
    else setContributions(next);
  }

  function updateComponent(
    key: "earnings" | "deductions" | "contributions",
    index: number,
    changes: Partial<PayrollRunComponent>,
  ) {
    const group = key === "earnings" ? earnings : key === "deductions" ? deductions : contributions;
    setGroup(key, group.map((component, componentIndex) => componentIndex === index
      ? { ...component, ...changes }
      : component));
  }

  function removeComponent(key: "earnings" | "deductions" | "contributions", index: number) {
    const group = key === "earnings" ? earnings : key === "deductions" ? deductions : contributions;
    setGroup(key, group.filter((_, componentIndex) => componentIndex !== index));
  }

  function addComponent(key: "earnings" | "deductions" | "contributions") {
    const name = key === "earnings"
      ? t("payrollPage.runs.defaultEarning")
      : key === "deductions"
        ? t("payrollPage.runs.defaultDeduction")
        : t("payrollPage.runs.defaultContribution");
    const group = key === "earnings" ? earnings : key === "deductions" ? deductions : contributions;
    setGroup(key, [...group, { name, amount: 0 }]);
  }

  function renderComponents(
    key: "earnings" | "deductions" | "contributions",
    title: string,
    group: PayrollRunComponent[],
  ) {
    return (
      <section className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">{title}</h3>
          <button type="button" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300" onClick={() => addComponent(key)}>
            + {t("payrollPage.runs.addLine")}
          </button>
        </div>
        {group.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("payrollPage.runs.noLines")}</p>
        ) : group.map((component, index) => (
          <div key={`${key}-${index}`} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_5rem_auto] sm:items-end">
            <div>
              <label className={labelClass} htmlFor={`payroll-${key}-${index}-name`}>{t("payrollPage.runs.componentName")}</label>
              <input id={`payroll-${key}-${index}-name`} className={fieldClass} value={component.name} onChange={(event) => updateComponent(key, index, { name: event.target.value })} required maxLength={80} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`payroll-${key}-${index}-amount`}>{t("payrollPage.runs.amount")}</label>
              <input id={`payroll-${key}-${index}-amount`} className={fieldClass} type="number" min={0} max={999999999999.99} step="0.01" value={component.amount} onChange={(event) => updateComponent(key, index, { amount: parseAmount(event.target.value) })} required />
            </div>
            <div>
              <label className={labelClass} htmlFor={`payroll-${key}-${index}-hours`}>{t("payrollPage.runs.hours")}</label>
              <input id={`payroll-${key}-${index}-hours`} className={fieldClass} type="number" min={0} max={1000} step="0.01" value={component.hours ?? ""} onChange={(event) => updateComponent(key, index, { hours: event.target.value === "" ? null : parseAmount(event.target.value) })} />
            </div>
            <button type="button" className="mb-0.5 inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10" aria-label={t("payrollPage.runs.removeLine", { name: component.name })} onClick={() => removeComponent(key, index)}>
              {t("payrollPage.runs.remove")}
            </button>
          </div>
        ))}
      </section>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      basePay: baseAmount,
      earnings: cleanComponents(earnings),
      deductions: cleanComponents(deductions),
      contributions: cleanComponents(contributions),
      notes: notes.trim() || null,
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="mx-4 max-h-[92vh] max-w-4xl overflow-y-auto p-6 sm:p-8">
      <h2 className="mb-1 pe-12 text-lg font-semibold text-gray-800 dark:text-white/90">{t("payrollPage.runs.editPay", { name: item.employeeName })}</h2>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">{t("payrollPage.runs.editPayDescription")}</p>
      <form onSubmit={submit} className="space-y-4">
        <div className="max-w-xs">
          <label className={labelClass} htmlFor="payroll-base-pay">{t("payrollPage.runs.basePay")}</label>
          <input id="payroll-base-pay" className={fieldClass} type="number" min={0} max={999999999999.99} step="0.01" value={basePay} onChange={(event) => setBasePay(event.target.value)} required />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("payrollPage.runs.basePayHint")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-gray-50 px-4 py-3 dark:bg-white/5">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("payrollPage.runs.overtimeHours")}</p>
            <p className="mt-1 font-semibold text-gray-800 dark:text-white/90">{new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(item.overtimeHours)} {t("payrollPage.runs.hoursShort")}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3 dark:bg-white/5">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("payrollPage.runs.payFrequency")}</p>
            <p className="mt-1 font-semibold text-gray-800 dark:text-white/90">{item.payFrequency ? t(`payrollPage.frequencies.${item.payFrequency}`) : t("payrollPage.notProvided")}</p>
          </div>
        </div>

        {renderComponents("earnings", t("payrollPage.runs.earnings"), earnings)}
        {renderComponents("deductions", t("payrollPage.runs.deductions"), deductions)}
        {renderComponents("contributions", t("payrollPage.runs.contributions"), contributions)}

        <div>
          <label className={labelClass} htmlFor="payroll-item-notes">{t("payrollPage.runs.notes")}</label>
          <textarea id="payroll-item-notes" className={`${fieldClass} min-h-20`} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} />
        </div>

        <div className="grid gap-3 rounded-xl bg-brand-50 p-4 sm:grid-cols-3 dark:bg-brand-500/10">
          <SummaryAmount label={t("payrollPage.runs.grossPay")} amount={grossPay} currency={currency} locale={i18n.language} />
          <SummaryAmount label={t("payrollPage.runs.totalDeductions")} amount={deductionTotal} currency={currency} locale={i18n.language} />
          <SummaryAmount label={t("payrollPage.runs.netPay")} amount={netPay} currency={currency} locale={i18n.language} negative={netPay < 0} />
        </div>
        {error && <p className="text-sm text-error-600 dark:text-error-400" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <button type="button" className={buttonClass} onClick={onClose} disabled={saving}>{t("payrollPage.runs.cancel")}</button>
          <button type="submit" className={primaryButtonClass} disabled={saving}>{saving ? t("payrollPage.runs.saving") : t("payrollPage.runs.saveChanges")}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ProcessPayrollRunModal({
  isOpen,
  payDate,
  excludedEmployeeCount,
  saving,
  error,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  payDate: string;
  excludedEmployeeCount: number;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [acknowledgedExclusions, setAcknowledgedExclusions] = useState(false);
  useEffect(() => {
    if (isOpen) setAcknowledgedExclusions(false);
  }, [excludedEmployeeCount, isOpen]);
  const formattedPayDate = payDate
    ? new Date(`${payDate}T12:00:00`).toLocaleDateString(i18n.language, { year: "numeric", month: "long", day: "numeric" })
    : "";
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="mx-4 max-w-lg p-6 sm:p-8">
      <h2 className="mb-2 pe-12 text-lg font-semibold text-gray-800 dark:text-white/90">{t("payrollPage.runs.processTitle")}</h2>
      <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">{t("payrollPage.runs.processDescription", { payDate: formattedPayDate })}</p>
      {excludedEmployeeCount > 0 && (
        <label className="mt-4 flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-800 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-300">
          <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand-500" checked={acknowledgedExclusions} onChange={(event) => setAcknowledgedExclusions(event.target.checked)} />
          <span>{t("payrollPage.runs.excludedAcknowledgement", { count: excludedEmployeeCount })}</span>
        </label>
      )}
      {error && <p className="mt-4 text-sm text-error-600 dark:text-error-400" role="alert">{error}</p>}
      <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
        <button type="button" className={buttonClass} onClick={onClose} disabled={saving}>{t("payrollPage.runs.cancel")}</button>
        <button type="button" className={primaryButtonClass} onClick={onConfirm} disabled={saving || (excludedEmployeeCount > 0 && !acknowledgedExclusions)}>{saving ? t("payrollPage.runs.processing") : t("payrollPage.runs.process")}</button>
      </div>
    </Modal>
  );
}

function SummaryAmount({ label, amount, currency, locale, negative = false }: {
  label: string;
  amount: number;
  currency: string;
  locale: string;
  negative?: boolean;
}) {
  let formatted = `${currency} ${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(amount))}`;
  try {
    formatted = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(amount));
  } catch {
    // Keep the currency-code fallback for currencies unsupported by the current runtime.
  }
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 font-semibold ${negative ? "text-error-600 dark:text-error-400" : "text-gray-800 dark:text-white/90"}`}>
        {negative ? "−" : ""}{formatted}
      </p>
    </div>
  );
}

function parseAmount(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function totalComponents(components: PayrollRunComponent[]): number {
  const cents = components.reduce((total, component) => total + Math.round(component.amount * 100), 0);
  return cents / 100;
}

function cleanComponents(components: PayrollRunComponent[]): PayrollRunComponent[] {
  return components.map((component) => ({
    name: component.name.trim(),
    amount: Math.round(component.amount * 100) / 100,
    ...(component.hours == null ? {} : { hours: Math.round(component.hours * 100) / 100 }),
  }));
}
