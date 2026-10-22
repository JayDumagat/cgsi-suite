import { ArrowRightIcon, BoxCubeIcon } from "@/icons";
import type { PortalApplication } from "@/types/portal";
import { useTranslation } from "react-i18next";

const accents: Record<string, string> = {
  success: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  warning: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
};

function safeApplicationHref(href: string) {
  try {
    const target = new URL(href, window.location.origin);
    return target.protocol === "https:" || target.protocol === "http:"
      ? target.toString()
      : null;
  } catch {
    return null;
  }
}

export default function ApplicationCard({ app }: { app: PortalApplication }) {
  const { t } = useTranslation();
  const href = app.status === "available" && app.canAccess
    ? safeApplicationHref(app.href)
    : null;
  const canOpen = Boolean(href);
  const statusLabel = app.status !== "available"
    ? t("cubePortal.comingSoon")
    : app.canAccess
      ? t("cubePortal.available")
      : t("cubePortal.noAccess");
  const initialsStyle = accents[app.accent] ?? accents.brand;

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <span className={`flex size-12 items-center justify-center rounded-xl text-sm font-semibold ${initialsStyle}`}>
          {app.initials || <BoxCubeIcon className="size-5" />}
        </span>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-white/5 dark:text-gray-300">
          {statusLabel}
        </span>
      </div>

      <div className="mt-5">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
          {app.name}
        </h3>
        <p className="mt-1.5 min-h-10 text-sm leading-5 text-gray-500 dark:text-gray-400">
          {app.description}
        </p>
        {!canOpen && app.status === "available" && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {t("cubePortal.accessRequired")}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-sm font-medium dark:border-gray-800">
        <span className={canOpen ? "text-brand-600 dark:text-brand-400" : "text-gray-400 dark:text-gray-500"}>
          {canOpen ? t("cubePortal.openApp") : statusLabel}
        </span>
        {canOpen && <ArrowRightIcon className="size-4 text-brand-500" />}
      </div>
    </>
  );

  const className = "flex min-h-56 flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-[border-color,box-shadow,transform] dark:border-gray-800 dark:bg-gray-dark";

  return canOpen ? (
    <a
      href={href!}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${t("cubePortal.openApp")}: ${app.name}`}
      className={`${className} hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-theme-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:border-brand-500/40`}
    >
      {content}
    </a>
  ) : (
    <article className={className}>{content}</article>
  );
}
