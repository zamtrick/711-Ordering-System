import type { SelectHTMLAttributes, ReactNode } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  children: ReactNode;
};

export default function Select({
  label,
  error,
  children,
  className = "",
  id,
  ...rest
}: Props) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-semibold text-[#232323] dark:text-white"
        >
          {label}
        </label>
      )}

      <select
        id={selectId}
        className={[
          "h-11 px-3 rounded-xl border bg-white dark:bg-[#1E1E1E] text-sm text-[#232323] dark:text-white outline-none transition-colors cursor-pointer",
          "focus:border-[#007A53] focus:ring-2 focus:ring-[#007A53]/20",
          error ? "border-[#D64545]" : "border-[#E5E2DE] dark:border-[#2E2E2E]",
          className,
        ].join(" ")}
        {...rest}
      >
        {children}
      </select>

      {error && <p className="text-xs text-[#D64545]">{error}</p>}
    </div>
  );
}
