const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('merchant token lookup prefers JSON map then falls back to legacy env key', () => {
  const source = read('src/lib/sedifex-checkout.ts');
  assert.match(source, /process\.env\.SEDIFEX_MERCHANT_TOKENS_JSON\?\.trim\(\)/);
  assert.match(source, /JSON\.parse\(raw\)/);
  assert.match(source, /getMerchantTokensJsonMap\(\)\[normalizedMerchantId\]/);
  assert.match(source, /return getRequiredEnv\(`SEDIFEX_MERCHANT_TOKEN_\$\{normalizedMerchantId\}`\)/);
});

test('checkout preview and create both use getMerchantToken helper', () => {
  const source = read('src/lib/sedifex-checkout.ts');
  const matches = source.match(/const merchantToken = getMerchantToken\(normalizedMerchantId\);/g) ?? [];
  assert.equal(matches.length, 2);
});

test('checkout routing reads stores payment routing before storeSettings fallback', () => {
  const source = read('src/app/api/integration/checkout/create/route.ts');
  assert.match(source, /Promise\.all\(\[/);
  assert.match(source, /getDoc\(doc\(db, 'stores', merchantId\)\)\.catch\(\(\) => null\)/);
  assert.match(source, /getDoc\(doc\(db, 'storeSettings', merchantId\)\)\.catch\(\(\) => null\)/);
  assert.match(source, /const routing = routingFromStore \?\? routingFromSettings;/);
  assert.match(source, /cleanText\(storeData\.paystackSubaccountCode, 120\) \|\|\n\s*cleanText\(settingsData\.paystackSubaccountCode, 120\)/);
});

test('marketplace checkout uses gross-up customer processing fee and top-level Paystack split fields', () => {
  const source = read('src/lib/sedifex-checkout.ts');
  assert.match(source, /const calculateCustomerProcessingFeeMinor = \(baseTotalMinor: number, feePercent: number\) =>/);
  assert.match(source, /Math\.ceil\(baseTotalMinor \/ \(1 - rate\)\) - baseTotalMinor/);
  assert.match(source, /const customerProcessingFeeMinor = calculateCustomerProcessingFeeMinor\(\n\s*baseTotalMinor,\n\s*customerProcessingFeePercent,\n\s*\);/);
  assert.match(source, /bearer: 'subaccount',\n\s*transaction_charge: typeof sedifexCommissionMinor === 'number' \? sedifexCommissionMinor : undefined,\n\s*transactionChargeMinor: typeof sedifexCommissionMinor === 'number' \? sedifexCommissionMinor : null,/);
  assert.match(source, /transaction_charge: typeof sedifexCommissionMinor === 'number' \? sedifexCommissionMinor : null,\n\s*bearer: 'subaccount'/);
});
