export function sortArray<T>(
  arr: T[],
  sortField: keyof T,
  sortOrder: 'asc' | 'desc'
): T[] {
  return [...arr].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    // Handle dates
    if (aValue instanceof Date) {
      aValue = aValue.getTime();
    }
    if (bValue instanceof Date) {
      bValue = bValue.getTime();
    }

    // Handle strings
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = (bValue as string).toLowerCase();
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }

    // Handle numbers
    if (typeof aValue === 'number') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });
}
