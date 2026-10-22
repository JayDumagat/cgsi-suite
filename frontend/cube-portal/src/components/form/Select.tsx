import { Portal, Select as ArkSelect, createListCollection } from "@ark-ui/react";
import { useState } from "react";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  defaultValue?: string;
}

const Select: React.FC<SelectProps> = ({
  options,
  placeholder = "Select an option",
  onChange,
  className = "",
  defaultValue = "",
}) => {
  const [selectedValue, setSelectedValue] = useState(defaultValue);
  const collection = createListCollection({ items: options });

  const handleValueChange = ({ value }: { value: string[] }) => {
    const nextValue = value[0] ?? "";
    setSelectedValue(nextValue);
    onChange(nextValue);
  };

  return (
    <ArkSelect.Root
      collection={collection}
      value={selectedValue ? [selectedValue] : []}
      onValueChange={handleValueChange}
    >
      <ArkSelect.HiddenSelect />
      <ArkSelect.Control className="relative">
        <ArkSelect.Trigger
          className={`flex h-11 w-full appearance-none items-center justify-between rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pe-11 text-start text-sm shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:focus:border-brand-800 ${
            selectedValue
              ? "text-gray-800 dark:text-white/90"
              : "text-gray-400 dark:text-gray-400"
          } ${className}`}
        >
          <ArkSelect.ValueText placeholder={placeholder} />
          <svg
            className="pointer-events-none absolute inset-e-3 top-1/2 -translate-y-1/2 text-gray-700 dark:text-gray-400"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M4.79175 8.02075L10.0001 13.2291L15.2084 8.02075"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </ArkSelect.Trigger>
      </ArkSelect.Control>
      <Portal>
        <ArkSelect.Positioner className="z-99999 min-w-[var(--reference-width)]">
          <ArkSelect.Content className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
            {options.map((option) => (
              <ArkSelect.Item
                key={option.value}
                item={option}
                className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm text-gray-700 outline-hidden data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-900 dark:text-gray-300 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-white"
              >
                <ArkSelect.ItemText>{option.label}</ArkSelect.ItemText>
                <ArkSelect.ItemIndicator className="text-brand-500" aria-hidden="true">
                  ✓
                </ArkSelect.ItemIndicator>
              </ArkSelect.Item>
            ))}
          </ArkSelect.Content>
        </ArkSelect.Positioner>
      </Portal>
    </ArkSelect.Root>
  );
};

export default Select;
