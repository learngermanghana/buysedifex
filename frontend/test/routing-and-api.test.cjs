const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('product routes support slug + id links and id extraction', () => {
  const productRouteSource = read('src/lib/product-route.ts');
  const gridSource = read('src/components/product-grid.tsx');
  const productPageSource = read('src/app/products/[productId]/page.tsx');

  assert.match(productRouteSource, /PRODUCT_ROUTE_SEPARATOR = '--'/);
  assert.match(productRouteSource, /getProductRouteParam/);
  assert.match(productRouteSource, /extractProductIdFromRouteParam/);
  assert.match(productRouteSource, /getProductHref/);
  assert.match(gridSource, /getProductHref\(item\.id, item\.productName\)/);
  assert.match(productPageSource, /extractProductIdFromRouteParam\(params\.productId\)/);
});

test('store routes support slug + id links and id extraction', () => {
  const storeRouteSource = read('src/lib/store-route.ts');
  const storePageSource = read('src/app/stores/[storeId]/page.tsx');
  const promoSource = read('src/components/promo-carousel.tsx');

  assert.match(storeRouteSource, /STORE_ROUTE_SEPARATOR = '--'/);
  assert.match(storeRouteSource, /extractStoreIdFromRouteParam/);
  assert.match(storeRouteSource, /getStoreRouteParam/);
  assert.match(storePageSource, /extractStoreIdFromRouteParam\(params\.storeId\)/);
  assert.match(promoSource, /getStoreHref\(promo\.storeId \?\? promo\.id, promo\.storeName, promo\.storeSlug\)/);
});

test('store API lookup includes slug fallback query on stores collection', () => {
  const storesSource = read('src/lib/public-stores.ts');

  assert.match(storesSource, /from: \[\{ collectionId: 'stores' \}\]/);
  assert.match(storesSource, /readStoreDocumentByField\('storeSlug', normalizedStoreId\)/);
  assert.match(storesSource, /readStoreDocumentByField\('slug', normalizedStoreId\)/);
});
