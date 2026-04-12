const STORE_ROUTE_SEPARATOR = '--';

const normalizeStoreToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const decodeRouteParam = (value: string) => {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
};

const buildSlug = (storeSlug?: string, storeName?: string) => {
  const normalizedSlug = normalizeStoreToken(storeSlug ?? '');
  if (normalizedSlug) {
    return normalizedSlug;
  }

  const normalizedName = normalizeStoreToken(storeName ?? '');
  return normalizedName || null;
};

export const getStoreRouteId = (storeId?: string, storeName?: string, storeSlug?: string): string | null => {
  const normalizedStoreId = storeId?.trim();
  if (normalizedStoreId) {
    return normalizedStoreId;
  }

  return buildSlug(storeSlug, storeName);
};

export const getStoreRouteParam = (storeId?: string, storeName?: string, storeSlug?: string): string | null => {
  const normalizedStoreId = storeId?.trim();
  const slug = buildSlug(storeSlug, storeName);

  if (normalizedStoreId && slug) {
    return `${slug}${STORE_ROUTE_SEPARATOR}${normalizedStoreId}`;
  }

  if (normalizedStoreId) {
    return normalizedStoreId;
  }

  return slug;
};

export const extractStoreIdFromRouteParam = (routeParam: string): string => {
  const decoded = decodeRouteParam(routeParam);
  if (!decoded) {
    return '';
  }

  const separatorIndex = decoded.lastIndexOf(STORE_ROUTE_SEPARATOR);
  if (separatorIndex === -1) {
    return decoded;
  }

  return decoded.slice(separatorIndex + STORE_ROUTE_SEPARATOR.length).trim();
};

export const getStoreHref = (storeId?: string, storeName?: string, storeSlug?: string): string | null => {
  const routeParam = getStoreRouteParam(storeId, storeName, storeSlug);
  if (!routeParam) {
    return null;
  }

  return `/stores/${encodeURIComponent(routeParam)}`;
};
