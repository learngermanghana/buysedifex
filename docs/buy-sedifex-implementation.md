# buy.sedifex.com implementation blueprint

## A) Architecture summary

- **Canonical data stays in Sedifex** under `stores/{storeId}` and `stores/{storeId}/products/{productId}`.
- **Cloud Functions are source-of-truth** for visibility and sanitization logic.
- **Public read model** `publicProducts/{storeId_productId}` is denormalized for fast, cheap frontend reads.
- **Frontend reads only publicProducts** and never recomputes visibility conditions.

## B) Firestore schema proposal

### 1) `stores/{storeId}`

```json
{
  "name": "Aster Pharmacy",
  "slug": "aster-pharmacy",
  "storeStatus": "active",
  "eligibleForBuy": true,
  "buyOptOut": false,
  "whatsappNumber": "+1 (555) 123-4567",
  "logoUrl": "https://...",
  "bannerUrl": "https://...",
  "category": "Health",
  "updatedAt": "serverTimestamp"
}
```

### 2) `stores/{storeId}/products/{productId}`

```json
{
  "name": "Vitamin C 1000mg",
  "slug": "vitamin-c-1000mg",
  "description": "Immune support supplement",
  "category": "Supplements",
  "imageUrls": ["https://..."],
  "price": 19.99,
  "currency": "USD",
  "isActive": true,
  "isApproved": true,
  "featuredRank": 10,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 3) `publicProducts/{storeId_productId}`

```json
{
  "id": "storeA_productX",
  "storeId": "storeA",
  "productId": "productX",
  "isVisible": true,
  "storeStatus": "active",
  "eligibleForBuy": true,
  "buyOptOut": false,
  "isActive": true,
  "isApproved": true,
  "categoryKey": "supplements",
  "storeName": "Aster Pharmacy",
  "storeSlug": "aster-pharmacy",
  "storeLogoUrl": "https://...",
  "storeBannerUrl": "https://...",
  "productName": "Vitamin C 1000mg",
  "productSlug": "vitamin-c-1000mg",
  "description": "Immune support supplement",
  "imageUrls": ["https://..."],
  "price": 19.99,
  "currency": "USD",
  "featuredRank": 10,
  "waLink": "https://wa.me/15551234567?text=Hi!...",
  "publishedAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## C) Cloud Functions

Implemented in `functions/src/index.ts`:

- `onStoreCreated`
- `onStoreUpdated`
- `onProductCreated`
- `onProductCreatedOrUpdated` (update path)
- `onProductDeleted`
- `rebuildPublicProductsForStore(storeId)` helper

### Visibility formula

A product is visible only when all are true:

- `storeStatus == "active"`
- `eligibleForBuy == true`
- `buyOptOut == false`
- `product.isActive == true`
- `(product.isApproved absent OR product.isApproved == true)`

## D) Firestore Security Rules

- Public read allowed only on `publicProducts`.
- Direct writes to `publicProducts` denied (server-only).
- Store owner (`request.auth.uid == storeId`) can access their own store/products.

## E) Frontend query examples

```ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';

const publicProducts = collection(db, 'publicProducts');

// Home featured products
export async function getFeaturedHomeProducts(pageSize = 20) {
  const q = query(
    publicProducts,
    where('isVisible', '==', true),
    orderBy('featuredRank', 'desc'),
    orderBy('publishedAt', 'desc'),
    limit(pageSize),
  );
  return getDocs(q);
}

// Shop listing with category + pagination
export async function getShopProductsByCategory(categoryKey: string, lastDoc?: any, pageSize = 24) {
  const base = query(
    publicProducts,
    where('isVisible', '==', true),
    where('categoryKey', '==', categoryKey.toLowerCase()),
    orderBy('publishedAt', 'desc'),
    limit(pageSize),
  );

  const q = lastDoc ? query(base, startAfter(lastDoc)) : base;
  return getDocs(q);
}

// Product detail
export async function getProductDetail(storeId: string, productId: string) {
  const id = `${storeId}_${productId}`;
  return getDoc(doc(db, 'publicProducts', id));
}
```

## F) Migration/backfill plan

- Use `scripts/backfill-public-products.ts` (Admin SDK) in three phases:
  1. Dry-run: count stores/products and planned writes/deletes.
  2. Defaults patch: add missing `eligibleForBuy=true`, `buyOptOut=false`.
  3. Rebuild: recalculate every product’s public visibility.

Script is idempotent and safe to rerun.

## G) Test checklist

### Unit
- Visibility matrix (all combinations for store/product flags).
- WhatsApp link generation and number normalization.
- Sanitization allowlist prevents private field leakage.

### Integration (Emulator)
- Creating store auto-writes default flags.
- Updating store status or buy flags updates `publicProducts` docs.
- Product create/update/delete correctly upserts/deletes public docs.
- Security rules: unauthenticated can read `publicProducts` but not `stores`.

### Manual
- Create active store + active product => visible on buy site.
- Toggle `buyOptOut=true` => product disappears from buy site query.
- Restore flags => product returns.

## H) Rollout and rollback

### Safe deployment
1. Deploy Functions first.
2. Deploy indexes (`firestore.indexes.json`).
3. Deploy security rules.
4. Run backfill in dry-run.
5. Run full backfill.
6. Verify sample store/product parity.

### Rollback notes
- If issue appears, temporarily disable buy frontend reads or pin to previous function revision.
- Canonical source docs remain untouched except default flag patching, so rollback risk is low.

## Assumptions

1. Store owner UID equals `storeId`.
2. Products are in subcollections under each store.
3. buy.sedifex.com only needs product-level browse/detail reads.
4. Optional moderation gate uses `isApproved` when present.


## I) Frontend app (Vercel-ready)

A Next.js frontend was added under `frontend/` with:

- Firestore read client for `publicProducts`
- Category filter and pagination UI
- Environment-variable driven Firebase config
- `vercel.json` plus deploy instructions in `frontend/README.md`
