import React, { memo, useCallback, useMemo } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface TracePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const TracePaginationComponent: React.FC<TracePaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const handlePrevious = useCallback(() => {
    onPageChange(Math.max(0, currentPage - 1));
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    onPageChange(Math.min(totalPages - 1, currentPage + 1));
  }, [currentPage, totalPages, onPageChange]);

  const handlePageClick = useCallback(
    (pageIndex: number) => {
      onPageChange(pageIndex);
    },
    [onPageChange]
  );

  // Memoize the pagination items to prevent unnecessary re-renders
  const paginationItems = useMemo(() => {
    return Array.from({ length: totalPages }).map((_, i) => (
      <PaginationItem key={i}>
        <PaginationLink
          isActive={currentPage === i}
          onClick={() => handlePageClick(i)}
          className="cursor-pointer"
        >
          {i + 1}
        </PaginationLink>
      </PaginationItem>
    ));
  }, [currentPage, totalPages, handlePageClick]);

  if (totalPages <= 1) {
    return null; // Don't render pagination if there's only one page or less
  }

  return (
    <div className="pt-4">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={handlePrevious}
              className={currentPage === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              aria-disabled={currentPage === 0}
            />
          </PaginationItem>

          {paginationItems}

          <PaginationItem>
            <PaginationNext
              onClick={handleNext}
              className={
                currentPage >= totalPages - 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
              }
              aria-disabled={currentPage >= totalPages - 1}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};

export const TracePagination = memo(TracePaginationComponent);
