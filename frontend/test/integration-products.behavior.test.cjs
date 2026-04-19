const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/sedifex-integration-api.ts')).href;

async function importIntegrationModule() {
  return import(`${moduleUrl}?t=${Date.now()}-${Math.random()}`);
}

function withIntegrationEnv() {
  process.env.SEDIFEX_INTEGRATION_API_BASE_URL = 'https://integration.example.com';
  process.env.SEDIFEX_INTEGRATION_API_KEY = 'test-api-key';
  process.env.SEDIFEX_INTEGRATION_API_VERSION = '2026-04-13';
}

test('listIntegrationProducts sends query params and uses payload hasMore when present', async () => {
  withIntegrationEnv();

  const observed = { url: null, headers: null };

  global.fetch = async (url, options) => {
    observed.url = new URL(String(url));
    observed.headers = options?.headers ?? {};

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          hasMore: true,
          items: [
            {
              id: 'p-1',
              storeId: 'store-1',
              productName: 'Product 1',
              imageUrl: 'https://cdn.example.com/p-1.jpg',
              category: 'beauty',
              storeCity: 'Accra',
            },
          ],
        };
      },
    };
  };

  const { listIntegrationProducts } = await importIntegrationModule();
  const result = await listIntegrationProducts({
    categoryKey: 'beauty',
    page: 2,
    pageSize: 5,
    sort: 'store-diverse',
    maxPerStore: 2,
  });

  assert.equal(observed.url.pathname, '/v1IntegrationProducts');
  assert.equal(observed.url.searchParams.get('categoryKey'), 'beauty');
  assert.equal(observed.url.searchParams.get('page'), '2');
  assert.equal(observed.url.searchParams.get('pageSize'), '5');
  assert.equal(observed.url.searchParams.get('sort'), 'store-diverse');
  assert.equal(observed.url.searchParams.get('maxPerStore'), '2');
  assert.equal(observed.headers['x-api-key'], 'test-api-key');
  assert.equal(observed.headers['X-Sedifex-Contract-Version'], '2026-04-13');

  assert.equal(result.hasMore, true);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].categoryKey, 'beauty');
  assert.equal(result.items[0].city, 'Accra');
});

test('listIntegrationProducts paginates locally when upstream omits hasMore', async () => {
  withIntegrationEnv();

  global.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        items: [
          { id: 'p-1', storeId: 'store-1', productName: 'One', imageUrl: 'https://cdn.example.com/1.jpg' },
          { id: 'p-2', storeId: 'store-1', productName: 'Two', imageUrl: 'https://cdn.example.com/2.jpg' },
          { id: 'p-3', storeId: 'store-2', productName: 'Three', imageUrl: 'https://cdn.example.com/3.jpg' },
          { id: '', storeId: 'store-2', productName: 'invalid', imageUrl: 'https://cdn.example.com/4.jpg' },
        ],
      };
    },
  });

  const { listIntegrationProducts } = await importIntegrationModule();

  const firstPage = await listIntegrationProducts({ page: 1, pageSize: 2 });
  assert.deepEqual(firstPage.items.map((item) => item.id), ['p-1', 'p-2']);
  assert.equal(firstPage.hasMore, true);

  const secondPage = await listIntegrationProducts({ page: 2, pageSize: 2 });
  assert.deepEqual(secondPage.items.map((item) => item.id), ['p-3']);
  assert.equal(secondPage.hasMore, false);
});

test('listIntegrationProducts uses integrationPublicCatalog and public collections when API key is absent', async () => {
  process.env.SEDIFEX_INTEGRATION_API_BASE_URL = 'https://integration.example.com';
  delete process.env.SEDIFEX_INTEGRATION_API_KEY;
  process.env.SEDIFEX_INTEGRATION_API_VERSION = '2026-04-13';

  const observed = { url: null, headers: null };

  global.fetch = async (url, options) => {
    observed.url = new URL(String(url));
    observed.headers = options?.headers ?? {};

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          storeId: 'store-1',
          products: [
            { id: 'fallback-1', storeId: 'store-1', productName: 'Fallback', imageUrl: 'https://cdn.example.com/fallback.jpg' },
          ],
          publicProducts: [
            { id: 'p-1', storeId: 'store-1', productName: 'Public Product', imageUrl: 'https://cdn.example.com/p-1.jpg' },
          ],
          publicServices: [
            { id: 's-1', storeId: 'store-1', productName: 'Public Service', imageUrl: 'https://cdn.example.com/s-1.jpg' },
          ],
        };
      },
    };
  };

  const { listIntegrationProducts } = await importIntegrationModule();
  const result = await listIntegrationProducts({ storeId: 'store-1' });

  assert.equal(observed.url.pathname, '/integrationPublicCatalog');
  assert.equal(observed.url.searchParams.get('storeId'), 'store-1');
  assert.equal(observed.headers['x-api-key'], undefined);
  assert.deepEqual(
    result.items.map((item) => item.id),
    ['p-1', 's-1'],
  );
  assert.equal(result.hasMore, false);
});
