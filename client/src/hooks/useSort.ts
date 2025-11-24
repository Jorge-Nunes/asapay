import { useState } from 'react';

export function useSort<T extends string>(initialField: T, initialOrder: 'asc' | 'desc' = 'asc') {
  const [sortField, setSortField] = useState<T>(initialField);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialOrder);

  const handleSort = (field: T) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return { sortField, setSortField, sortOrder, setSortOrder, handleSort };
}
