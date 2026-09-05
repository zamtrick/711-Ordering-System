import { useState, useMemo } from "react";

type UsePaginationOptions<T> = {
  items: T[];
  pageSize?: number;
};

type UsePaginationReturn<T> = {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  totalPages: number;
  paginatedItems: T[];
  totalItems: number;
  nextPage: () => void;
  prevPage: () => void;
};

export function usePagination<T>({
  items,
  pageSize = 10,
}: UsePaginationOptions<T>): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Reset to page 1 if current page exceeds total
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safeCurrentPage, pageSize]);

  const nextPage = () => {
    setCurrentPage((p) => Math.min(p + 1, totalPages));
  };

  const prevPage = () => {
    setCurrentPage((p) => Math.max(p - 1, 1));
  };

  return {
    currentPage: safeCurrentPage,
    setCurrentPage,
    pageSize,
    totalPages,
    paginatedItems,
    totalItems,
    nextPage,
    prevPage,
  };
}
