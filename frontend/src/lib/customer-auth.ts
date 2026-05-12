import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { auth, db, firebaseConfigError } from '@/lib/firebase';

export type PurchaseHistoryItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  paymentMethod: string;
  deliveryLocation: string;
  createdAt: string;
};

const assertFirebaseReady = () => {
  if (firebaseConfigError || !auth || !db) {
    throw new Error(firebaseConfigError ?? 'Firebase is not configured.');
  }
};

const getAuthErrorMessage = (fallback: string) => fallback;

export const registerCustomer = async (input: { fullName: string; email: string; password: string }) => {
  assertFirebaseReady();
  const credential = await createUserWithEmailAndPassword(auth!, input.email.trim(), input.password);
  if (input.fullName.trim()) {
    await updateProfile(credential.user, { displayName: input.fullName.trim() });
  }
};

export const signInCustomer = async (emailInput: string, password: string): Promise<boolean> => {
  assertFirebaseReady();
  try {
    await signInWithEmailAndPassword(auth!, emailInput.trim(), password);
    return true;
  } catch {
    return false;
  }
};

export const signOutCustomer = async () => {
  assertFirebaseReady();
  await signOut(auth!);
};

export const getSignedInEmail = (): string | null => auth?.currentUser?.email ?? null;
export const getSignedInUserId = (): string | null => auth?.currentUser?.uid ?? null;

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  assertFirebaseReady();
  return onAuthStateChanged(auth!, callback);
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
