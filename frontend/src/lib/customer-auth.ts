import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db, firebaseConfigError, getFirebaseAuth } from '@/lib/firebase';

export type PurchaseHistoryItem = {
  id: string;
  productId: string;
  productName: string;
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
};

export type CustomerProfile = {
  fullName: string;
  email: string;
  phone: string;
};

const assertFirebaseReady = () => {
  if (firebaseConfigError || !getFirebaseAuth() || !db) {
    throw new Error(firebaseConfigError ?? 'Firebase is not configured.');
  }
};

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? '';

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

export const registerCustomer = async (input: { fullName: string; email: string; phone: string; password: string }) => {
  assertFirebaseReady();
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth()!, input.email.trim(), input.password);
  const fullName = input.fullName.trim();
  const email = normalizeEmail(input.email);
  const phone = input.phone.trim();

  if (fullName) {
    await updateProfile(credential.user, { displayName: fullName });
  }

  await setDoc(doc(db!, 'customerProfiles', credential.user.uid), {
    fullName,
    email,
    phone,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
};

export const signInCustomer = async (emailInput: string, password: string): Promise<boolean> => {
  assertFirebaseReady();
  try {
    await signInWithEmailAndPassword(getFirebaseAuth()!, normalizeEmail(emailInput), password);
    return true;
  } catch {
    return false;
  }
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
  if (!user) {
    return null;
  }

  const profileSnapshot = await getDoc(doc(db!, 'customerProfiles', user.uid));
  const profileData = profileSnapshot.exists()
    ? (profileSnapshot.data() as Partial<CustomerProfile>)
    : {};

  return {
    fullName: (profileData.fullName ?? user.displayName ?? '').trim(),
    email: normalizeEmail(profileData.email ?? user.email ?? ''),
    phone: (profileData.phone ?? '').trim(),
  };
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  assertFirebaseReady();
  return onAuthStateChanged(getFirebaseAuth()!, callback);
};

export const addPurchaseHistoryItem = async (
  userId: string,
  item: Omit<PurchaseHistoryItem, 'id' | 'createdAt'>,
) => {
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
});

const mapCheckoutRequestDoc = (documentId: string, data: Record<string, unknown>): PurchaseHistoryItem => {
  const contact = pickString(data.contact);
  const [phoneCandidate, emailCandidate] = contact.split('|').map((part) => part.trim());
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
  historyItems.push(
    ...byUserSnapshot.docs.map((historyDoc) =>
      mapCustomerPurchaseHistoryDoc(historyDoc.id, historyDoc.data() as Record<string, unknown>),
    ),
  );

  if (normalizedEmail) {
    try {
      const byEmailSnapshot = await getDocs(
        query(collection(db!, 'customerPurchaseHistory'), where('customerEmail', '==', normalizedEmail)),
      );
      historyItems.push(
        ...byEmailSnapshot.docs.map((historyDoc) =>
          mapCustomerPurchaseHistoryDoc(historyDoc.id, historyDoc.data() as Record<string, unknown>),
        ),
      );
    } catch {
      // Older deployments may not have customerEmail indexed or readable yet. Keep userId history working.
    }

    try {
      const checkoutRequestsSnapshot = await getDocs(query(collection(db!, 'checkoutRequests'), limit(300)));
      const matchingCheckoutRequests = checkoutRequestsSnapshot.docs
        .map((requestDoc) => mapCheckoutRequestDoc(requestDoc.id, requestDoc.data() as Record<string, unknown>))
        .filter((item) => item.customerEmail === normalizedEmail || normalizeEmail(item.customerEmail).includes(normalizedEmail));
      historyItems.push(...matchingCheckoutRequests);
    } catch {
      // Checkout requests are a legacy fallback. If rules block it, newer customerPurchaseHistory still works.
    }
  }

  return dedupeHistory(historyItems);
};