const test = require('node:test');
const assert = require('node:assert/strict');

const mod = require('../lib/index.js');
const t = mod.__testing;

test('visibility matrix: visible path', () => {
  const store = t.withStoreDefaults({ storeStatus: 'active', eligibleForBuy: true, buyOptOut: false });
  assert.equal(t.computeVisibility(store, { itemType: 'product', name: 'Sample' }), true);
});

test('visibility matrix: inactive/opt-out/itemType hidden', () => {
  const inactive = t.withStoreDefaults({ storeStatus: 'inactive', eligibleForBuy: true, buyOptOut: false });
  assert.equal(t.computeVisibility(inactive, { itemType: 'product', name: 'Sample' }), false);

  const optOut = t.withStoreDefaults({ storeStatus: 'active', eligibleForBuy: true, buyOptOut: true });
  assert.equal(t.computeVisibility(optOut, { itemType: 'product', name: 'Sample' }), false);

  const active = t.withStoreDefaults({ storeStatus: 'active', eligibleForBuy: true, buyOptOut: false });
  assert.equal(t.computeVisibility(active, { itemType: 'bundle', name: 'Sample' }), false);
});

test('WhatsApp link normalization', () => {
  const link = t.buildWhatsAppLink({
    phone: ' +233 (55) 123-4567 ',
    storeName: 'Demo Store',
    productName: 'Rice',
    productId: 'prod-1',
    storeId: 'store-1',
  });

  assert.ok(link.includes('https://wa.me/233551234567'));
  assert.equal(
    t.buildWhatsAppLink({ phone: '  ', storeName: 'S', productName: 'P', productId: 'p', storeId: 's' }),
    null,
  );
});

test('upsert/delete sync behavior', async () => {
  let deleted = 0;
  let setCalls = 0;
  mod.__setDbForTests({
    collection: () => ({
      doc: () => ({
        delete: async () => { deleted += 1; },
        set: async () => { setCalls += 1; },
      }),
    }),
  });

  await t.upsertOrDeletePublicProduct({
    storeId: 's1',
    productId: 'p1',
    store: { storeStatus: 'inactive', eligibleForBuy: true, buyOptOut: false },
    product: { name: 'Rice', itemType: 'product' },
  });

  await t.upsertOrDeletePublicProduct({
    storeId: 's1',
    productId: 'p2',
    store: { storeStatus: 'active', eligibleForBuy: true, buyOptOut: false, name: 'Store', phone: '+233201111111' },
    product: { name: 'Rice', itemType: 'product' },
  });

  assert.equal(deleted, 1);
  assert.equal(setCalls, 1);
});
