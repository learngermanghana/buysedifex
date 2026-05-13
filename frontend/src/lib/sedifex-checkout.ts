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
  merchant_id: string;
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

const getContractVersion = () => process.env.SEDIFEX_INTEGRATION_API_VERSION ?? '2026-04-13';

const integrationFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const baseUrl = getRequiredEnv('SEDIFEX_INTEGRATION_API_BASE_URL').replace(/\/$/, '');
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
    const next = grouped.get(merchantId) ?? [];
    next.push(item);
    grouped.set(merchantId, next);
  }
  return grouped;
};

export const createCheckoutReference = (merchantId: string) =>
  `${merchantId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

export const previewMerchantCheckout = async (merchantId: string, items: CheckoutItem[]) => {
  const merchantToken = getRequiredEnv(`SEDIFEX_MERCHANT_TOKEN_${merchantId}`);
  const payload: SedifexCheckoutPreviewRequest = {
    merchant_id: merchantId,
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
) => {
  const merchantToken = getRequiredEnv(`SEDIFEX_MERCHANT_TOKEN_${merchantId}`);
  return integrationFetch<unknown>('/integration/checkout/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${merchantToken}`,
      'x-api-key': merchantToken,
    },
    body: JSON.stringify({
      merchant_id: merchantId,
      payment_reference: reference,
      client_order_id: reference,
      items: items.map((item) => ({ type: item.type ?? 'PRODUCT', item_id: item.productId, qty: item.quantity })),
      pricing_snapshot: pricingSnapshot,
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
