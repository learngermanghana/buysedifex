import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { __setDbForTests as setDbForTests } from './modules/db';
import { normalizeCategory, normalizeProduct, normalizeText, normalizeWhatsAppNumber, toTitleCase } from './modules/normalization';
import { rebuildPublicProductsForStore, toPublicProductDoc, upsertOrDeletePublicProduct } from './modules/public-products';
import { computeVisibility, getEffectiveStoreStatus, isStoreBuyVisible, isVisibleProduct, publicProductId, withStoreDefaults, buildWhatsAppLink } from './modules/visibility';

admin.initializeApp();

const STORE_PATH = 'stores/{storeId}';
const FLAT_PRODUCT_PATH = 'products/{productId}';

export const __setDbForTests = setDbForTests;
export { rebuildPublicProductsForStore };

export const __testing = {
  normalizeText,
  toTitleCase,
  normalizeCategory,
  normalizeWhatsAppNumber,
  normalizeProduct,
  buildWhatsAppLink,
  withStoreDefaults,
  getEffectiveStoreStatus,
  isStoreBuyVisible,
  isVisibleProduct,
  computeVisibility,
  publicProductId,
  toPublicProductDoc,
  upsertOrDeletePublicProduct,
};

// Deprecated: frontend now reads from Sedifex integration API instead of publicProducts.
export const onStoreCreated = onDocumentCreated(STORE_PATH, async () => undefined);
export const onStoreUpdated = onDocumentUpdated(STORE_PATH, async () => undefined);
export const onFlatProductCreated = onDocumentCreated(FLAT_PRODUCT_PATH, async () => undefined);
export const onFlatProductUpdated = onDocumentUpdated(FLAT_PRODUCT_PATH, async () => undefined);
export const onFlatProductDeleted = onDocumentDeleted(FLAT_PRODUCT_PATH, async () => undefined);
