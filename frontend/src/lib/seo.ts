const defaultSiteUrl = 'https://buy.sedifex.com';

export const getSiteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl;

export const canonicalUrlForPath = (path: string) => new URL(path, getSiteUrl()).toString();

export const defaultSocialImagePath = '/opengraph-image';

export const defaultSocialImageUrl = () => canonicalUrlForPath(defaultSocialImagePath);

export const categoryNameFromKey = (categoryKey: string) =>
  categoryKey
    .trim()
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
