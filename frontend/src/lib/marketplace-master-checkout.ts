import crypto from 'node:crypto';
import { collection, doc, serverTimestamp, setDoc, writeBatch, type Firestore } from 'firebase/firestore';
import type { CheckoutItem, MerchantPaymentRouting, SedifexCheckoutPreviewResponse } from './sedifex-checkout';

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data?: { authorization_url?: string; access_code?: string; reference?: string };
};

export type MerchantPreviewBundle = {
  merchantId: string;
  merchantCart: CheckoutItem[];
  preview: SedifexCheckoutPreviewResponse;
  routing: MerchantPaymentRouting | null;
  childReference: string;
  amountMinor: number;
};

export type MasterCheckoutInput = {
  db: Firestore;
  customerUid?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  deliveryLocation?: string;
  deliveryNotes?: string;
  merchantPreviews: MerchantPreviewBundle[];
};

export const amountFromPreview = (preview: SedifexCheckoutPreviewResponse) => {
  const candidates = [preview.final_total, preview.pre_processing_total, preview.subtotal];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) return Math.round(candidate);
  }
  return 0;
};

export const majorFromMinor = (minor: number) => Math.round(minor) / 100;
export const createMasterReference = () => `market_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
export const customerHashKey = (email?: string, phone?: string) =>
  crypto.createHash('sha256').update((email || phone || `guest_${Date.now()}`).toLowerCase()).digest('hex').slice(0, 32);

const getPaystackSecret = () =>
  process.env.SEDIFEX_MARKET_PAYSTACK_SECRET_KEY?.trim() || process.env.PAYSTACK_SECRET_KEY?.trim() || '';

const getSiteUrl = () => {
  const direct = process.env.SEDIFEX_MARKET_SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (direct) return direct.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://www.sedifexmarket.com';
};

export async function initializeMasterPaystackCheckout(input: {
  reference: string;
  amountMinor: number;
  email: string;
  customerName?: string;
  phone?: string;
  merchantIds: string[];
  childReferences: string[];
  customerUid?: string | null;
}) {
  const secret = getPaystackSecret();
  if (!secret) throw new Error('SEDIFEX_MARKET_PAYSTACK_SECRET_KEY or PAYSTACK_SECRET_KEY is required for multi-store one-bill checkout.');

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountMinor,
      reference: input.reference,
      currency: 'GHS',
      callback_url: `${getSiteUrl()}/account/orders/${encodeURIComponent(input.reference)}`,
      metadata: {
        sourceChannel: 'sedifex_market',
        checkoutMode: 'master_multi_store',
        customerUid: input.customerUid || null,
        merchantIds: input.merchantIds,
        childReferences: input.childReferences,
        custom_fields: [
          { display_name: 'Customer name', variable_name: 'customer_name', value: input.customerName || '' },
          { display_name: 'Phone', variable_name: 'phone', value: input.phone || '' },
        ],
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as PaystackInitializeResponse | null;
  if (!response.ok || !payload?.status || !payload.data?.authorization_url) {
    throw new Error(payload?.message || `Paystack initialize failed with ${response.status}`);
  }
  return payload.data;
}

export async function saveMarketplaceCustomerCopies(input: {
  db: Firestore;
  customerUid?: string | null;
  customer: { name: string; email: string; phone?: string };
  deliveryLocation?: string;
  merchantIds: string[];
}) {
  const key = customerHashKey(input.customer.email, input.customer.phone);
  const customerPayload = {
    customerKey: key,
    uid: input.customerUid || null,
    name: input.customer.name || null,
    email: input.customer.email || null,
    phone: input.customer.phone || null,
    defaultDeliveryLocation: input.deliveryLocation || null,
    source: 'sedifex_market',
    sourceChannel: 'sedifex_market',
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(input.db);
  input.merchantIds.forEach((merchantId) => {
    batch.set(doc(input.db, 'stores', merchantId, 'customers', key), { ...customerPayload, storeId: merchantId, firstSeenAt: serverTimestamp() }, { merge: true });
  });
  batch.set(doc(input.db, 'sedifexAdmin', 'marketplace', 'customers', key), { ...customerPayload, merchantIds: input.merchantIds, firstSeenAt: serverTimestamp() }, { merge: true });
  if (input.customerUid) {
    batch.set(doc(input.db, 'marketCustomers', input.customerUid), {
      uid: input.customerUid,
      displayName: input.customer.name || null,
      firstName: input.customer.name?.split(/\s+/)[0] || null,
      email: input.customer.email || null,
      phone: input.customer.phone || null,
      defaultDeliveryLocation: input.deliveryLocation || null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

export async function saveMasterCheckoutRecords(input: MasterCheckoutInput & { checkoutUrl: string; accessCode?: string | null; masterReference: string; totalAmountMinor: number }) {
  const nowIso = new Date().toISOString();
  const merchantIds = input.merchantPreviews.map((merchant) => merchant.merchantId);
  const childReferences = input.merchantPreviews.map((merchant) => merchant.childReference);
  const masterRecord = {
    recordType: 'marketplace_master_order',
    orderScope: 'multi_merchant_master',
    reference: input.masterReference,
    paymentReference: input.masterReference,
    customerUid: input.customerUid || null,
    customer: { uid: input.customerUid || null, name: input.customerName || null, email: input.customerEmail, phone: input.customerPhone || null },
    deliveryLocation: input.deliveryLocation || null,
    deliveryNotes: input.deliveryNotes || null,
    source: 'sedifex_market',
    sourceChannel: 'sedifex_market',
    currency: 'GHS',
    amountMinor: input.totalAmountMinor,
    amount: majorFromMinor(input.totalAmountMinor),
    paymentStatus: 'pending',
    orderStatus: 'pending_payment',
    paymentCollectionMode: 'online_checkout_master',
    checkoutUrl: input.checkoutUrl,
    paystackAccessCode: input.accessCode || null,
    merchantIds,
    childReferences,
    merchantOrders: input.merchantPreviews.map((merchant) => ({
      merchantId: merchant.merchantId,
      storeId: merchant.merchantId,
      childReference: merchant.childReference,
      amountMinor: merchant.amountMinor,
      amount: majorFromMinor(merchant.amountMinor),
      cart: merchant.merchantCart,
      items: merchant.merchantCart,
      pricingSnapshot: merchant.preview,
      paymentRouting: merchant.routing ?? null,
      settlementStatus: 'pending_payment',
    })),
    createdAt: nowIso,
    createdAtServer: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(input.db);
  batch.set(doc(input.db, 'marketplaceOrders', input.masterReference), masterRecord, { merge: true });
  batch.set(doc(input.db, 'sedifexAdmin', 'marketplace', 'orders', input.masterReference), masterRecord, { merge: true });
  if (input.customerUid) batch.set(doc(input.db, 'marketCustomers', input.customerUid, 'orders', input.masterReference), masterRecord, { merge: true });

  input.merchantPreviews.forEach((merchant) => {
    const childRecord = {
      recordType: 'product_order',
      orderScope: 'multi_merchant_child',
      masterReference: input.masterReference,
      merchantId: merchant.merchantId,
      storeId: merchant.merchantId,
      reference: merchant.childReference,
      paymentReference: input.masterReference,
      clientOrderId: merchant.childReference,
      sedifexOrderId: merchant.childReference,
      customerUid: input.customerUid || null,
      customer: masterRecord.customer,
      deliveryLocation: input.deliveryLocation || null,
      deliveryNotes: input.deliveryNotes || null,
      cart: merchant.merchantCart,
      items: merchant.merchantCart,
      pricingSnapshot: merchant.preview,
      amountMinor: merchant.amountMinor,
      amount: majorFromMinor(merchant.amountMinor),
      paymentRouting: merchant.routing ?? null,
      paymentStatus: 'pending',
      orderStatus: 'pending_master_payment',
      paymentCollectionMode: 'online_checkout_master_child',
      source: 'sedifex_market',
      sourceChannel: 'sedifex_market',
      syncStatus: 'pending_payment',
      createdAt: nowIso,
      createdAtServer: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    batch.set(doc(collection(input.db, 'integrationOrders')), childRecord);
    batch.set(doc(input.db, 'stores', merchant.merchantId, 'integrationOrders', merchant.childReference), childRecord, { merge: true });
    batch.set(doc(input.db, 'marketplaceOrders', input.masterReference, 'merchantOrders', merchant.merchantId), childRecord, { merge: true });
  });

  await batch.commit();
  return masterRecord;
}
