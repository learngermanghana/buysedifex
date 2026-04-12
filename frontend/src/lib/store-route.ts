const normalizeStoreToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const getStoreRouteId = (storeId?: string, storeName?: string): string | null => {
  const normalizedStoreId = storeId?.trim();
  if (normalizedStoreId) {
    return normalizedStoreId;
  }

  const normalizedStoreName = storeName?.trim();
  if (!normalizedStoreName) {
    return null;
  }

  const slug = normalizeStoreToken(normalizedStoreName);
  return slug.length > 0 ? slug : null;
};

export const getStoreHref = (storeId?: string, storeName?: string): string | null => {
  const routeId = getStoreRouteId(storeId, storeName);
  if (!routeId) {
    return null;
  }

  return `/stores/${encodeURIComponent(routeId)}`;
};
