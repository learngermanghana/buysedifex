'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getPurchaseHistory,
  registerCustomer,
  signInCustomer,
  signOutCustomer,
  subscribeToAuth,
  type PurchaseHistoryItem,
} from '@/lib/customer-auth';
import { firebaseConfigError } from '@/lib/firebase';

const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  pending_cash_collection: 'Pay on delivery',
  pending_delivery: 'Waiting for store delivery',
  pending_store_confirmation: 'Waiting for store confirmation',
  pending_manual: 'Manual payment pending',
  pending_manual_review: 'Manual payment pending',
  pending_payment: 'Waiting for payment',
  pending: 'Processing',
  processing: 'Processing',
  confirmed_by_store: 'Confirmed by store',
  delivered: 'Delivered',
  cash_collected: 'Payment collected on delivery',
  completed: 'Completed',
  success: 'Paid',
  paid: 'Paid',
  confirmed: 'Confirmed',
  cancelled_by_store: 'Cancelled by store',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  failed: 'Failed',
};

const getCustomerStatusLabel = (status?: string) => {
  const normalized = (status ?? 'pending').trim().toLowerCase();
  return CUSTOMER_STATUS_LABELS[normalized] ?? normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};
const shortRef = (reference?: string) => (reference && reference.length > 18 ? `${reference.slice(0, 8)}...${reference.slice(-8)}` : reference ?? 'N/A');
const formatAmount = (amount?: number, currency?: string) => (typeof amount === 'number' && Number.isFinite(amount) ? `${currency || 'GHS'} ${amount.toFixed(2)}` : '');

export default function AccountPage() {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<PurchaseHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(firebaseConfigError);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (firebaseConfigError) return;
    const unsubscribe = subscribeToAuth((user) => {
      setSessionEmail(user?.email ?? null);
      setSessionUserId(user?.uid ?? null);
      setLoadingAccount(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!sessionUserId) {
      setHistory([]);
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);
    void getPurchaseHistory(sessionUserId, sessionEmail)
      .then(setHistory)
      .catch((historyError) => setError(historyError instanceof Error ? historyError.message : 'Unable to load history.'))
      .finally(() => setLoadingHistory(false));
  }, [sessionEmail, sessionUserId]);

  const orderHistory = useMemo(
    () => history.filter((item) => item.recordType !== 'service_booking'),
    [history],
  );
  const bookingCount = useMemo(
    () => history.filter((item) => item.recordType === 'service_booking').length,
    [history],
  );

  const passwordStrengthHint = useMemo(() => {
    if (!password) return '';
    if (password.length < 8) return 'Use at least 8 characters.';
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return 'Add one uppercase letter and one number.';
    return 'Strong password.';
  }, [password]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Full name is required.');
        return;
      }
      if (!/^[+0-9\s()-]{7,}$/.test(phone.trim())) {
        setError('Enter a valid phone number.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      try {
        await registerCustomer({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), password });
      } catch (signupError) {
        setError(signupError instanceof Error ? signupError.message : 'Unable to create account.');
      }
      return;
    }

    if (!(await signInCustomer(email, password))) {
      setError('Invalid email or password.');
      return;
    }
  };

  const statusClass = (status?: string) => {
    const normalized = (status ?? 'pending').toLowerCase();
    if (['confirmed', 'completed', 'success', 'paid', 'captured', 'cash_collected', 'delivered', 'confirmed_by_store'].includes(normalized)) return 'success';
    if (['failed', 'rejected', 'cancelled', 'canceled', 'abandoned', 'cancelled_by_store'].includes(normalized)) return 'error';
    return 'pending';
  };

  return (
    <main className="container accountPage">
      <section className="accountCard">
        <p className="eyebrow">Customer account</p>
        <h1>Sign up or sign in</h1>
        <p>Create a richer account profile so checkout and support are faster, and track your orders and service bookings.</p>

        {sessionEmail ? (
          <div>
            <p className="requestFeedback success">Signed in as {sessionEmail}</p>
            <div className="productStoreActions">
              <Link href="/account">Orders</Link>
              <Link href="/account/bookings">Bookings{bookingCount ? ` (${bookingCount})` : ''}</Link>
            </div>
            <button className="secondaryButton" onClick={() => void signOutCustomer().catch(() => setError('Unable to sign out.'))}>
              Sign out
            </button>
          </div>
        ) : (
          <>
            <div className="accountModeSwitch">
              <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')} type="button">Sign up</button>
              <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')} type="button">Sign in</button>
            </div>
            <form className="requestForm authForm" onSubmit={submit}>
              {mode === 'signup' ? (
                <>
                  <label htmlFor="full-name">Full name</label>
                  <input id="full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={3} placeholder="First and last name" />
                  <label htmlFor="phone">Phone number</label>
                  <input id="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required pattern="[+0-9\s()\-]{7,}" placeholder="+233 20 000 0000" />
                </>
              ) : null}
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@example.com" autoComplete="email" />
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
              {mode === 'signup' ? <p className={`requestFeedback ${passwordStrengthHint === 'Strong password.' ? 'success' : ''}`}>{passwordStrengthHint || 'Use at least 8 characters, including 1 uppercase letter and 1 number.'}</p> : null}
              {mode === 'signup' ? (
                <>
                  <label htmlFor="confirm-password">Confirm password</label>
                  <input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" />
                </>
              ) : null}
              <button className="requestButton" type="submit">{mode === 'signup' ? 'Create account' : 'Sign in'}</button>
              {error ? <p className="requestFeedback error">{error}</p> : null}
            </form>
          </>
        )}
      </section>

      <section className="accountCard">
        <h2>Orders</h2>
        {loadingAccount ? <p>Loading your account...</p> : null}
        {loadingHistory ? <p>Loading orders...</p> : null}
        {!sessionEmail ? <p>Sign in to view your orders and bookings.</p> : null}
        {sessionEmail && !loadingHistory && orderHistory.length === 0 ? <p>No product orders yet. Place an order to start tracking.</p> : null}
        {sessionEmail && orderHistory.length > 0 ? (
          <div className="orderList">
            {orderHistory.map((item) => (
              <article key={item.id} className={`orderRow ${item.imageUrl ? '' : 'orderRow--noImage'}`}>
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.displayName ?? item.productName}
                    className="orderRow__image"
                    width={72}
                    height={72}
                    unoptimized
                  />
                ) : null}
                <div className="orderRow__main">
                  <div className="orderRow__titleLine">
                    <strong className="orderRow__title">{item.displayName ?? item.itemName ?? item.productName}</strong>
                    {formatAmount(item.amount, item.currency) ? <span className="orderRow__amount">{formatAmount(item.amount, item.currency)}</span> : null}
                  </div>
                  <div className="orderRow__meta">
                    {item.storeName && item.storeName !== 'Not provided' ? <span>{item.storeName}</span> : null}
                    <span>{item.recordType === 'service_booking' ? 'Service booking' : 'Product order'}</span>
                    <span>Qty {item.quantity}</span>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                    {item.deliveryLocation && item.deliveryLocation.trim() && item.deliveryLocation.trim().toLowerCase() !== 'not provided' ? (
                      <span>{item.deliveryLocation.trim()}</span>
                    ) : null}
                  </div>
                  <div className="orderRow__status">
                    <span>Payment: <span className={`statusBadge ${statusClass(item.paymentStatus)}`}>{getCustomerStatusLabel(item.paymentStatus)}</span></span>
                    <span>Order: <span className={`statusBadge ${statusClass(item.orderStatus)}`}>{getCustomerStatusLabel(item.orderStatus)}</span></span>
                  </div>
                  <div className="orderRow__reference">Ref: {shortRef(item.reference)}</div>
                </div>
                <div className="orderRow__actions">
                  {item.reference ? <Link href={`/account/orders/${encodeURIComponent(item.reference)}`}>View details</Link> : null}
                  {item.productUrl || item.serviceUrl ? <Link href={item.productUrl ?? item.serviceUrl ?? '#'}>View item/service</Link> : null}
                  {item.storeUrl ? <Link href={item.storeUrl}>View store</Link> : null}
                  <Link href="/contact">Contact support</Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
