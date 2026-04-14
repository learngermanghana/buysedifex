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

test('product cards include share action using built product url', () => {
  const gridSource = read('src/components/product-grid.tsx');

  assert.match(gridSource, /const buildShareData = \(item: PublicProduct\) =>/);
  assert.match(gridSource, /const href = getProductHref\(item\.id, item\.productName\)/);
  assert.match(gridSource, /navigator\.share/);
  assert.match(gridSource, /navigator\.clipboard\?\.writeText/);
  assert.match(gridSource, /Share product/);
});
