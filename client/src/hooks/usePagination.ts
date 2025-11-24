import { useState } from 'react';

export function usePagination(initialPage: number = 1, pageSize: number = 10) {
  const [page, setPage] = useState(initialPage);

  const handleNextPage = (totalPages: number) => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handlePageClick = (pageNum: number) => {
    setPage(pageNum);
  };

  const resetPage = () => setPage(initialPage);

  return { page, setPage, handleNextPage, handlePreviousPage, handlePageClick, resetPage, pageSize };
}
