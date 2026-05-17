'use client';

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, firebaseConfigError, getFirebaseAuth } from '@/lib/firebase';

type CustomerProfile = {
  uid: string;
  displayName: string;
  firstName: string;
  email: string;
  phone: string;
  defaultDeliveryLocation: string;
};

type CustomerAuthContextValue = {
  user: User | null;
  profile: CustomerProfile | null;
  isLoading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateCustomerProfile: (updates: Partial<Pick<CustomerProfile, 'displayName' | 'phone' | 'defaultDeliveryLocation'>>) => Promise<void>;
  logout: () => Promise<void>;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);
const PROFILE_COLLECTION = 'marketCustomers';

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] ?? '';
}

function profileFromUser(user: User): CustomerProfile {
  const displayName = user.displayName?.trim() || user.email?.split('@')[0] || 'Customer';
  return {
    uid: user.uid,
    displayName,
    firstName: firstName(displayName),
    email: user.email || '',
    phone: user.phoneNumber || '',
    defaultDeliveryLocation: '',
  };
}

async function upsertCustomerProfile(user: User, extra: Partial<CustomerProfile> = {}) {
  if (!db) return profileFromUser(user);
  const ref = doc(db, PROFILE_COLLECTION, user.uid);
  const existing = await getDoc(ref).catch(() => null);
  const base = profileFromUser(user);
  const existingData = existing?.exists() ? (existing.data() as Partial<CustomerProfile>) : {};
  const profile: CustomerProfile = {
    ...base,
    ...existingData,
    uid: user.uid,
    displayName: extra.displayName?.trim() || existingData.displayName || base.displayName,
    firstName: firstName(extra.displayName?.trim() || existingData.displayName || base.displayName),
    email: user.email || existingData.email || '',
    phone: extra.phone?.trim() || existingData.phone || user.phoneNumber || '',
    defaultDeliveryLocation: extra.defaultDeliveryLocation?.trim() || existingData.defaultDeliveryLocation || '',
  };
  await setDoc(ref, { ...profile, updatedAt: serverTimestamp(), ...(existing?.exists() ? {} : { createdAt: serverTimestamp() }) }, { merge: true });
  return profile;
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth || firebaseConfigError) {
      setIsLoading(false);
      setError(firebaseConfigError || 'Firebase Auth is not configured.');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setError(null);
      if (!nextUser) {
        setProfile(null);
        setIsLoading(false);
        return;
      }
      try {
        const nextProfile = await upsertCustomerProfile(nextUser);
        setProfile(nextProfile);
      } catch (profileError) {
        console.error('Unable to load customer profile', profileError);
        setProfile(profileFromUser(nextUser));
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = useMemo<CustomerAuthContextValue>(() => ({
    user,
    profile,
    isLoading,
    error,
    signInWithGoogle: async () => {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error(firebaseConfigError || 'Firebase Auth is not configured.');
      setError(null);
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const nextProfile = await upsertCustomerProfile(result.user);
      setProfile(nextProfile);
    },
    signInWithEmail: async (email, password) => {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error(firebaseConfigError || 'Firebase Auth is not configured.');
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const nextProfile = await upsertCustomerProfile(result.user);
      setProfile(nextProfile);
    },
    registerWithEmail: async (name, email, password, phone) => {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error(firebaseConfigError || 'Firebase Auth is not configured.');
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(result.user, { displayName: name.trim() });
      const nextProfile = await upsertCustomerProfile(result.user, { displayName: name, phone });
      setProfile(nextProfile);
    },
    resetPassword: async (email) => {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error(firebaseConfigError || 'Firebase Auth is not configured.');
      await sendPasswordResetEmail(auth, email.trim());
    },
    updateCustomerProfile: async (updates) => {
      if (!user) throw new Error('Sign in first.');
      if (updates.displayName?.trim()) await updateProfile(user, { displayName: updates.displayName.trim() });
      const nextProfile = await upsertCustomerProfile(user, updates);
      setProfile(nextProfile);
    },
    logout: async () => {
      const auth = getFirebaseAuth();
      if (!auth) return;
      await signOut(auth);
      setProfile(null);
    },
  }), [error, isLoading, profile, user]);

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) throw new Error('useCustomerAuth must be used inside CustomerAuthProvider');
  return context;
}
