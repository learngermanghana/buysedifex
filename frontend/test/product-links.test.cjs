const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('product links are built from slug+id helper and parsed on product page', () => {
  const routeSource = read('src/lib/product-route.ts');
  const gridSource = read('src/components/product-grid.tsx');
  const productPageSource = read('src/app/products/[productId]/page.tsx');

  assert.match(routeSource, /PRODUCT_ROUTE_SEPARATOR = '--'/);
  assert.match(routeSource, /getProductRouteParam/);
  assert.match(routeSource, /extractProductIdFromRouteParam/);
  assert.match(routeSource, /return `\$\{slug\}\$\{PRODUCT_ROUTE_SEPARATOR\}\$\{normalizedProductId\}`/);
  assert.match(routeSource, /getProductHref/);

  assert.match(gridSource, /Link href=\{getProductHref\(item\.id, item\.productName\)\}/);
  assert.match(productPageSource, /extractProductIdFromRouteParam\(params\.productId\)/);
});

test('share action is handled on detail pages instead of product cards', () => {
  const gridSource = read('src/components/product-grid.tsx');
  const productPageSource = read('src/app/products/[productId]/page.tsx');
  const storePageSource = read('src/app/stores/[storeId]/page.tsx');
  const shareButtonSource = read('src/components/share-button.tsx');

  assert.doesNotMatch(gridSource, /Share product/);
  assert.match(productPageSource, /label="Share product"/);
  assert.match(storePageSource, /label="Share store"/);
  assert.match(shareButtonSource, /navigator\.share/);
  assert.match(shareButtonSource, /navigator\.clipboard\?\.writeText/);
});
