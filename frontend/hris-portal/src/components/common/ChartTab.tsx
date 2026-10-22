import { Tabs as ArkTabs } from "@ark-ui/react";
import { cn } from "@/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type ChartPeriod = "optionOne" | "optionTwo" | "optionThree";

const ChartTab: React.FC = () => {
  const { t } = useTranslation("common", { keyPrefix: "ecommerce.statistics" });
  const [selected, setSelected] = useState<ChartPeriod>("optionOne");

  const getButtonClass = (option: ChartPeriod) =>
    selected === option
      ? "shadow-theme-xs text-gray-900 dark:text-white bg-white dark:bg-gray-800"
      : "text-gray-500 dark:text-gray-400";

  return (
    <ArkTabs.Root
      value={selected}
      onValueChange={({ value }) => setSelected(value as ChartPeriod)}
      className="flex max-h-10 items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900"
    >
      <ArkTabs.List className="flex w-full items-center gap-0.5">
        <ArkTabs.Trigger
          value="optionOne"
          className={`w-full rounded-md px-3 py-2 text-theme-sm font-medium hover:text-gray-900 dark:hover:text-white ${getButtonClass(
            "optionOne",
          )}`}
        >
          {t("monthly")}
        </ArkTabs.Trigger>

        <ArkTabs.Trigger
          value="optionTwo"
          className={cn(
            "w-full rounded-md px-3 py-1.5 text-theme-sm font-medium hover:text-gray-900 rtl:min-w-23 dark:hover:text-white",
            getButtonClass("optionTwo"),
          )}
        >
          {t("quarterly")}
        </ArkTabs.Trigger>

        <ArkTabs.Trigger
          value="optionThree"
          className={`w-full rounded-md px-3 py-2 text-theme-sm font-medium hover:text-gray-900 dark:hover:text-white ${getButtonClass(
            "optionThree",
          )}`}
        >
          {t("annually")}
        </ArkTabs.Trigger>
      </ArkTabs.List>
    </ArkTabs.Root>
  );
};

export default ChartTab;
