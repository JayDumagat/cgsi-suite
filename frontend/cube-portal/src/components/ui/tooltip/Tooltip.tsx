import { Tooltip as ArkTooltip } from "@ark-ui/react";
import { type ReactNode } from "react";

type TooltipPlacement = "top" | "right" | "bottom" | "left";

interface TooltipProps {
  content: ReactNode;
  placement?: TooltipPlacement;
  children: ReactNode;
  variant?: "default" | "dark" | "light" | "dark-plain";
}

export default function Tooltip({
  content,
  placement = "top",
  children,
  variant = "default",
}: TooltipProps) {
  const showArrow = variant === "default" || variant === "dark";

  const variantClasses = (() => {
    switch (variant) {
      case "dark":
        return "border border-gray-800 bg-gray-900 text-white dark:border-gray-700 dark:bg-gray-800";
      case "light":
        return "bg-white text-gray-700 shadow-lg dark:bg-gray-900 dark:text-white";
      case "dark-plain":
        return "bg-gray-900 text-white shadow-lg dark:bg-gray-800";
      default:
        return "border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-white";
    }
  })();

  const arrowClasses =
    variant === "dark"
      ? "border-gray-800 bg-gray-900 dark:border-gray-700 dark:bg-gray-800"
      : "border-gray-200 bg-white dark:border-gray-700 dark:bg-[#1E2634]";

  return (
    <ArkTooltip.Root
      openDelay={100}
      closeDelay={0}
      positioning={{ placement, offset: { mainAxis: 10 } }}
    >
      <ArkTooltip.Trigger asChild>
        <span className="inline-flex">{children}</span>
      </ArkTooltip.Trigger>
      <ArkTooltip.Positioner className="z-99999">
        <ArkTooltip.Content
          className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium shadow-md ${variantClasses}`}
        >
          {content}
          {showArrow && (
            <ArkTooltip.Arrow>
              <ArkTooltip.ArrowTip
                className={`size-2 rotate-45 border-r border-b ${arrowClasses}`}
              />
            </ArkTooltip.Arrow>
          )}
        </ArkTooltip.Content>
      </ArkTooltip.Positioner>
    </ArkTooltip.Root>
  );
}
