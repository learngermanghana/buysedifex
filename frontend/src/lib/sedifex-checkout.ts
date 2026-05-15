import crypto from 'node:crypto';

export type CheckoutItem = {
  productId: string;
  quantity: number;
  merchantId: string;
  type?: 'PRODUCT' | 'SERVICE';
};

export type MerchantCheckoutPreview = {
  merchantId: string;
  preview: unknown;
};

export type MerchantCheckoutInit = {
  merchantId: string;
  reference: string;
  checkoutUrl?: string;
  bookingId: string;
  pricingSnapshot: SedifexCheckoutPreviewResponse;
};

export type SedifexCheckoutPreviewRequest = {
  store_id: string;
  merchant_id?: string;
  storeId?: string;
  merchantId?: string;
  currency?: string;
  fulfillment_type?: 'PICKUP' | 'DELIVERY';
  delivery_address_id?: string | null;
  items: Array<{ type: 'PRODUCT' | 'SERVICE'; item_id: string; qty: number }>;
};

export type SedifexCheckoutPreviewResponse = {
  pricing_version?: string;
  subtotal?: number;
  tax_total?: number;
  delivery_fee?: number;
  pre_processing_total?: number;
  processing_fee_to_add?: number;
  final_total?: number;
  breakdown?: Array<{ code: string; amount: number }>;
  [key: string]: unknown;
};

const getRequiredEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

const getMerchantTokensJsonMap = (): Record<string, string> => {
  const raw = process.env.SEDIFEX_MERCHANT_TOKENS_JSON?.trim();
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('SEDIFEX_MERCHANT_TOKENS_JSON must be valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('SEDIFEX_MERCHANT_TOKENS_JSON must be a JSON object mapping merchantId to token.');
  }

  const map: Record<string, string> = {};
  for (const [merchantId, token] of Object.entries(parsed)) {
    if (typeof token === 'string' && token.trim()) {
      map[merchantId] = token.trim();
    }
  }
  return map;
};

const getContractVersion = () => process.env.SEDIFEX_INTEGRATION_API_VERSION ?? '2026-04-13';

const getIntegrationApiBaseUrl = () => {
  const rawBaseUrl = getRequiredEnv('SEDIFEX_INTEGRATION_API_BASE_URL').trim();

  let parsed: URL;
  try {
    parsed = new URL(rawBaseUrl);
  } catch {
    throw new Error(
      'SEDIFEX_INTEGRATION_API_BASE_URL must be an absolute URL (for example: https://api.example.com).',
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('SEDIFEX_INTEGRATION_API_BASE_URL must use http or https protocol.');
  }

  return parsed.toString().replace(/\/$/, '');
};

const integrationFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const baseUrl = getIntegrationApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Sedifex-Contract-Version': getContractVersion(),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Sedifex request failed (${response.status}) for ${path}: ${body}`);
  }

  return (await response.json()) as T;
};

export const groupCartByMerchant = (items: CheckoutItem[]) => {
  const grouped = new Map<string, CheckoutItem[]>();
  for (const item of items) {
    const merchantId = item.merchantId.trim();
    if (!merchantId) {
      throw new Error(`Cart item ${item.productId} is missing merchantId/storeId. Each cart item merchantId must match your Sedifex store ID.`);
    }
    const next = grouped.get(merchantId) ?? [];
    next.push(item);
    grouped.set(merchantId, next);
  }
  return grouped;
};

export const createCheckoutReference = (merchantId: string) =>
  `${merchantId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

const normalizeMerchantId = (merchantId: string) => {
  const normalized = merchantId.trim();
  if (!normalized) {
    throw new Error('Checkout merchantId/store_id is missing. Ensure the product merchantId matches a Sedifex store ID.');
  }
  return normalized;
};

export const getMerchantToken = (merchantId: string) => {
  const normalizedMerchantId = normalizeMerchantId(merchantId);
  const tokenFromJson = getMerchantTokensJsonMap()[normalizedMerchantId];
  if (tokenFromJson) return tokenFromJson;
  return getRequiredEnv(`SEDIFEX_MERCHANT_TOKEN_${normalizedMerchantId}`);
};

export const previewMerchantCheckout = async (merchantId: string, items: CheckoutItem[]) => {
  const normalizedMerchantId = normalizeMerchantId(merchantId);
  const merchantToken = getMerchantToken(normalizedMerchantId);
  const payload: SedifexCheckoutPreviewRequest = {
    store_id: normalizedMerchantId,
    merchant_id: normalizedMerchantId,
    storeId: normalizedMerchantId,
    merchantId: normalizedMerchantId,
    fulfillment_type: 'PICKUP',
    delivery_address_id: null,
    items: items.map((item) => ({ type: item.type ?? 'PRODUCT', item_id: item.productId, qty: item.quantity })),
  };
  return integrationFetch<SedifexCheckoutPreviewResponse>('/integration/checkout/preview', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${merchantToken}`,
      'x-api-key': merchantToken,
    },
    body: JSON.stringify(payload),
  });
};

export const createMerchantCheckout = async (
  merchantId: string,
  items: CheckoutItem[],
  reference: string,
  pricingSnapshot?: SedifexCheckoutPreviewResponse,
  customer?: { email?: string; phone?: string },
) => {
  const normalizedMerchantId = normalizeMerchantId(merchantId);
  const merchantToken = getMerchantToken(normalizedMerchantId);
  return integrationFetch<unknown>('/integration/checkout/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${merchantToken}`,
      'x-api-key': merchantToken,
    },
    body: JSON.stringify({
      store_id: normalizedMerchantId,
      merchant_id: normalizedMerchantId,
      storeId: normalizedMerchantId,
      merchantId: normalizedMerchantId,
      payment_reference: reference,
      client_order_id: reference,
      items: items.map((item) => ({ type: item.type ?? 'PRODUCT', item_id: item.productId, qty: item.quantity })),
      pricing_snapshot: pricingSnapshot,
      customer: customer
        ? {
            email: customer.email,
            phone: customer.phone,
          }
        : undefined,
      payment_status: 'pending',
      order_status: 'pending',
      returnUrl: process.env.SEDIFEX_CHECKOUT_RETURN_URL,
    }),
  });
};

export const verifyWebhookSignature = (rawBody: string, signatureHeader: string | null) => {
  const secret = getRequiredEnv('SEDIFEX_WEBHOOK_SECRET');
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
  } catch {
    return false;
  }
};
