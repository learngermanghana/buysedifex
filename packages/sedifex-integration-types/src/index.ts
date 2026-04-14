export interface SedifexProduct {
  id: string;
  storeId: string;
  productName: string;
  description?: string;
  imageUrls: string[];
  imageAlt?: string;
  price?: number;
  currency?: string;
  storeName: string;
  categoryKey?: string;
  sku?: string;
  stockCount?: number;
  city?: string;
  country?: string;
  waLink?: string;
  phone?: string;
  websiteLink?: string;
  addressLine1?: string;
  verified?: boolean;
  publishedAt?: string;
}

export interface SedifexStoreProfile {
  storeId: string;
  storeName: string;
  storeSlug?: string;
  storeEmail?: string;
  storePhone?: string;
  storeWhatsapp?: string;
  websiteUrl?: string;
  storeLogoUrl?: string;
  storeBannerUrl?: string;
  city?: string;
  country?: string;
  addressLine1?: string;
  sameAs?: string[];
  verified?: boolean;
}

export interface SedifexPromo {
  id: string;
  storeId?: string;
  storeName?: string;
  storeSlug?: string;
  verified?: boolean;
  promoTitle?: string;
  promoSummary?: string;
  promoImageUrl?: string;
  promoImageAlt?: string | null;
  promoStartDate?: string;
  promoEndDate?: string;
  promoTiktokUrl?: string | null;
  promoWebsiteUrl?: string | null;
  promoYoutubeUrl?: string | null;
}

export interface SedifexGalleryItem {
  id: string;
  productId: string;
  imageUrl: string;
  imageAlt?: string;
}

export interface SedifexCustomer {
  id: string;
  displayName?: string;
  city?: string;
  country?: string;
}

export type SedifexProductSort = 'store-diverse' | 'newest' | 'price' | 'featured';
