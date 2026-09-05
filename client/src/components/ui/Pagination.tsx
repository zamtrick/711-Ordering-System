import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
};

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
}: PaginationProps) {
  const { isDark } = useTheme();

  if (totalPages <= 1) return null;

  // Generate page numbers to display
  const getPages = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    if (currentPage > 3) pages.push("...");

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) pages.push(i);

    if (currentPage < totalPages - 2) pages.push("...");

    pages.push(totalPages);

    return pages;
  };

  const pages = getPages();

  const btnBase = `h-9 min-w-[36px] px-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center justify-center`;
  const activeBg = isDark ? "bg-[#078080] text-white" : "bg-[#007A53] text-white";
  const inactiveBg = isDark
    ? "text-[#A0A0A0] hover:bg-[#2A2A2A]"
    : "text-[#555] hover:bg-[#F0F0F0]";
  const disabledStyle = "opacity-40 cursor-not-allowed pointer-events-none";

  return (
    <div className="flex items-center justify-between mt-4">
      {/* Info */}
      {totalItems !== undefined && pageSize !== undefined && (
        <p className="text-xs text-[#777] dark:text-[#A0A0A0]">
          Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)}–
          {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
        </p>
      )}

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={`${btnBase} ${inactiveBg} ${currentPage <= 1 ? disabledStyle : ""}`}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Page numbers */}
        {pages.map((page, idx) =>
          page === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              className={`${btnBase} text-[#777] dark:text-[#A0A0A0] cursor-default`}
            >
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`${btnBase} ${
                currentPage === page ? activeBg : inactiveBg
              }`}
            >
              {page}
            </button>
          ),
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={`${btnBase} ${inactiveBg} ${
            currentPage >= totalPages ? disabledStyle : ""
          }`}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
