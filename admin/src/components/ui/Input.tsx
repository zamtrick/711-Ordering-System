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
            className="text-sm font-semibold text-ink"
          >
            {label}
          </label>
        )}

        <div
          className={[
            "flex items-center h-11 px-3 rounded-xl border bg-white dark:bg-surface gap-2 transition-colors",
            "focus-within:border-accent focus-within:ring-2 focus-within:ring-[#007A53]/20",
            error ? "border-danger" : "border-line",
          ].join(" ")}
        >
          {leftIcon && (
            <span className="text-muted shrink-0">{leftIcon}</span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={[
              "flex-1 h-full outline-none bg-transparent text-sm text-ink placeholder:text-faint",
              className,
            ].join(" ")}
            {...rest}
          />

          {rightIcon && (
            <span className="text-muted shrink-0">{rightIcon}</span>
          )}
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
export default Input;
