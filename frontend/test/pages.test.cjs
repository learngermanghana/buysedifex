const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('listing page has core rendering blocks', () => {
  const source = read('src/app/page.tsx');
  assert.match(source, /Shop clean, curated collections/);
  assert.match(source, /<ProductGrid\s*\/?>/);
});

test('product detail page renders key detail sections', () => {
  const source = read('src/app/products/[productId]/page.tsx');
  assert.match(source, /Product details/);
  assert.match(source, /Visit store page/);
  assert.match(source, /Availability:/);
  assert.match(source, /alternates: \{ canonical: canonicalUrl \}/);
});

test('store page renders profile and product listing sections', () => {
  const source = read('src/app/stores/[storeId]/page.tsx');
  assert.match(source, /<p className="eyebrow">Store<\/p>/);
  assert.match(source, /Products from \{profile\.storeName\}/);
  assert.match(source, /Store categories/);
  assert.match(source, /alternates: \{ canonical: canonicalUrl \}/);
});

test('sitemap and robots routes are present for SEO', () => {
  const sitemapSource = read('src/app/sitemap.ts');
  const robotsSource = read('src/app/robots.ts');

  assert.match(sitemapSource, /MetadataRoute\.Sitemap/);
  assert.match(robotsSource, /MetadataRoute\.Robots/);
  assert.match(robotsSource, /sitemap: canonicalUrlForPath\('\/sitemap\.xml'\)/);
});
