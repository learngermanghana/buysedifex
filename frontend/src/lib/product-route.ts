const PRODUCT_ROUTE_SEPARATOR = '--';

const normalizeProductToken = (value: string) =>
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

export const getProductRouteParam = (productId: string, productName?: string): string => {
  const normalizedProductId = productId.trim();
  const slug = normalizeProductToken(productName ?? '');

  if (slug) {
    return `${slug}${PRODUCT_ROUTE_SEPARATOR}${normalizedProductId}`;
  }

  return normalizedProductId;
};

export const extractProductIdFromRouteParam = (routeParam: string): string => {
  const decoded = decodeRouteParam(routeParam);
  if (!decoded) {
    return '';
  }

  const separatorIndex = decoded.lastIndexOf(PRODUCT_ROUTE_SEPARATOR);
  if (separatorIndex === -1) {
    return decoded;
  }

  return decoded.slice(separatorIndex + PRODUCT_ROUTE_SEPARATOR.length).trim();
};

export const getProductHref = (productId: string, productName?: string): string =>
  `/products/${encodeURIComponent(getProductRouteParam(productId, productName))}`;
