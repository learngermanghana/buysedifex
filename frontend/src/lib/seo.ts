const defaultSiteUrl = 'https://buy.sedifex.com';

export const getSiteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl;

export const canonicalUrlForPath = (path: string) => new URL(path, getSiteUrl()).toString();
