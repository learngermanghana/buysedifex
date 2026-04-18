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
  assert.doesNotMatch(gridSource, /Share product/);
  assert.match(productPageSource, /label="Share product"/);
  assert.match(productPageSource, /ShareButton/);
  assert.match(productPageSource, /extractProductIdFromRouteParam\(params\.productId\)/);
  assert.match(productPageSource, /canonicalUrlForPath\(getProductHref\(product\.id, product\.productName\)\)/);
});

test('store routes support slug + id links and id extraction', () => {
  const storeRouteSource = read('src/lib/store-route.ts');
  const storePageSource = read('src/app/stores/[storeId]/page.tsx');
  const promoSource = read('src/components/promo-carousel.tsx');

  assert.match(storeRouteSource, /getStoreRouteId/);
  assert.match(storeRouteSource, /getStoreHref/);
  assert.match(storeRouteSource, /return `\/stores\/\$\{encodeURIComponent\(routeId\)\}`/);
  assert.match(storePageSource, /extractStoreIdFromRouteParam\(params\.storeId\)/);
  assert.match(promoSource, /const getStorePath = \(promo: StorePromo\) =>/);
  assert.match(promoSource, /return `\/stores\/\$\{encodeURIComponent\(slug\)\}`/);
});

test('store and product APIs read from Sedifex integration endpoints', () => {
  const storesSource = read('src/lib/public-stores.ts');
  const productsSource = read('src/lib/public-products.ts');
  const integrationClientSource = read('src/lib/sedifex-integration-api.ts');
  const productGridSource = read('src/components/product-grid.tsx');

  assert.match(storesSource, /runPublicProductsQuery/);
  assert.match(storesSource, /firestore\.googleapis\.com/);
  assert.match(storesSource, /getStoreProfileById/);
  assert.match(productsSource, /getPublicProductById/);
  assert.match(integrationClientSource, /listIntegrationProducts/);
  assert.match(productGridSource, /const getDisplayImages = \(item: PublicProduct\): string\[] =>/);
  assert.match(productGridSource, /src=\{getDisplayImages\(item\)\[0\] \?\? 'https:\/\/placehold\.co\/640x640'\}/);
});


test('concerns API route exists for secure concern submissions', () => {
  const concernsRouteSource = read('src/app/api/concerns/route.ts');

  assert.match(concernsRouteSource, /collection\(db, 'concerns'\)/);
  assert.match(concernsRouteSource, /Concern reporting is not configured/);
  assert.match(concernsRouteSource, /Invalid concern payload/);
});

test('google merchant rss feed route builds XML feed items from integration products', () => {
  const merchantFeedRouteSource = read('src/app/api/feeds/google-merchant-rss/route.ts');

  assert.match(merchantFeedRouteSource, /xmlns:g="http:\/\/base\.google\.com\/ns\/1\.0"/);
  assert.match(merchantFeedRouteSource, /listIntegrationProducts/);
  assert.match(merchantFeedRouteSource, /const storeId = extractStoreId\(searchParams\.get\('storeId'\)\)/);
  assert.match(merchantFeedRouteSource, /storeId,/);
  assert.match(merchantFeedRouteSource, /getProductHref\(item\.id, item\.productName\)/);
  assert.match(merchantFeedRouteSource, /canonicalUrlForPath\(getProductHref\(item\.id, item\.productName\)\)/);
  assert.match(merchantFeedRouteSource, /Content-Type': 'application\/xml; charset=utf-8'/);
});
