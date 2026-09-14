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
          className="text-sm font-semibold text-ink"
        >
          {label}
        </label>
      )}

      <select
        id={selectId}
        className={[
          "h-11 px-3 rounded-xl border bg-white dark:bg-surface text-sm text-ink outline-none transition-colors cursor-pointer",
          "focus:border-accent focus:ring-2 focus:ring-accent/20",
          error ? "border-danger" : "border-line",
          className,
        ].join(" ")}
        {...rest}
      >
        {children}
      </select>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
