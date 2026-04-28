const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('listing page has core rendering blocks', () => {
  const source = read('src/app/page.tsx');
  assert.match(source, /Discover trusted local stores near you/);
  assert.match(source, /<ProductGrid\s*\/?>/);
  assert.match(source, /href="\/search"/);
  assert.match(source, /href="\/about"/);
  assert.match(source, /href="\/sell"/);
  assert.match(source, /href="\/contact"/);
});

test('product detail page renders key detail sections', () => {
  const source = read('src/app/products/[productId]/page.tsx');
  assert.match(source, /Product details/);
  assert.match(source, /Store information/);
  assert.match(source, /View store details/);
  assert.match(source, /Visit store website/);
  assert.match(source, /ProductLeadPanel/);
  assert.match(source, /Availability:/);
  assert.match(source, /alternates: \{ canonical: canonicalUrl \}/);
});

test('store page renders profile and product listing sections', () => {
  const source = read('src/app/stores/[storeId]/page.tsx');
  assert.match(source, /<p className="eyebrow">Store<\/p>/);
  assert.match(source, /(Products from|Products &amp; Services from|Active listings from) \{profile\.storeName\}/);
  assert.match(source, /Store categories/);
  assert.match(source, /alternates: \{ canonical: canonicalUrl \}/);
});

test('sitemap and robots routes are present for SEO', () => {
  const sitemapSource = read('src/app/sitemap.ts');
  const robotsSource = read('src/app/robots.ts');

  assert.match(sitemapSource, /MetadataRoute\.Sitemap/);
  assert.match(sitemapSource, /canonicalUrlForPath\('\/about'\)/);
  assert.match(sitemapSource, /canonicalUrlForPath\('\/search'\)/);
  assert.match(sitemapSource, /canonicalUrlForPath\('\/privacy'\)/);
  assert.match(sitemapSource, /canonicalUrlForPath\('\/terms'\)/);
  assert.match(robotsSource, /MetadataRoute\.Robots/);
  assert.match(robotsSource, /sitemap: canonicalUrlForPath\('\/sitemap\.xml'\)/);
});


test('info and legal routes exist', () => {
  const aboutSource = read('src/app/about/page.tsx');
  const sellSource = read('src/app/sell/page.tsx');
  const contactSource = read('src/app/contact/page.tsx');
  const privacySource = read('src/app/privacy/page.tsx');
  const termsSource = read('src/app/terms/page.tsx');
  const shippingSource = read('src/app/shipping-delivery-policy/page.tsx');

  assert.match(aboutSource, /How Sedifex works/);
  assert.match(sellSource, /Sell on Sedifex/);
  assert.match(contactSource, /info@sedifex\.com/);
  assert.match(contactSource, /\+233205706589/);
  assert.match(privacySource, /Privacy Policy/);
  assert.match(termsSource, /Terms of Service/);
  assert.match(shippingSource, /Shipping and Delivery Policy/);
});
