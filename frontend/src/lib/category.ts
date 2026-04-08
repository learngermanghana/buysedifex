export const formatCategoryName = (categoryKey?: string): string => {
  if (!categoryKey) {
    return 'Uncategorized';
  }

  return categoryKey
    .split(/[-_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

export const buildCategoryPath = (categoryKey: string): string => `/category/${encodeURIComponent(categoryKey)}`;
