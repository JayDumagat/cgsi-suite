import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import ComponentCard from "@/components/common/ComponentCard";

interface HrStatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "brand" | "success" | "warning" | "purple";
}

const tones = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  success:
    "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  warning:
    "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  purple:
    "bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
};

export function HrStatCard({
  label,
  value,
  icon,
  tone = "brand",
}: HrStatCardProps) {
  return (
    <Card>
      <article>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <span
            className={`flex size-10 items-center justify-center rounded-xl ${tones[tone]}`}
            aria-hidden="true"
          >
            {icon}
          </span>
        </div>
        <p className="mt-4 text-2xl font-semibold text-gray-800 dark:text-white/90">
          {value}
        </p>
      </article>
    </Card>
  );
}

interface ModuleSectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function ModuleSection({
  title,
  description,
  children,
}: ModuleSectionProps) {
  return (
    <ComponentCard title={title} desc={description}>
      {children}
    </ComponentCard>
  );
}

export function EmptyModuleState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 px-5 py-10 text-center dark:border-gray-700">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}
