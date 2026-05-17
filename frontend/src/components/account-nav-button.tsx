'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type CustomerProfile = {
  name?: string;
  email?: string;
  phone?: string;
};

const PROFILE_KEY = 'sedifexmarket_customer_v1';

function firstName(value?: string) {
  const normalized = value?.trim();
  if (!normalized) return '';
  return normalized.split(/\s+/)[0] ?? '';
}

export function saveMarketCustomerProfile(profile: CustomerProfile) {
  if (typeof window === 'undefined') return;
  const cleanProfile = {
    name: profile.name?.trim() || '',
    email: profile.email?.trim() || '',
    phone: profile.phone?.trim() || '',
  };
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(cleanProfile));
  window.dispatchEvent(new CustomEvent('sedifexmarket:customer-profile-updated', { detail: cleanProfile }));
}

export function AccountNavButton() {
  const [profile, setProfile] = useState<CustomerProfile>({});

  useEffect(() => {
    const readProfile = () => {
      try {
        const saved = window.localStorage.getItem(PROFILE_KEY);
        if (!saved) {
          setProfile({});
          return;
        }
        const parsed = JSON.parse(saved) as CustomerProfile;
        setProfile(parsed || {});
      } catch {
        setProfile({});
      }
    };

    readProfile();
    window.addEventListener('sedifexmarket:customer-profile-updated', readProfile);
    window.addEventListener('storage', readProfile);
    return () => {
      window.removeEventListener('sedifexmarket:customer-profile-updated', readProfile);
      window.removeEventListener('storage', readProfile);
    };
  }, []);

  const label = useMemo(() => {
    const name = firstName(profile.name);
    return name ? `Hi, ${name}` : 'Account';
  }, [profile.name]);

  return (
    <Link href="/account" className="accountNavButton" aria-label={label}>
      <span aria-hidden="true">👤</span>
      <span>{label}</span>
      <span aria-hidden="true">⌄</span>
    </Link>
  );
}
