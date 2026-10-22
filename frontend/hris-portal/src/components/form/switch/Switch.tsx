import { Switch as ArkSwitch } from "@ark-ui/react";
import { useState } from "react";

interface SwitchProps {
  label?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  color?: "blue" | "gray";
}

const Switch: React.FC<SwitchProps> = ({
  label,
  defaultChecked = false,
  disabled = false,
  onChange,
  color = "blue",
}) => {
  const [isChecked, setIsChecked] = useState(defaultChecked);

  const handleCheckedChange = ({ checked }: { checked: boolean }) => {
    setIsChecked(checked);
    onChange?.(checked);
  };

  const trackClass = disabled
    ? "pointer-events-none bg-gray-100 dark:bg-gray-800"
    : color === "blue"
      ? isChecked
        ? "bg-brand-500"
        : "bg-gray-200 dark:bg-white/10"
      : isChecked
        ? "bg-gray-800 dark:bg-white/10"
        : "bg-gray-200 dark:bg-white/10";

  const thumbClass = isChecked
    ? "translate-x-full bg-white"
    : "translate-x-0 bg-white";

  return (
    <ArkSwitch.Root
      checked={isChecked}
      disabled={disabled}
      onCheckedChange={handleCheckedChange}
      className={`flex w-fit select-none items-center gap-3 text-sm font-medium ${
        disabled ? "cursor-not-allowed text-gray-400" : "cursor-pointer text-gray-700 dark:text-gray-400"
      }`}
    >
      <ArkSwitch.HiddenInput />
      <ArkSwitch.Control
        className={`relative block h-6 w-11 rounded-full transition duration-150 ease-linear ${trackClass}`}
      >
        <ArkSwitch.Thumb
          className={`absolute left-0.5 top-0.5 h-5 w-5 transform rounded-full shadow-theme-sm duration-150 ease-linear ${thumbClass}`}
        />
      </ArkSwitch.Control>
      {label && <ArkSwitch.Label>{label}</ArkSwitch.Label>}
    </ArkSwitch.Root>
  );
};

export default Switch;
