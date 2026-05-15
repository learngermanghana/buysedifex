'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getPurchaseHistory, signOutCustomer, subscribeToAuth, type PurchaseHistoryItem } from '@/lib/customer-auth';
import { firebaseConfigError } from '@/lib/firebase';

export default function AccountBookingsPage() {
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
      .catch((historyError) => setError(historyError instanceof Error ? historyError.message : 'Unable to load bookings.'))
      .finally(() => setLoadingHistory(false));
  }, [sessionEmail, sessionUserId]);

  const bookings = useMemo(() => history.filter((item) => item.recordType === 'service_booking'), [history]);
  const orderCount = useMemo(() => history.filter((item) => item.recordType !== 'service_booking').length, [history]);

  const statusClass = (status?: string) => {
    const normalized = (status ?? 'pending').toLowerCase();
    if (['confirmed', 'completed', 'success', 'paid', 'captured'].includes(normalized)) return 'success';
    if (['failed', 'rejected', 'cancelled', 'canceled', 'abandoned'].includes(normalized)) return 'error';
    return 'pending';
  };

  return (
    <main className="container accountPage">
      <section className="accountCard">
        <p className="eyebrow">Customer account</p>
        <h1>Service bookings</h1>
        <p>Track service booking requests and payment confirmation from verified Sedifex stores.</p>
        {sessionEmail ? (
          <div>
            <p className="requestFeedback success">Signed in as {sessionEmail}</p>
            <div className="productStoreActions">
              <Link href="/account">Orders{orderCount ? ` (${orderCount})` : ''}</Link>
              <Link href="/account/bookings">Bookings</Link>
            </div>
            <button className="secondaryButton" onClick={() => void signOutCustomer().catch(() => setError('Unable to sign out.'))}>
              Sign out
            </button>
          </div>
        ) : null}
      </section>

      <section className="accountCard">
        <h2>Bookings</h2>
        {loadingAccount ? <p>Loading your account...</p> : null}
        {loadingHistory ? <p>Loading bookings...</p> : null}
        {error ? <p className="requestFeedback error">{error}</p> : null}
        {!sessionEmail ? <p>Sign in from the account page to view your bookings.</p> : null}
        {sessionEmail && !loadingHistory && bookings.length === 0 ? <p>No service bookings yet. Browse services and request a booking.</p> : null}
        {sessionEmail && bookings.length > 0 ? (
          <ul className="historyList">
            {bookings.map((item) => (
              <li key={item.id}>
                <strong>{item.productName}</strong> · {item.paymentMethod}
                <br />
                <small>{item.deliveryLocation}</small>
                <br />
                <small>
                  Ref: {item.reference ?? 'N/A'} · Payment:{' '}
                  <span className={`statusBadge ${statusClass(item.paymentStatus)}`}>{item.paymentStatus ?? 'pending'}</span> · Booking:{' '}
                  <span className={`statusBadge ${statusClass(item.orderStatus)}`}>{item.orderStatus ?? 'pending_store_confirmation'}</span>
                </small>
                <br />
                <small>{new Date(item.createdAt).toLocaleString()}</small>
                {item.reference ? <><br /><Link href={`/account/orders/${encodeURIComponent(item.reference)}`}>View booking details</Link></> : null}
                {item.paymentConfirmedAt ? <><br /><small>Payment confirmed: {new Date(item.paymentConfirmedAt).toLocaleString()}</small></> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
