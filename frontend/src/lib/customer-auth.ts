import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
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

const getAuthErrorMessage = (fallback: string) => fallback;

export const registerCustomer = async (input: { fullName: string; email: string; phone: string; password: string }) => {
  assertFirebaseReady();
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth()!, input.email.trim(), input.password);
  const fullName = input.fullName.trim();
  const email = input.email.trim();
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
    await signInWithEmailAndPassword(getFirebaseAuth()!, emailInput.trim(), password);
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
    email: (profileData.email ?? user.email ?? '').trim(),
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
    createdAt: serverTimestamp(),
  });
};

export const getPurchaseHistory = async (userId: string): Promise<PurchaseHistoryItem[]> => {
  assertFirebaseReady();
  const snapshot = await getDocs(
    query(collection(db!, 'customerPurchaseHistory'), where('userId', '==', userId), orderBy('createdAt', 'desc')),
  );

  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<PurchaseHistoryItem, 'id'> & { userId: string; createdAt?: { toDate?: () => Date } }),
    }))
    .map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      paymentMethod: item.paymentMethod,
      deliveryLocation: item.deliveryLocation,
      createdAt: item.createdAt?.toDate ? item.createdAt.toDate().toISOString() : getAuthErrorMessage(new Date().toISOString()),
    }));
};
