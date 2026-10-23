import type React from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/utils";

interface CheckboxProps {
  label?: string;
  checked: boolean;
  className?: string;
  id?: string;
  ariaLabel?: string;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  id,
  ariaLabel,
  indeterminate = false,
  onChange,
  className = "",
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      className={cn(
        "flex items-center gap-3 group cursor-pointer",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <div className="relative flex items-center justify-center w-5 h-5">
        <input
          ref={inputRef}
          id={id}
          type="checkbox"
          aria-label={ariaLabel}
          className={cn(
            "w-5 h-5 appearance-none cursor-pointer dark:border-gray-700 border border-gray-300 checked:border-transparent rounded-md checked:bg-brand-500 disabled:opacity-60",
            indeterminate && "border-transparent bg-brand-500 dark:border-transparent",
            className
          )}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        {checked && !indeterminate && (
          <svg
            className="pointer-events-none absolute inset-0 m-auto"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
              stroke="white"
              strokeWidth="1.94437"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {indeterminate && (
          <svg
            className="pointer-events-none absolute inset-0 m-auto"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M3 7H11"
              stroke="white"
              strokeWidth="1.94437"
              strokeLinecap="round"
            />
          </svg>
        )}
        {disabled && (
          <svg
            className="pointer-events-none absolute inset-0 m-auto"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
              stroke="#E4E7EC"
              strokeWidth="2.33333"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      {label && (
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {label}
        </span>
      )}
    </label>
  );
};

export default Checkbox;
