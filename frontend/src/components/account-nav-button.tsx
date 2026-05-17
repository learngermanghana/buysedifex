'use client';

import Link from 'next/link';
import { useCustomerAuth } from './customer-auth-provider';

type CustomerProfile = { name?: string; email?: string; phone?: string };
const PROFILE_KEY = 'sedifexmarket_customer_v1';

function firstName(value?: string) {
  const normalized = value?.trim();
  if (!normalized) return '';
  return normalized.split(/\s+/)[0] ?? '';
}

export function saveMarketCustomerProfile(profile: CustomerProfile) {
  if (typeof window === 'undefined') return;
  const cleanProfile = { name: profile.name?.trim() || '', email: profile.email?.trim() || '', phone: profile.phone?.trim() || '' };
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(cleanProfile));
  window.dispatchEvent(new CustomEvent('sedifexmarket:customer-profile-updated', { detail: cleanProfile }));
}

export function AccountNavButton() {
  const { profile, user, isLoading } = useCustomerAuth();
  const name = firstName(profile?.displayName || user?.displayName || user?.email || '');
  const label = isLoading ? 'Account' : name ? `Hi, ${name}` : 'Account';

  return (
    <Link href={user ? '/account' : '/account/login'} className="accountNavButton" aria-label={label}>
      <span aria-hidden="true">👤</span>
      <span>{label}</span>
      <span aria-hidden="true">⌄</span>
    </Link>
  );
}
