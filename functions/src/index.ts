import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { __setDbForTests as setDbForTests } from './modules/db';
import { normalizeCategory, normalizeProduct, normalizeText, normalizeWhatsAppNumber, toTitleCase } from './modules/normalization';
import { rebuildPublicProductsForStore, syncFlatProduct, toPublicProductDoc, upsertOrDeletePublicProduct } from './modules/public-products';
import { logPublicProductOperation } from './modules/observability';
import { computeRankingScore } from './modules/ranking';
import { computeVisibility, getEffectiveStoreStatus, isStoreBuyVisible, isVisibleProduct, publicProductId, withStoreDefaults, buildWhatsAppLink } from './modules/visibility';
import { type ProductDoc, type StoreDoc } from './modules/types';

admin.initializeApp();

const STORE_PATH = 'stores/{storeId}';
const FLAT_PRODUCT_PATH = 'products/{productId}';

const REPLAY_REQUEST_PATH = 'ops/publicProductReplays/requests/{requestId}';

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
  computeRankingScore,
  toPublicProductDoc,
  upsertOrDeletePublicProduct,
};

export const onStoreCreated = onDocumentCreated(STORE_PATH, async (event) => {
  if (!event.data) return;

  const storeId = event.params.storeId;
  const created = event.data.data() as StoreDoc;
  const defaults = withStoreDefaults(created);

  await event.data.ref.set(
    {
      eligibleForBuy: defaults.eligibleForBuy,
      buyOptOut: defaults.buyOptOut,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await rebuildPublicProductsForStore(storeId);
});

export const onStoreUpdated = onDocumentUpdated(STORE_PATH, async (event) => {
  if (!event.data) return;

  const storeId = event.params.storeId;
  const after = withStoreDefaults(event.data.after.data() as StoreDoc);
  const before = withStoreDefaults(event.data.before.data() as StoreDoc);

  if (event.data.after.data()?.eligibleForBuy === undefined || event.data.after.data()?.buyOptOut === undefined) {
    await event.data.after.ref.set(
      {
        eligibleForBuy: after.eligibleForBuy,
        buyOptOut: after.buyOptOut,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  const visibilityInputsChanged =
    getEffectiveStoreStatus(before) !== getEffectiveStoreStatus(after) ||
    before.eligibleForBuy !== after.eligibleForBuy ||
    before.buyOptOut !== after.buyOptOut ||
    before.whatsappNumber !== after.whatsappNumber ||
    before.phone !== after.phone ||
    before.name !== after.name ||
    before.slug !== after.slug ||
    before.logoUrl !== after.logoUrl ||
    before.bannerUrl !== after.bannerUrl ||
    before.category !== after.category ||
    before.city !== after.city ||
    before.country !== after.country ||
    before.addressLine1 !== after.addressLine1 ||
    before.verified !== after.verified;

  if (visibilityInputsChanged) {
    await rebuildPublicProductsForStore(storeId);
  }
});

export const onFlatProductCreated = onDocumentCreated(FLAT_PRODUCT_PATH, async (event) => {
  if (!event.data) return;
  await syncFlatProduct({
    productId: event.params.productId,
    after: event.data.data() as ProductDoc,
  });
});

export const onFlatProductUpdated = onDocumentUpdated(FLAT_PRODUCT_PATH, async (event) => {
  if (!event.data) return;
  await syncFlatProduct({
    productId: event.params.productId,
    before: event.data.before.data() as ProductDoc,
    after: event.data.after.data() as ProductDoc,
  });
});

export const onFlatProductDeleted = onDocumentDeleted(FLAT_PRODUCT_PATH, async (event) => {
  if (!event.data) return;
  await syncFlatProduct({
    productId: event.params.productId,
    before: event.data.data() as ProductDoc,
  });
});

export const onPublicProductsReplayRequested = onDocumentCreated(REPLAY_REQUEST_PATH, async (event) => {
  if (!event.data) return;
  const requestId = event.params.requestId;
  const payload = event.data.data() as { storeId?: string; requestedBy?: string };
  const storeId = normalizeText(payload.storeId);

  if (!storeId) {
    logger.warn('Replay request missing storeId', { requestId, payload });
    await event.data.ref.set({ status: 'failed', reason: 'missing-storeId', processedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    logPublicProductOperation({ operation: 'failure', reason: 'replay-missing-storeId', source: 'onPublicProductsReplayRequested' });
    return;
  }

  await event.data.ref.set({ status: 'running', processedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  try {
    await rebuildPublicProductsForStore(storeId);
    await event.data.ref.set({
      status: 'completed',
      storeId,
      requestedBy: normalizeText(payload.requestedBy) ?? null,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    logPublicProductOperation({ operation: 'replay', storeId, reason: 'requested-replay', source: 'onPublicProductsReplayRequested' });
  } catch (error) {
    logPublicProductOperation({ operation: 'failure', storeId, reason: 'replay-failed', error, source: 'onPublicProductsReplayRequested' });
    await event.data.ref.set({ status: 'failed', storeId, reason: 'replay-failed', completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
});
