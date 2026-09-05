import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, leftIcon, rightIcon, className = "", id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-semibold text-[#232323] dark:text-white"
          >
            {label}
          </label>
        )}

        <div
          className={[
            "flex items-center h-11 px-3 rounded-xl border bg-white dark:bg-[#1E1E1E] gap-2 transition-colors",
            "focus-within:border-[#007A53] focus-within:ring-2 focus-within:ring-[#007A53]/20",
            error ? "border-[#D64545]" : "border-[#E5E2DE] dark:border-[#2E2E2E]",
          ].join(" ")}
        >
          {leftIcon && (
            <span className="text-[#777] dark:text-[#A0A0A0] shrink-0">{leftIcon}</span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={[
              "flex-1 h-full outline-none bg-transparent text-sm text-[#232323] dark:text-white placeholder:text-[#aaa]",
              className,
            ].join(" ")}
            {...rest}
          />

          {rightIcon && (
            <span className="text-[#777] dark:text-[#A0A0A0] shrink-0">{rightIcon}</span>
          )}
        </div>

        {error && <p className="text-xs text-[#D64545]">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
export default Input;
