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
  assert.match(gridSource, /Share product/);
  assert.match(gridSource, /navigator\.share/);
  assert.match(productPageSource, /extractProductIdFromRouteParam\(params\.productId\)/);
  assert.match(productPageSource, /canonicalUrlForPath\(getProductHref\(product\.id, product\.productName\)\)/);
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

test('store and product APIs read from Sedifex integration endpoints', () => {
  const storesSource = read('src/lib/public-stores.ts');
  const productsSource = read('src/lib/public-products.ts');
  const integrationClientSource = read('src/lib/sedifex-integration-api.ts');
  const integrationProductsRouteSource = read('src/app/api/integration/products/route.ts');
  const productGridSource = read('src/components/product-grid.tsx');

  assert.match(storesSource, /getIntegrationStoreProfile/);
  assert.match(productsSource, /getIntegrationProductById/);
  assert.match(integrationClientSource, /SEDIFEX_INTEGRATION_API_BASE_URL/);
  assert.match(integrationClientSource, /SEDIFEX_INTEGRATION_API_VERSION/);
  assert.match(integrationProductsRouteSource, /sort: params\.get\('sort'\) \?\? 'store-diverse'/);
  assert.match(integrationProductsRouteSource, /maxPerStore/);
  assert.doesNotMatch(integrationProductsRouteSource, /storeId:/);
  assert.match(productGridSource, /useState<SortOption>\('store-diverse'\)/);

  assert.match(integrationClientSource, /listIntegrationProducts/);
  assert.match(integrationClientSource, /integrationFetch<IntegrationProductsPayload>/);
  assert.match(integrationClientSource, /'\/v1IntegrationProducts'/);
  assert.match(integrationClientSource, /normalizeProduct/);
  assert.match(integrationClientSource, /categoryKey: cleanString\(product\.categoryKey\) \?\? cleanString\(product\.category\)/);
  assert.match(integrationClientSource, /'\/v1IntegrationPromo'/);
  assert.match(integrationClientSource, /normalizePromoPayload/);
  assert.match(integrationClientSource, /listIntegrationStoreIds\(\)/);
  assert.doesNotMatch(integrationClientSource, /`\/stores\/\$\{encodeURIComponent\(normalizedStoreId\)\}`/);
  assert.doesNotMatch(integrationClientSource, /SEDIFEX_PUBLIC_API_BASE_URL/);
  assert.doesNotMatch(integrationClientSource, /buildPublicEndpoint/);
  assert.doesNotMatch(integrationClientSource, /'\/v1\/products'/);
  assert.match(productGridSource, /const nextItems = body\.items \?\? \[\];/);
  assert.match(productGridSource, /src=\{item\.imageUrls\?\.\[0\] \?\? 'https:\/\/placehold\.co\/640x640'\}/);
  assert.doesNotMatch(productGridSource, /hasDisplayImage\(item\) && isVerifiedStore\(item\.verified\)/);
  assert.match(productGridSource, /<option value="store-diverse">Mixed stores<\/option>/);
});


test('concerns API route exists for secure concern submissions', () => {
  const concernsRouteSource = read('src/app/api/concerns/route.ts');

  assert.match(concernsRouteSource, /collection\(db, 'concerns'\)/);
  assert.match(concernsRouteSource, /Concern reporting is not configured/);
  assert.match(concernsRouteSource, /Invalid concern payload/);
});
