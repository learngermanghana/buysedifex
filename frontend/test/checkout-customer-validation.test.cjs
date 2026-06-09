const test = require('node:test');
const assert = require('node:assert/strict');

async function validation() {
  return import('../src/lib/checkout-customer-validation.ts');
}

test('checkout customer validation accepts useful customer details and normalizes them', async () => {
  const { validateCheckoutCustomer } = await validation();
  const result = validateCheckoutCustomer({
    name: '  Ama   Mensah ',
    email: ' AMA@EXAMPLE.COM ',
    phone: '+233 (24) 123-4567',
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.customer, {
    name: 'Ama Mensah',
    email: 'ama@example.com',
    phone: '+233241234567',
  });
});

test('checkout customer validation rejects obvious junk details', async () => {
  const { validateCheckoutCustomer } = await validation();
  const result = validateCheckoutCustomer({
    name: 'tis jhhfgxfhgjhg',
    email: 'fdhgfghjf@ghj',
    phone: '123456787654',
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.name, /real full name/i);
  assert.match(result.errors.email, /valid email/i);
  assert.match(result.errors.phone, /valid Ghana number/i);
});

test('checkout customer validation accepts Ghana local phone numbers', async () => {
  const { validateCheckoutCustomer } = await validation();
  const result = validateCheckoutCustomer({ name: 'Kojo Asare', email: 'kojo@example.com', phone: '024 123 4567' });

  assert.equal(result.valid, true);
  assert.equal(result.customer.phone, '0241234567');
});
