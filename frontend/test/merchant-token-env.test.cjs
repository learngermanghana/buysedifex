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
