import crypto from 'node:crypto';

export type CheckoutItem = {
  productId: string;
  quantity: number;
  merchantId: string;
  type?: 'PRODUCT' | 'SERVICE';
};

export type MerchantPaymentRouting = {
  provider?: string;
  settlementMode?: string;
  paystackSubaccountCode?: string | null;
  subaccountCode?: string | null;
  percentageCharge?: number | null;
  commissionControlledBy?: string | null;
  status?: string | null;
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

type SedifexCheckoutItem = {
  type: 'PRODUCT' | 'SERVICE';
  item_type: 'product' | 'service';
  item_id: string;
  qty: number;
};

export type SedifexCheckoutPreviewRequest = {
  store_id: string;
  merchant_id?: string;
  storeId?: string;
  merchantId?: string;
  currency?: string;
  fulfillment_type?: 'PICKUP' | 'DELIVERY';
  delivery_address_id?: string | null;
  items: SedifexCheckoutItem[];
};

export type SedifexCheckoutPreviewResponse = {
  pricing_version?: string;
  currency?: string;
  subtotal?: number;
  tax_total?: number;
  delivery_fee?: number;
  pre_processing_total?: number;
  processing_fee_to_add?: number;
  final_total?: number;
  breakdown?: Array<{ code: string; amount: number }>;
  marketplaceFees?: MarketplaceFeeBreakdown;
  marketplace_fees?: MarketplaceFeeBreakdown;
  [key: string]: unknown;
};

export type MarketplaceFeeBreakdown = {
  currency: string;
  baseTotalMinor: number;
  customerProcessingFeePercent: number;
  customerProcessingFeeMinor: number;
  customerFinalTotalMinor: number;
  sedifexCommissionPercent: number;
  sedifexCommissionMinor: number;
  estimatedMerchantGrossMinor: number;
  estimatedMerchantNetMinor: number;
  customerPaysProcessingFee: boolean;
  merchantPaysCommission: boolean;
  itemType: 'product' | 'service';
};

const getRequiredEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

const getOptionalNumberEnv = (key: string, fallback: number) => {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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

const normalizeAbsoluteUrl = (key: string, rawUrl: string) => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(`${key} must be an absolute URL.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${key} must use http or https protocol.`);
  }

  return parsed.toString().replace(/\/$/, '');
};

const getIntegrationApiBaseUrl = () => normalizeAbsoluteUrl('SEDIFEX_INTEGRATION_API_BASE_URL', getRequiredEnv('SEDIFEX_INTEGRATION_API_BASE_URL'));

const getCheckoutCreateUrl = () => {
  const directUrl = process.env.SEDIFEX_INTEGRATION_CHECKOUT_CREATE_URL?.trim();
  if (directUrl) return normalizeAbsoluteUrl('SEDIFEX_INTEGRATION_CHECKOUT_CREATE_URL', directUrl);
  return `${getIntegrationApiBaseUrl()}/integration/checkout/create`;
};

const integrationFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const baseUrl = getIntegrationApiBaseUrl();
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
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

const checkoutCreateFetch = async <T>(init?: RequestInit): Promise<T> => {
  const url = getCheckoutCreateUrl();
  const response = await fetch(url, {
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
    throw new Error(`Sedifex request failed (${response.status}) for checkout create: ${body}`);
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

const normalizeCheckoutQuantity = (quantity: number) => {
  const normalizedQuantity = Math.floor(Number(quantity));
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    throw new Error('Checkout quantity must be a positive whole number.');
  }
  return normalizedQuantity;
};

const normalizeCheckoutItemType = (type?: CheckoutItem['type']) => {
  const normalizedType = type === 'SERVICE' ? 'SERVICE' : 'PRODUCT';
  return {
    contractType: normalizedType,
    backendItemType: normalizedType === 'SERVICE' ? 'service' : 'product',
  } as const;
};

const cartContainsService = (items: CheckoutItem[]) => items.some((item) => normalizeCheckoutItemType(item.type).backendItemType === 'service');

const normalizeCheckoutItemId = (item: CheckoutItem) => {
  const rawItemId = item.productId.trim();
  const merchantId = item.merchantId.trim();
  if (!rawItemId) {
    throw new Error('Checkout item_id is missing. Ensure marketplace products keep their original Sedifex sourceProductId.');
  }

  const merchantPrefix = `${merchantId}_`;
  if (merchantId && rawItemId.startsWith(merchantPrefix)) {
    return rawItemId.slice(merchantPrefix.length);
  }

  return rawItemId;
};

const toSedifexCheckoutItem = (item: CheckoutItem): SedifexCheckoutItem => {
  const itemId = normalizeCheckoutItemId(item);
  const itemType = normalizeCheckoutItemType(item.type);
  return {
    type: itemType.contractType,
    item_type: itemType.backendItemType,
    item_id: itemId,
    qty: normalizeCheckoutQuantity(item.quantity),
  };
};

export const getMerchantToken = (merchantId: string) => {
  const normalizedMerchantId = normalizeMerchantId(merchantId);
  const tokenFromJson = getMerchantTokensJsonMap()[normalizedMerchantId];
  if (tokenFromJson) return tokenFromJson;
  return getRequiredEnv(`SEDIFEX_MERCHANT_TOKEN_${normalizedMerchantId}`);
};

const getBaseTotalMinor = (preview: SedifexCheckoutPreviewResponse) => {
  const candidates = [preview.final_total, preview.pre_processing_total, preview.subtotal];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return Math.round(candidate);
    }
  }
  return 0;
};

export const applyMarketplaceFeeModel = (
  pricingSnapshot: SedifexCheckoutPreviewResponse,
  items: CheckoutItem[],
): SedifexCheckoutPreviewResponse => {
  const itemType: 'product' | 'service' = cartContainsService(items) ? 'service' : 'product';
  const baseTotalMinor = getBaseTotalMinor(pricingSnapshot);
  const customerProcessingFeePercent = getOptionalNumberEnv('SEDIFEX_MARKET_CUSTOMER_PROCESSING_FEE_PERCENT', 1.95);
  const sedifexCommissionPercent = getOptionalNumberEnv(
    itemType === 'service' ? 'SEDIFEX_MARKET_SERVICE_COMMISSION_PERCENT' : 'SEDIFEX_MARKET_PRODUCT_COMMISSION_PERCENT',
    itemType === 'service' ? 5 : 3,
  );
  const customerProcessingFeeMinor = Math.round((baseTotalMinor * customerProcessingFeePercent) / 100);
  const sedifexCommissionMinor = Math.round((baseTotalMinor * sedifexCommissionPercent) / 100);
  const customerFinalTotalMinor = baseTotalMinor + customerProcessingFeeMinor;
  const estimatedMerchantGrossMinor = baseTotalMinor;
  const estimatedMerchantNetMinor = Math.max(0, estimatedMerchantGrossMinor - sedifexCommissionMinor);

  const fees: MarketplaceFeeBreakdown = {
    currency: pricingSnapshot.currency ?? 'GHS',
    baseTotalMinor,
    customerProcessingFeePercent,
    customerProcessingFeeMinor,
    customerFinalTotalMinor,
    sedifexCommissionPercent,
    sedifexCommissionMinor,
    estimatedMerchantGrossMinor,
    estimatedMerchantNetMinor,
    customerPaysProcessingFee: true,
    merchantPaysCommission: true,
    itemType,
  };

  return {
    ...pricingSnapshot,
    pre_processing_total: baseTotalMinor,
    processing_fee_to_add: customerProcessingFeeMinor,
    final_total: customerFinalTotalMinor,
    marketplaceFees: fees,
    marketplace_fees: fees,
    breakdown: [
      ...(Array.isArray(pricingSnapshot.breakdown) ? pricingSnapshot.breakdown : []),
      { code: 'customer_processing_fee', amount: customerProcessingFeeMinor },
      { code: 'sedifex_marketplace_commission', amount: sedifexCommissionMinor },
    ],
  };
};

const cleanPaymentRouting = (routing?: MerchantPaymentRouting | null) => {
  const subaccountCode = routing?.paystackSubaccountCode ?? routing?.subaccountCode ?? null;
  if (!subaccountCode || typeof subaccountCode !== 'string') return null;
  const trimmed = subaccountCode.trim();
  if (!trimmed) return null;
  return {
    provider: 'paystack',
    settlementMode: routing?.settlementMode ?? 'subaccount',
    paystackSubaccountCode: trimmed,
    subaccountCode: trimmed,
    percentageCharge: typeof routing?.percentageCharge === 'number' ? routing.percentageCharge : null,
    commissionControlledBy: routing?.commissionControlledBy ?? 'sedifex',
    status: routing?.status ?? 'active',
  };
};

const buildPaystackSplitPayload = (routing?: MerchantPaymentRouting | null, preview?: SedifexCheckoutPreviewResponse) => {
  const cleaned = cleanPaymentRouting(routing);
  if (!cleaned) return {};
  const marketplaceFees = preview?.marketplace_fees ?? preview?.marketplaceFees;
  const sedifexCommissionMinor =
    marketplaceFees && typeof marketplaceFees === 'object' && 'sedifexCommissionMinor' in marketplaceFees
      ? (marketplaceFees as MarketplaceFeeBreakdown).sedifexCommissionMinor
      : null;
  return {
    subaccount: cleaned.paystackSubaccountCode,
    paystackSubaccountCode: cleaned.paystackSubaccountCode,
    paystack_subaccount_code: cleaned.paystackSubaccountCode,
    splitPayment: {
      provider: 'paystack',
      mode: 'subaccount',
      subaccount: cleaned.paystackSubaccountCode,
      percentageCharge: cleaned.percentageCharge,
      commissionControlledBy: cleaned.commissionControlledBy,
      transactionChargeMinor: typeof sedifexCommissionMinor === 'number' ? sedifexCommissionMinor : null,
      bearer: 'subaccount',
    },
    paymentRouting: cleaned,
  };
};

export const previewMerchantCheckout = async (merchantId: string, items: CheckoutItem[]) => {
  const normalizedMerchantId = normalizeMerchantId(merchantId);
  const merchantToken = getMerchantToken(normalizedMerchantId);
  const payload: SedifexCheckoutPreviewRequest = {
    store_id: normalizedMerchantId,
    merchant_id: normalizedMerchantId,
    storeId: normalizedMerchantId,
    merchantId: normalizedMerchantId,
    currency: 'GHS',
    fulfillment_type: 'PICKUP',
    delivery_address_id: null,
    items: items.map(toSedifexCheckoutItem),
  };
  const upstreamPreview = await integrationFetch<SedifexCheckoutPreviewResponse>('/integration/checkout/preview', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${merchantToken}`,
      'x-api-key': merchantToken,
    },
    body: JSON.stringify(payload),
  });
  return applyMarketplaceFeeModel(upstreamPreview, items);
};

export const createMerchantCheckout = async (
  merchantId: string,
  items: CheckoutItem[],
  reference: string,
  pricingSnapshot?: SedifexCheckoutPreviewResponse,
  customer?: { email?: string; phone?: string },
  paymentRouting?: MerchantPaymentRouting | null,
) => {
  const normalizedMerchantId = normalizeMerchantId(merchantId);
  const merchantToken = getMerchantToken(normalizedMerchantId);
  const finalTotalMinor = typeof pricingSnapshot?.final_total === 'number' ? pricingSnapshot.final_total : null;
  const fallbackAmountMajor = finalTotalMinor && finalTotalMinor > 0 ? finalTotalMinor / 100 : undefined;
  const splitPayload = buildPaystackSplitPayload(paymentRouting, pricingSnapshot);

  return checkoutCreateFetch<unknown>({
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
      currency: pricingSnapshot?.currency ?? 'GHS',
      payment_reference: reference,
      client_order_id: reference,
      clientOrderId: reference,
      amount: fallbackAmountMajor,
      items: items.map(toSedifexCheckoutItem),
      pricing_snapshot: pricingSnapshot,
      marketplace_fees: pricingSnapshot?.marketplace_fees ?? pricingSnapshot?.marketplaceFees,
      ...splitPayload,
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