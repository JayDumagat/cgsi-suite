import type { ApplicationAccent } from "../../contracts/src/catalog";

export interface WorkspaceAppCardProps {
  name: string;
  description: string;
  href: string;
  initials: string;
  accent: ApplicationAccent;
  statusText: string;
  actionText: string;
  canAccess: boolean;
  available: boolean;
}

const accentStyles: Record<ApplicationAccent, string> = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  success:
    "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400",
  warning:
    "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400",
};

export default function WorkspaceAppCard({
  name,
  description,
  href,
  initials,
  accent,
  statusText,
  actionText,
  canAccess,
  available,
}: WorkspaceAppCardProps) {
  const canLaunch = canAccess && available;
  const cardClassName =
    "group flex min-h-56 flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition hover:border-brand-200 hover:shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-500/40";

  const contents = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className={`flex size-12 items-center justify-center rounded-xl text-sm font-semibold ${accentStyles[accent]}`}
        >
          {initials}
        </span>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-theme-xs font-medium text-gray-600 dark:bg-white/5 dark:text-gray-300">
          {statusText}
        </span>
      </div>
      <div className="mt-5 flex-1">
        <h3 className="text-theme-lg font-semibold text-gray-800 dark:text-white/90">
          {name}
        </h3>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
      <div
        className={`mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-sm font-medium dark:border-gray-800 ${
          canLaunch
            ? "text-brand-600 dark:text-brand-400"
            : "text-gray-400 dark:text-gray-500"
        }`}
      >
        <span>{actionText}</span>
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-1 rtl:-scale-x-100">
          →
        </span>
      </div>
    </>
  );

  if (!canLaunch) {
    return (
      <div aria-disabled="true" className={`${cardClassName} cursor-not-allowed`}>
        {contents}
      </div>
    );
  }

  return (
    <a className={cardClassName} href={href}>
      {contents}
    </a>
  );
}
