import {
  User,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, firebaseConfigError, getFirebaseAuth } from '@/lib/firebase';

export type PurchaseHistoryItem = {
  id: string;
  productId: string;
  productName: string;
  itemName?: string;
  displayName?: string;
  quantity: number;
  paymentMethod: string;
  deliveryLocation: string;
  createdAt: string;
  reference?: string;
  customerEmail?: string;
  customerPhone?: string;
  paymentStatus?: 'pending' | 'confirmed' | 'failed' | string;
  orderStatus?: 'pending' | 'processing' | 'completed' | string;
  paymentConfirmedAt?: string;
  orderCompletedAt?: string;
  recordType?: 'product_order' | 'service_booking' | string;
  storeId?: string;
  storeName?: string;
  amount?: number;
  currency?: string;
  imageUrl?: string;
  productUrl?: string;
  serviceUrl?: string;
  storeUrl?: string;
  sourceChannel?: string;
  itemType?: string;
  checkoutUrl?: string;
  receiptUrl?: string;
  bookingDate?: string;
  bookingTime?: string;
  branchLocationName?: string;
};

export type CustomerProfile = {
  fullName: string;
  firstName?: string;
  email: string;
  phone: string;
  defaultDeliveryLocation?: string;
};

const assertFirebaseReady = () => {
  if (firebaseConfigError || !getFirebaseAuth() || !db) {
    throw new Error(firebaseConfigError ?? 'Firebase is not configured.');
  }
};

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? '';
const normalizeName = (value?: string | null) => value?.trim().replace(/\s+/g, ' ') ?? '';
const firstNameFrom = (value?: string | null) => normalizeName(value).split(' ')[0] || '';

const timestampToIso = (value: unknown) => {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return new Date().toISOString();
};

const pickString = (value: unknown, fallback = '') => (typeof value === 'string' && value.trim() ? value.trim() : fallback);
const pickNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};
const getNestedRecord = (record: Record<string, unknown>, key: string) =>
  record[key] && typeof record[key] === 'object' && !Array.isArray(record[key]) ? (record[key] as Record<string, unknown>) : {};
const firstArrayRecord = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  if (!Array.isArray(value) || value.length === 0 || typeof value[0] !== 'object') return {};
  return value[0] as Record<string, unknown>;
};
const pickFirstString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};
const pickOrderDisplayName = (data: Record<string, unknown>, firstItem: Record<string, unknown>) => {
  const keys = ['itemName', 'name', 'productName', 'serviceName', 'title'];
  const nestedData = getNestedRecord(data, 'data');
  return (
    pickFirstString(firstArrayRecord(data, 'items'), keys) ||
    pickFirstString(firstArrayRecord(data, 'cart'), keys) ||
    pickFirstString(firstArrayRecord(getNestedRecord(data, 'pricingSnapshot'), 'items'), keys) ||
    pickFirstString(firstArrayRecord(getNestedRecord(data, 'pricing_snapshot'), 'items'), keys) ||
    pickFirstString(nestedData, ['itemName', 'productName', 'serviceName']) ||
    pickFirstString(data, ['itemName', 'productName', 'serviceName']) ||
    pickFirstString(firstItem, keys) ||
    (pickString(data.recordType) === 'service_booking' ? 'Service booking' : 'Product order')
  );
};
const pickOrderImage = (data: Record<string, unknown>, firstItem: Record<string, unknown>) =>
  pickFirstString(firstItem, ['imageUrl', 'image']) ||
  (Array.isArray(firstItem.imageUrls) ? pickString(firstItem.imageUrls[0]) : '') ||
  pickFirstString(data, ['imageUrl']);
const buildProductHref = (productId?: string, displayName?: string) =>
  productId ? `/products/${encodeURIComponent(productId)}` : displayName ? `/products?search=${encodeURIComponent(displayName)}` : '';
const buildStoreHref = (storeId?: string, storeName?: string) =>
  storeId ? `/stores/${encodeURIComponent(storeId)}` : storeName ? `/stores?search=${encodeURIComponent(storeName)}` : '';

export const upsertMarketCustomerProfile = async (input: Partial<CustomerProfile> & { uid?: string }) => {
  assertFirebaseReady();
  const user = getFirebaseAuth()?.currentUser;
  const uid = input.uid ?? user?.uid;
  if (!uid) return null;

  const fullName = normalizeName(input.fullName ?? user?.displayName ?? '');
  const email = normalizeEmail(input.email ?? user?.email ?? '');
  const phone = input.phone?.trim() ?? '';
  const defaultDeliveryLocation = input.defaultDeliveryLocation?.trim() ?? '';
  const firstName = input.firstName?.trim() || firstNameFrom(fullName);
  const nowPayload = {
    uid,
    fullName,
    displayName: fullName,
    firstName,
    email,
    phone,
    defaultDeliveryLocation,
    updatedAt: serverTimestamp(),
  };

  await Promise.all([
    setDoc(doc(db!, 'marketCustomers', uid), { ...nowPayload, createdAt: serverTimestamp() }, { merge: true }),
    setDoc(doc(db!, 'customerProfiles', uid), { fullName, email, phone, updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true }),
  ]);

  return { fullName, firstName, email, phone, defaultDeliveryLocation };
};

export const registerCustomer = async (input: { fullName: string; email: string; phone: string; password: string }) => {
  assertFirebaseReady();
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth()!, input.email.trim(), input.password);
  const fullName = normalizeName(input.fullName);
  const email = normalizeEmail(input.email);
  const phone = input.phone.trim();

  if (fullName) {
    await updateProfile(credential.user, { displayName: fullName });
  }

  await upsertMarketCustomerProfile({ uid: credential.user.uid, fullName, email, phone });
};

export const signInCustomer = async (emailInput: string, password: string): Promise<boolean> => {
  assertFirebaseReady();
  try {
    const credential = await signInWithEmailAndPassword(getFirebaseAuth()!, normalizeEmail(emailInput), password);
    await upsertMarketCustomerProfile({ uid: credential.user.uid, fullName: credential.user.displayName ?? '', email: credential.user.email ?? '' });
    return true;
  } catch {
    return false;
  }
};

export const signInWithGoogleCustomer = async () => {
  assertFirebaseReady();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(getFirebaseAuth()!, provider);
  await upsertMarketCustomerProfile({
    uid: credential.user.uid,
    fullName: credential.user.displayName ?? '',
    email: credential.user.email ?? '',
    phone: credential.user.phoneNumber ?? '',
  });
  return credential.user;
};

export const signOutCustomer = async () => {
  assertFirebaseReady();
  await signOut(getFirebaseAuth()!);
};

export const getSignedInEmail = (): string | null => getFirebaseAuth()?.currentUser?.email ?? null;
export const getSignedInUserId = (): string | null => getFirebaseAuth()?.currentUser?.uid ?? null;

export const getSignedInCustomerProfile = async (): Promise<CustomerProfile | null> => {
  assertFirebaseReady();
  const user = getFirebaseAuth()?.currentUser;
  if (!user) return null;

  const [marketSnapshot, profileSnapshot] = await Promise.all([
    getDoc(doc(db!, 'marketCustomers', user.uid)).catch(() => null),
    getDoc(doc(db!, 'customerProfiles', user.uid)).catch(() => null),
  ]);
  const marketData = marketSnapshot?.exists() ? (marketSnapshot.data() as Partial<CustomerProfile & { displayName?: string }>) : {};
  const profileData = profileSnapshot?.exists() ? (profileSnapshot.data() as Partial<CustomerProfile>) : {};
  const fullName = normalizeName(marketData.fullName ?? marketData.displayName ?? profileData.fullName ?? user.displayName ?? '');

  return {
    fullName,
    firstName: marketData.firstName ?? firstNameFrom(fullName),
    email: normalizeEmail(marketData.email ?? profileData.email ?? user.email ?? ''),
    phone: (marketData.phone ?? profileData.phone ?? '').trim(),
    defaultDeliveryLocation: marketData.defaultDeliveryLocation?.trim() ?? '',
  };
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  assertFirebaseReady();
  return onAuthStateChanged(getFirebaseAuth()!, callback);
};

export const addPurchaseHistoryItem = async (userId: string, item: Omit<PurchaseHistoryItem, 'id' | 'createdAt'>) => {
  assertFirebaseReady();
  await addDoc(collection(db!, 'customerPurchaseHistory'), {
    userId,
    ...item,
    customerEmail: normalizeEmail(item.customerEmail),
    createdAt: serverTimestamp(),
  });
};

const mapCustomerPurchaseHistoryDoc = (documentId: string, data: Record<string, unknown>): PurchaseHistoryItem => ({
  id: documentId,
  productId: pickString(data.productId, 'unknown-product'),
  productName: pickString(data.productName, 'Untitled item'),
  quantity: pickNumber(data.quantity),
  paymentMethod: pickString(data.paymentMethod, 'online'),
  deliveryLocation: pickString(data.deliveryLocation, 'Not provided'),
  createdAt: timestampToIso(data.createdAt),
  reference: pickString(data.reference) || undefined,
  customerEmail: normalizeEmail(data.customerEmail as string | undefined) || undefined,
  customerPhone: pickString(data.customerPhone) || undefined,
  paymentStatus: pickString(data.paymentStatus) || undefined,
  orderStatus: pickString(data.orderStatus) || undefined,
  paymentConfirmedAt: data.paymentConfirmedAt ? timestampToIso(data.paymentConfirmedAt) : undefined,
  orderCompletedAt: data.orderCompletedAt ? timestampToIso(data.orderCompletedAt) : undefined,
  recordType: pickString(data.recordType) || undefined,
});

const mapCustomerOrderDoc = (documentId: string, data: Record<string, unknown>): PurchaseHistoryItem => {
  const customer = data.customer && typeof data.customer === 'object' ? (data.customer as Record<string, unknown>) : {};
  const items = Array.isArray(data.items) ? data.items : Array.isArray(data.cart) ? data.cart : [];
  const firstItem = items[0] && typeof items[0] === 'object' ? (items[0] as Record<string, unknown>) : {};
  const displayName = pickOrderDisplayName(data, firstItem);
  const storeId = pickString(data.storeId ?? data.merchantId);
  const storeName = pickString(data.storeName);
  const productId = pickString(firstItem.productId ?? firstItem.item_id ?? firstItem.itemId, 'unknown-product');
  return {
    id: `marketCustomerOrder_${documentId}`,
    productId,
    productName: displayName,
    itemName: displayName,
    displayName,
    quantity: pickNumber(firstItem.quantity ?? firstItem.qty),
    paymentMethod: pickString(data.paymentMethod ?? data.paymentCollectionMode, 'online_checkout'),
    deliveryLocation: pickString(data.deliveryLocation ?? data.delivery?.toString(), 'Not provided'),
    createdAt: timestampToIso(data.createdAtServer ?? data.createdAt),
    reference: pickString(data.reference ?? data.paymentReference) || documentId,
    customerEmail: normalizeEmail(pickString(customer.email ?? data.customerEmail)) || undefined,
    customerPhone: pickString(customer.phone ?? data.customerPhone) || undefined,
    paymentStatus: pickString(data.paymentStatus ?? data.payment_status, 'pending'),
    orderStatus: pickString(data.orderStatus ?? data.order_status, 'pending_payment'),
    paymentConfirmedAt: data.paymentConfirmedAt ? timestampToIso(data.paymentConfirmedAt) : undefined,
    orderCompletedAt: data.orderCompletedAt ? timestampToIso(data.orderCompletedAt) : undefined,
    recordType: pickString(data.recordType, 'product_order'),
    storeId: storeId || undefined,
    storeName: storeName || undefined,
    imageUrl: pickOrderImage(data, firstItem) || undefined,
    productUrl: buildProductHref(productId, displayName) || undefined,
    storeUrl: buildStoreHref(storeId, storeName) || undefined,
    receiptUrl: `/account/orders/${encodeURIComponent(pickString(data.reference ?? data.paymentReference) || documentId)}`,
  };
};

const mapCheckoutRequestDoc = (documentId: string, data: Record<string, unknown>): PurchaseHistoryItem => {
  const contact = pickString(data.contact);
  const [phoneCandidate, emailCandidate] = contact.split('|').map((part) => part.trim());
  const itemType = pickString(data.itemType).toLowerCase();
  return {
    id: `checkoutRequest_${documentId}`,
    productId: pickString(data.productId, 'unknown-product'),
    productName: pickString(data.productName, 'Untitled item'),
    quantity: pickNumber(data.quantity),
    paymentMethod: pickString(data.paymentMethod, 'online'),
    deliveryLocation: pickString(data.deliveryLocation, 'Not provided'),
    createdAt: timestampToIso(data.createdAtServer ?? data.createdAt),
    reference: pickString(data.reference) || undefined,
    customerEmail: normalizeEmail(pickString(data.customerEmail) || emailCandidate) || undefined,
    customerPhone: pickString(data.customerPhone) || phoneCandidate || undefined,
    paymentStatus: pickString(data.paymentStatus, 'pending'),
    orderStatus: pickString(data.orderStatus, 'pending'),
    recordType: itemType === 'service' ? 'service_booking' : 'product_order',
  };
};

const mapIntegrationOrderDoc = (documentId: string, data: Record<string, unknown>): PurchaseHistoryItem => {
  const customer = data.customer && typeof data.customer === 'object' ? (data.customer as Record<string, unknown>) : {};
  const items = Array.isArray(data.items) ? data.items : Array.isArray(data.cart) ? data.cart : [];
  const firstItem = items[0] && typeof items[0] === 'object' ? (items[0] as Record<string, unknown>) : {};
  const nestedData = getNestedRecord(data, 'data');
  const displayName = pickOrderDisplayName(data, firstItem);
  const productId = pickString(firstItem.productId ?? firstItem.item_id ?? firstItem.itemId, 'unknown-product');
  const storeId = pickString(nestedData.storeId ?? nestedData.merchantId ?? data.storeId ?? data.merchantId);
  const storeName = pickString(nestedData.storeName ?? data.storeName);
  const amount = Number(data.amount ?? data.amountPaid ?? data.finalTotal ?? getNestedRecord(data, 'pricingSnapshot').final_total);
  return {
    id: `integrationOrder_${documentId}`,
    productId,
    productName: displayName,
    itemName: displayName,
    displayName,
    quantity: pickNumber(firstItem.quantity ?? firstItem.qty),
    paymentMethod: pickString(data.paymentCollectionMode, 'online'),
    deliveryLocation: pickString(data.deliveryLocation, 'Not provided'),
    createdAt: timestampToIso(data.createdAtServer ?? data.createdAt),
    reference: pickString(data.reference) || undefined,
    customerEmail: normalizeEmail(pickString(customer.email)) || undefined,
    customerPhone: pickString(customer.phone) || undefined,
    paymentStatus: pickString(data.paymentStatus ?? data.payment_status, 'pending'),
    orderStatus: pickString(data.orderStatus ?? data.order_status, 'pending'),
    paymentConfirmedAt: data.paymentConfirmedAt ? timestampToIso(data.paymentConfirmedAt) : undefined,
    orderCompletedAt: data.orderCompletedAt ? timestampToIso(data.orderCompletedAt) : undefined,
    recordType: pickString(data.recordType, 'product_order'),
    storeId: storeId || undefined,
    storeName: storeName || undefined,
    amount: Number.isFinite(amount) ? amount : undefined,
    currency: pickString(data.currency ?? getNestedRecord(data, 'pricingSnapshot').currency, 'GHS'),
    imageUrl: pickOrderImage(data, firstItem) || undefined,
    productUrl: buildProductHref(productId, displayName) || undefined,
    storeUrl: buildStoreHref(storeId, storeName) || undefined,
    sourceChannel: pickString(data.sourceChannel) || undefined,
    itemType: pickString(data.itemType) || undefined,
    receiptUrl: `/account/orders/${encodeURIComponent(pickString(data.reference) || documentId)}`,
  };
};

const mapIntegrationBookingDoc = (documentId: string, data: Record<string, unknown>): PurchaseHistoryItem => {
  const customer = data.customer && typeof data.customer === 'object' ? (data.customer as Record<string, unknown>) : {};
  const items = Array.isArray(data.items) ? data.items : Array.isArray(data.cart) ? data.cart : [];
  const firstItem = items[0] && typeof items[0] === 'object' ? (items[0] as Record<string, unknown>) : {};
  const booking = data.booking && typeof data.booking === 'object' ? (data.booking as Record<string, unknown>) : {};
  const preferredDate = pickString(data.bookingDate ?? booking.preferredDate);
  const preferredTime = pickString(data.bookingTime ?? booking.preferredTime);
  const preferredBranch = pickString(data.preferredBranch ?? booking.preferredBranch);
  const displayName = pickOrderDisplayName(data, firstItem);
  const storeId = pickString(data.storeId ?? data.merchantId);
  const storeName = pickString(data.storeName ?? data.merchantName);
  return {
    id: `integrationBooking_${documentId}`,
    productId: pickString(data.serviceId ?? firstItem.productId ?? firstItem.item_id, 'unknown-service'),
    productName: displayName,
    itemName: displayName,
    displayName,
    quantity: 1,
    paymentMethod: pickString(data.paymentCollectionMode, 'booking'),
    deliveryLocation: [preferredDate, preferredTime, preferredBranch].filter(Boolean).join(' · ') || 'Preferred time not provided',
    createdAt: timestampToIso(data.createdAtServer ?? data.createdAt),
    reference: pickString(data.reference) || undefined,
    customerEmail: normalizeEmail(pickString(customer.email)) || undefined,
    customerPhone: pickString(customer.phone) || undefined,
    paymentStatus: pickString(data.paymentStatus ?? data.payment_status, 'pending'),
    orderStatus: pickString(data.bookingStatus ?? data.orderStatus ?? data.order_status, 'pending_store_confirmation'),
    paymentConfirmedAt: data.paymentConfirmedAt ? timestampToIso(data.paymentConfirmedAt) : undefined,
    orderCompletedAt: data.orderCompletedAt ? timestampToIso(data.orderCompletedAt) : undefined,
    recordType: 'service_booking',
    storeId: storeId || undefined,
    storeName: storeName || undefined,
    storeUrl: buildStoreHref(storeId, storeName) || undefined,
    serviceUrl: buildProductHref(pickString(data.serviceId), displayName) || undefined,
    receiptUrl: `/account/orders/${encodeURIComponent(pickString(data.reference) || documentId)}`,
    bookingDate: preferredDate || undefined,
    bookingTime: preferredTime || undefined,
    branchLocationName: preferredBranch || undefined,
  };
};

const dedupeHistory = (items: PurchaseHistoryItem[]) => {
  const seen = new Set<string>();
  const deduped: PurchaseHistoryItem[] = [];

  for (const item of items) {
    const key = item.reference || `${item.productId}_${item.createdAt}_${item.customerEmail ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
};

export const getPurchaseHistory = async (userId: string, email?: string | null): Promise<PurchaseHistoryItem[]> => {
  assertFirebaseReady();
  const normalizedEmail = normalizeEmail(email);
  const historyItems: PurchaseHistoryItem[] = [];

  const byUserSnapshot = await getDocs(query(collection(db!, 'customerPurchaseHistory'), where('userId', '==', userId)));
  historyItems.push(...byUserSnapshot.docs.map((historyDoc) => mapCustomerPurchaseHistoryDoc(historyDoc.id, historyDoc.data() as Record<string, unknown>)));

  try {
    const customerOrdersSnapshot = await getDocs(collection(db!, 'marketCustomers', userId, 'orders'));
    historyItems.push(...customerOrdersSnapshot.docs.map((orderDoc) => mapCustomerOrderDoc(orderDoc.id, orderDoc.data() as Record<string, unknown>)));
  } catch {}

  if (normalizedEmail) {
    try {
      const byEmailSnapshot = await getDocs(query(collection(db!, 'customerPurchaseHistory'), where('customerEmail', '==', normalizedEmail)));
      historyItems.push(...byEmailSnapshot.docs.map((historyDoc) => mapCustomerPurchaseHistoryDoc(historyDoc.id, historyDoc.data() as Record<string, unknown>)));
    } catch {}

    try {
      const ordersSnapshot = await getDocs(query(collection(db!, 'integrationOrders'), limit(300)));
      historyItems.push(
        ...ordersSnapshot.docs
          .map((orderDoc) => mapIntegrationOrderDoc(orderDoc.id, orderDoc.data() as Record<string, unknown>))
          .filter((item) => item.customerEmail === normalizedEmail),
      );
    } catch {}

    try {
      const bookingsSnapshot = await getDocs(query(collection(db!, 'integrationBookings'), limit(300)));
      historyItems.push(
        ...bookingsSnapshot.docs
          .map((bookingDoc) => mapIntegrationBookingDoc(bookingDoc.id, bookingDoc.data() as Record<string, unknown>))
          .filter((item) => item.customerEmail === normalizedEmail),
      );
    } catch {}

    try {
      const checkoutRequestsSnapshot = await getDocs(query(collection(db!, 'checkoutRequests'), limit(300)));
      const matchingCheckoutRequests = checkoutRequestsSnapshot.docs
        .map((requestDoc) => mapCheckoutRequestDoc(requestDoc.id, requestDoc.data() as Record<string, unknown>))
        .filter((item) => item.customerEmail === normalizedEmail || normalizeEmail(item.customerEmail).includes(normalizedEmail));
      historyItems.push(...matchingCheckoutRequests);
    } catch {}
  }

  return dedupeHistory(historyItems);
};
