const defaultSiteUrl = 'https://buy.sedifex.com';

export const getSiteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl;

export const canonicalUrlForPath = (path: string) => new URL(path, getSiteUrl()).toString();

export const defaultSocialImagePath = '/opengraph-image';

export const defaultSocialImageUrl = () => canonicalUrlForPath(defaultSocialImagePath);

export const baseSeoKeywords = [
  'beauty stores in ghana',
  'buy products in ghana',
  'ghana online marketplace',
  'shops in ghana',
  'ghanaian products',
  'ghana business directory',
  'whatsapp shopping ghana',
  'sedifex',
];

export const buildSeoKeywords = (...keywords: string[]) => Array.from(new Set([...baseSeoKeywords, ...keywords]));

export const categoryNameFromKey = (categoryKey: string) =>
  categoryKey
    .trim()
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
