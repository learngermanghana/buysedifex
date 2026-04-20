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

test('listIntegrationProducts uses integrationPublicCatalog when API key is absent and no storeId is provided', async () => {
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
  const result = await listIntegrationProducts({ promoSlug: 'store-1' });

  assert.equal(observed.url.pathname, '/integrationPublicCatalog');
  assert.equal(observed.url.searchParams.get('slug'), 'store-1');
  assert.equal(observed.headers['x-api-key'], undefined);
  assert.deepEqual(
    result.items.map((item) => item.id),
    ['p-1', 's-1'],
  );
  assert.equal(result.hasMore, false);
});

test('listIntegrationProducts uses /stores/{id}, /publicProducts/{id}, and /publicServices/{id} for verified stores', async () => {
  process.env.SEDIFEX_INTEGRATION_API_BASE_URL = 'https://integration.example.com';
  delete process.env.SEDIFEX_INTEGRATION_API_KEY;
  process.env.SEDIFEX_INTEGRATION_API_VERSION = '2026-04-13';

  const calledPaths = [];

  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    calledPaths.push(parsed.pathname);

    if (parsed.pathname === '/stores/store-verified') {
      return {
        ok: true,
        status: 200,
        async json() {
          return { storeId: 'store-verified', verified: true };
        },
      };
    }

    if (parsed.pathname === '/publicProducts/store-verified') {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            items: [
              {
                id: 'p-verified',
                storeId: 'store-verified',
                productName: 'Verified Product',
                imageUrl: 'https://cdn.example.com/verified-product.jpg',
              },
            ],
          };
        },
      };
    }

    if (parsed.pathname === '/publicServices/store-verified') {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            items: [
              {
                id: 's-verified',
                storeId: 'store-verified',
                productName: 'Verified Service',
                imageUrl: 'https://cdn.example.com/verified-service.jpg',
              },
            ],
          };
        },
      };
    }

    return {
      ok: false,
      status: 404,
      async json() {
        return {};
      },
    };
  };

  const { listIntegrationProducts } = await importIntegrationModule();
  const result = await listIntegrationProducts({ storeId: 'store-verified' });

  assert.deepEqual(calledPaths, [
    '/stores/store-verified',
    '/publicProducts/store-verified',
    '/publicServices/store-verified',
  ]);
  assert.deepEqual(
    result.items.map((item) => ({ id: item.id, itemType: item.itemType })),
    [
      { id: 'p-verified', itemType: 'product' },
      { id: 's-verified', itemType: 'service' },
    ],
  );
});

test('listIntegrationProducts returns no items when store is not verified', async () => {
  process.env.SEDIFEX_INTEGRATION_API_BASE_URL = 'https://integration.example.com';
  delete process.env.SEDIFEX_INTEGRATION_API_KEY;
  process.env.SEDIFEX_INTEGRATION_API_VERSION = '2026-04-13';

  const calledPaths = [];

  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    calledPaths.push(parsed.pathname);

    if (parsed.pathname === '/stores/store-unverified') {
      return {
        ok: true,
        status: 200,
        async json() {
          return { storeId: 'store-unverified', verified: false };
        },
      };
    }

    return {
      ok: true,
      status: 200,
      async json() {
        return { items: [] };
      },
    };
  };

  const { listIntegrationProducts } = await importIntegrationModule();
  const result = await listIntegrationProducts({ storeId: 'store-unverified' });

  assert.deepEqual(calledPaths, ['/stores/store-unverified']);
  assert.equal(result.items.length, 0);
  assert.equal(result.hasMore, false);
});
