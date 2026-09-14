import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

// --------------------------------------------------
// REUSABLE TABLE PAGINATION
// --------------------------------------------------
// Renders "Page X of Y", a rows-per-page select, and prev/next buttons.
// Styled to match the admin tables (rounded, theme-aware borders).
// --------------------------------------------------

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  label?: string; // what the rows are, e.g. "customers"
};

const LIMIT_OPTIONS = [5, 10, 25, 50];

export default function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  label = "items",
}: PaginationProps) {
  const { isDark } = useTheme();

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const btnClass = (enabled: boolean) =>
    `inline-flex items-center justify-center gap-1 h-9 px-3 rounded-xl border text-sm font-medium transition-colors
    ${
      enabled
        ? `cursor-pointer ${isDark ? "border-line text-ink hover:bg-sunken" : "border-line text-ink hover:bg-sunken"}`
        : `cursor-not-allowed opacity-40 ${isDark ? "border-line text-muted" : "border-line text-faint"}`
    }`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
      <p className={`text-xs ${isDark ? "text-muted" : "text-muted"}`}>
        Showing <span className="font-semibold">{from}</span>–
        <span className="font-semibold">{to}</span> of{" "}
        <span className="font-semibold">{total}</span> {label}
      </p>

      <div className="flex items-center gap-2">
        {onLimitChange && (
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className={`h-9 px-2 rounded-xl border text-sm cursor-pointer outline-none ${
              isDark
                ? "bg-surface border-line text-white"
                : "bg-white border-line text-ink"
            }`}
            title="Rows per page"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => canPrev && onPageChange(page - 1)}
          disabled={!canPrev}
          className={btnClass(canPrev)}
        >
          <ChevronLeft size={15} />
          Prev
        </button>
        <span
          className={`text-sm font-semibold px-2 ${isDark ? "text-white" : "text-ink"}`}
        >
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => canNext && onPageChange(page + 1)}
          disabled={!canNext}
          className={btnClass(canNext)}
        >
          Next
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
