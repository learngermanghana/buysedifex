import { collection, doc, getDoc, getDocs, limit, query, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, firebaseConfigError } from '@/lib/firebase';

export type GuestOrderIdentity = {
  email?: string;
  phone?: string;
};

export type GuestOrderRecord = Record<string, unknown> & {
  id?: string;
  collectionName?: string;
};

export type GuestOrderLookupResult = {
  ok: true;
  order: GuestOrderView;
  rawOrder: GuestOrderRecord;
};

export type GuestOrderItem = {
  name: string;
  quantity: string;
  price?: string;
  storeName?: string;
};

export type GuestOrderView = {
  id: string;
  reference: string;
  recordType: string;
  paymentStatus: string;
  orderStatus: string;
  deliveryStatus?: string;
  fulfillmentStatus?: string;
  amount?: string;
  currency: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  storeId?: string;
  storeName?: string;
  deliveryLocation?: string;
  deliveryNotes?: string;
  items: GuestOrderItem[];
  merchantIds: string[];
  childReferences: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
  collectionName?: string;
};

const cleanText = (value: unknown, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : typeof value === 'number' ? String(value) : '');
const cleanEmail = (value: unknown) => cleanText(value, 220).toLowerCase();
const digitsOnly = (value: unknown) => cleanText(value, 80).replace(/\D/g, '');

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(asRecord).filter((item) => Object.keys(item).length > 0) : [];

const pickString = (source: Record<string, unknown>, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = source[key];
    const text = cleanText(value, 500);
    if (text) return text;
  }
  return fallback;
};

const pickNumber = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const formatMoney = (amount: number | null, currency = 'GHS') => {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return undefined;
  const major = amount > 1000 && Number.isInteger(amount) ? amount / 100 : amount;
  return `${currency.toUpperCase()} ${major.toFixed(2)}`;
};

export const normalizeGuestOrderIdentity = (identity: GuestOrderIdentity) => ({
  email: cleanEmail(identity.email),
  phone: digitsOnly(identity.phone),
});

export const phoneMatches = (left: unknown, right: unknown) => {
  const a = digitsOnly(left);
  const b = digitsOnly(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 7 && b.length >= 7) return a.endsWith(b.slice(-9)) || b.endsWith(a.slice(-9)) || a.slice(-7) === b.slice(-7);
  return false;
};

export const readOrderCustomer = (order: GuestOrderRecord) => {
  const customer = asRecord(order.customer);
  const metadata = asRecord(order.metadata);
  return {
    name: pickString(customer, ['name', 'customerName']) || pickString(order, ['customerName', 'name']),
    email: cleanEmail(customer.email || customer.customerEmail || order.customerEmail || order.email || metadata.customerEmail),
    phone: cleanText(customer.phone || customer.customerPhone || order.customerPhone || order.phone || metadata.customerPhone, 80),
  };
};

export const identityMatchesOrder = (order: GuestOrderRecord, identity: GuestOrderIdentity) => {
  const normalized = normalizeGuestOrderIdentity(identity);
  const customer = readOrderCustomer(order);
  const orderEmail = cleanEmail(customer.email);
  const orderPhone = digitsOnly(customer.phone);
  return Boolean((normalized.email && orderEmail && normalized.email === orderEmail) || (normalized.phone && orderPhone && phoneMatches(normalized.phone, orderPhone)));
};

const snapshotRecord = (collectionName: string, id: string, data: Record<string, unknown>): GuestOrderRecord => ({ id, collectionName, ...data });

async function getDirectDoc(collectionName: string, reference: string) {
  if (!db || firebaseConfigError) return null;
  const snapshot = await getDoc(doc(db, collectionName, reference)).catch(() => null);
  return snapshot?.exists() ? snapshotRecord(collectionName, snapshot.id, snapshot.data() as Record<string, unknown>) : null;
}

async function getDirectNestedDoc(path: string[], label: string, reference: string) {
  if (!db || firebaseConfigError) return null;
  const [firstSegment, ...additionalSegments] = [...path, reference];
  if (!firstSegment) return null;
  const snapshot = await getDoc(doc(db, firstSegment, ...additionalSegments)).catch(() => null);
  return snapshot?.exists() ? snapshotRecord(label, snapshot.id, snapshot.data() as Record<string, unknown>) : null;
}

async function queryByReference(collectionPath: string[], label: string, reference: string) {
  if (!db || firebaseConfigError) return [] as GuestOrderRecord[];
  const [firstSegment, ...additionalSegments] = collectionPath;
  if (!firstSegment) return [] as GuestOrderRecord[];
  const collectionReference = collection(db, firstSegment, ...additionalSegments);
  const results: GuestOrderRecord[] = [];
  for (const field of ['reference', 'paymentReference', 'payment_reference', 'clientOrderId', 'client_order_id']) {
    const snapshot = await getDocs(query(collectionReference, where(field, '==', reference), limit(3))).catch(() => null);
    snapshot?.docs.forEach((item) => results.push(snapshotRecord(label, item.id, item.data() as Record<string, unknown>)));
  }
  return results;
}

export async function findGuestOrderCandidates(reference: string) {
  const normalizedReference = cleanText(reference, 220);
  if (!normalizedReference || !db || firebaseConfigError) return [] as GuestOrderRecord[];
  const candidates: GuestOrderRecord[] = [];
  const directCollections = ['marketplaceOrders', 'integrationOrders', 'integrationBookings'];

  for (const collectionName of directCollections) {
    const record = await getDirectDoc(collectionName, normalizedReference);
    if (record) candidates.push(record);
  }

  const adminRecord = await getDirectNestedDoc(['sedifexAdmin', 'marketplace', 'orders'], 'sedifexAdmin.marketplace.orders', normalizedReference);
  if (adminRecord) candidates.push(adminRecord);

  for (const collectionName of directCollections) {
    candidates.push(...await queryByReference([collectionName], collectionName, normalizedReference));
  }
  candidates.push(...await queryByReference(['sedifexAdmin', 'marketplace', 'orders'], 'sedifexAdmin.marketplace.orders', normalizedReference));

  const map = new Map<string, GuestOrderRecord>();
  candidates.forEach((candidate) => map.set(`${candidate.collectionName}:${candidate.id}`, candidate));
  return Array.from(map.values());
}

export async function lookupGuestOrder(reference: string, identity: GuestOrderIdentity): Promise<GuestOrderLookupResult | { ok: false; error: string; status: number }> {
  const normalizedReference = cleanText(reference, 220);
  const normalizedIdentity = normalizeGuestOrderIdentity(identity);
  if (!normalizedReference) return { ok: false, error: 'Order reference is required.', status: 400 };
  if (!normalizedIdentity.email && !normalizedIdentity.phone) return { ok: false, error: 'Enter the email or phone number used for checkout.', status: 400 };
  if (!db || firebaseConfigError) return { ok: false, error: 'Order lookup is not available right now.', status: 503 };

  const candidates = await findGuestOrderCandidates(normalizedReference);
  if (candidates.length === 0) return { ok: false, error: 'Order not found. Check the reference and try again.', status: 404 };

  const matched = candidates.find((candidate) => identityMatchesOrder(candidate, normalizedIdentity));
  if (!matched) return { ok: false, error: 'The email or phone does not match this order.', status: 403 };

  return { ok: true, rawOrder: matched, order: normalizeGuestOrderView(matched, normalizedReference) };
}

export function normalizeGuestOrderView(order: GuestOrderRecord, fallbackReference: string): GuestOrderView {
  const customer = readOrderCustomer(order);
  const currency = pickString(order, ['currency'], 'GHS');
  const amount = pickNumber(order, ['amountPaid', 'finalTotal', 'final_total', 'amount', 'total', 'amountMinor']);
  const sourceItems = asArray(order.items).length ? asArray(order.items) : asArray(order.cart);
  const merchantOrders = asArray(order.merchantOrders);
  const items = sourceItems.map((item) => ({
    name: pickString(item, ['name', 'productName', 'itemName', 'serviceName'], 'Item'),
    quantity: pickString(item, ['quantity', 'qty'], '1'),
    price: formatMoney(pickNumber(item, ['price', 'amount', 'unitPrice', 'lineSubtotalMinor']), currency),
    storeName: pickString(item, ['storeName', 'merchantName']),
  }));

  return {
    id: cleanText(order.id || fallbackReference, 220),
    reference: pickString(order, ['reference', 'paymentReference', 'payment_reference', 'clientOrderId', 'client_order_id'], fallbackReference),
    recordType: pickString(order, ['recordType'], merchantOrders.length ? 'marketplace_master_order' : 'product_order'),
    paymentStatus: pickString(order, ['paymentStatus', 'payment_status', 'paystackStatus'], 'pending'),
    orderStatus: pickString(order, ['orderStatus', 'order_status', 'status'], 'processing'),
    deliveryStatus: pickString(order, ['deliveryStatus', 'delivery_status']) || undefined,
    fulfillmentStatus: pickString(order, ['fulfillmentStatus', 'fulfillment_status']) || undefined,
    amount: formatMoney(amount, currency),
    currency,
    customerName: customer.name || undefined,
    customerEmail: customer.email || undefined,
    customerPhone: customer.phone || undefined,
    storeId: pickString(order, ['storeId', 'store_id', 'merchantId', 'merchant_id']) || undefined,
    storeName: pickString(order, ['storeName', 'store_name', 'merchantName']) || undefined,
    deliveryLocation: pickString(order, ['deliveryLocation', 'delivery_address', 'deliveryAddress']) || undefined,
    deliveryNotes: pickString(order, ['deliveryNotes', 'notes']) || undefined,
    items: items.length ? items : merchantOrders.map((merchant) => ({
      name: pickString(merchant, ['storeName', 'merchantId', 'storeId'], 'Merchant order'),
      quantity: '1',
      price: formatMoney(pickNumber(merchant, ['amount', 'amountMinor']), currency),
      storeName: pickString(merchant, ['storeName', 'merchantId', 'storeId']),
    })),
    merchantIds: Array.isArray(order.merchantIds) ? order.merchantIds.map(String) : [],
    childReferences: Array.isArray(order.childReferences) ? order.childReferences.map(String) : [],
    createdAt: order.createdAt ?? null,
    updatedAt: order.updatedAt ?? null,
    collectionName: cleanText(order.collectionName),
  };
}

export async function saveOrderSupportTicket(input: {
  order: GuestOrderView;
  rawOrder: GuestOrderRecord;
  identity: GuestOrderIdentity;
  issueType: string;
  message: string;
  evidenceUrl?: string;
}) {
  if (!db || firebaseConfigError) throw new Error('Support tickets are not available right now.');
  const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const normalizedIdentity = normalizeGuestOrderIdentity(input.identity);
  const payload = {
    ticketId,
    source: 'guest_order_tracking',
    status: 'open',
    priority: ['not_delivered', 'refund_request', 'wrong_item', 'damaged_item'].includes(input.issueType) ? 'high' : 'normal',
    issueType: cleanText(input.issueType, 80) || 'other',
    message: cleanText(input.message, 3000),
    evidenceUrl: cleanText(input.evidenceUrl, 500) || null,
    orderReference: input.order.reference,
    orderRecordId: input.order.id,
    orderCollectionName: input.order.collectionName || null,
    recordType: input.order.recordType,
    paymentStatus: input.order.paymentStatus,
    orderStatus: input.order.orderStatus,
    deliveryStatus: input.order.deliveryStatus || null,
    fulfillmentStatus: input.order.fulfillmentStatus || null,
    storeId: input.order.storeId || null,
    storeName: input.order.storeName || null,
    customerName: input.order.customerName || null,
    customerEmail: input.order.customerEmail || normalizedIdentity.email || null,
    customerPhone: input.order.customerPhone || normalizedIdentity.phone || null,
    submittedByEmail: normalizedIdentity.email || null,
    submittedByPhone: normalizedIdentity.phone || null,
    customer: {
      name: input.order.customerName || null,
      email: input.order.customerEmail || normalizedIdentity.email || null,
      phone: input.order.customerPhone || normalizedIdentity.phone || null,
    },
    orderSnapshot: input.order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAtIso: new Date().toISOString(),
  };

  await Promise.all([
    setDoc(doc(db, 'supportTickets', ticketId), payload, { merge: true }),
    setDoc(doc(db, 'sedifexAdmin', 'marketplace', 'supportTickets', ticketId), payload, { merge: true }),
  ]);
  return { ticketId, status: 'open' };
}
