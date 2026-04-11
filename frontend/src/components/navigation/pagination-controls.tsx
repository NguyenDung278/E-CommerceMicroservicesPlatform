function buildVisiblePages(currentPage: number, pageCount: number) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);

  return Array.from(pages)
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((left, right) => left - right);
}

export function PaginationControls({
  currentPage,
  pageCount,
  onPageChange,
  ariaLabel = "Pagination",
  className = "",
}: {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
  className?: string;
}) {
  if (pageCount <= 1) {
    return null;
  }

  const visiblePages = buildVisiblePages(currentPage, pageCount);
  const paginationClassName = className ? `pagination ${className}` : "pagination";

  return (
    <nav aria-label={ariaLabel} className={paginationClassName}>
      <button
        aria-label="Go to previous page"
        className="pagination-item"
        disabled={currentPage === 1}
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
      >
        Prev
      </button>

      {visiblePages.map((page, index) => {
        const previousPage = visiblePages[index - 1];
        const showGap = typeof previousPage === "number" && page - previousPage > 1;

        return (
          <span key={page}>
            {showGap ? <span className="pagination-ellipsis">…</span> : null}
            <button
              aria-current={page === currentPage ? "page" : undefined}
              aria-label={`Go to page ${page}`}
              className={
                page === currentPage
                  ? "pagination-item pagination-item-active"
                  : "pagination-item"
              }
              type="button"
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          </span>
        );
      })}

      <button
        aria-label="Go to next page"
        className="pagination-item"
        disabled={currentPage === pageCount}
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
      </button>
    </nav>
  );
}
