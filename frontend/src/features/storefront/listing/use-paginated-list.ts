import { startTransition, useEffect, useMemo, useState } from "react";

type UsePaginatedListOptions = {
  pageSize?: number;
};

export function usePaginatedList<T>(items: T[], options: UsePaginatedListOptions = {}) {
  const pageSize = Math.max(1, options.pageSize ?? 12);
  const [currentPage, setCurrentPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    startTransition(() => {
      setCurrentPage(1);
    });
  }, [items, pageSize]);

  useEffect(() => {
    if (currentPage <= pageCount) {
      return;
    }

    startTransition(() => {
      setCurrentPage(pageCount);
    });
  }, [currentPage, pageCount]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [currentPage, items, pageSize]);

  const pageStart = items.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = items.length === 0 ? 0 : Math.min(currentPage * pageSize, items.length);

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > pageCount || nextPage === currentPage) {
      return;
    }

    startTransition(() => {
      setCurrentPage(nextPage);
    });
  }

  return {
    currentPage,
    goToPage,
    pageCount,
    pageEnd,
    pageSize,
    pageStart,
    paginatedItems,
  };
}
