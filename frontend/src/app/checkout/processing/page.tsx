'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

type PollState = {
  ok?: boolean;
  paymentStatus?: string;
  orderStatus?: string;
  reference?: string;
  error?: string;
  status?: number;
  details?: unknown;
};

const SUCCESS_PAYMENT_STATUSES = new Set(['confirmed', 'success', 'paid', 'captured']);
const SUCCESS_ORDER_STATUSES = new Set(['confirmed', 'success', 'paid', 'completed']);
const FAILED_PAYMENT_STATUSES = new Set(['failed', 'cancelled', 'canceled', 'abandoned', 'verification_failed']);

const normalizeStatus = (value?: string) => value?.trim().toLowerCase() ?? '';

function CheckoutProcessingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const reference = params.get('reference') ?? '';
  const [state, setState] = useState<PollState>({ reference });
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('');

  const paymentStatus = normalizeStatus(state.paymentStatus);
  const orderStatus = normalizeStatus(state.orderStatus);
  const isPaid = SUCCESS_PAYMENT_STATUSES.has(paymentStatus) || SUCCESS_ORDER_STATUSES.has(orderStatus);
  const hasFailed = FAILED_PAYMENT_STATUSES.has(paymentStatus) || FAILED_PAYMENT_STATUSES.has(orderStatus);

  const headline = useMemo(() => {
    if (isPaid) return 'Payment confirmed';
    if (hasFailed) return 'Payment could not be confirmed';
    return 'Payment processing';
  }, [hasFailed, isPaid]);

  useEffect(() => {
    if (!reference) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/integration/orders/${encodeURIComponent(reference)}`, { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as PollState;
        if (!active) return;
        setLastCheckedAt(new Date().toLocaleTimeString());
        setState((current) => ({
          ...current,
          ...payload,
          error: response.ok ? payload.error : payload.error ?? `Order status request failed with ${response.status}`,
          status: response.status,
        }));

        const nextPaymentStatus = normalizeStatus(payload.paymentStatus);
        const nextOrderStatus = normalizeStatus(payload.orderStatus);
        if (SUCCESS_PAYMENT_STATUSES.has(nextPaymentStatus) || SUCCESS_ORDER_STATUSES.has(nextOrderStatus)) {
          if (timer) clearInterval(timer);
          window.setTimeout(() => router.replace(`/checkout/success?reference=${encodeURIComponent(reference)}`), 900);
          return;
        }
        if (FAILED_PAYMENT_STATUSES.has(nextPaymentStatus) || FAILED_PAYMENT_STATUSES.has(nextOrderStatus)) {
          if (timer) clearInterval(timer);
        }
      } catch (error) {
        if (!active) return;
        setLastCheckedAt(new Date().toLocaleTimeString());
        setState((current) => ({
          ...current,
          ok: false,
          error: error instanceof Error ? error.message : 'Unable to check order status',
        }));
      }
    };

    void pollStatus();
    timer = setInterval(pollStatus, 4000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [reference, router]);

  return (
    <main className="container accountPage">
      <section className="accountCard">
        <h1>{headline}</h1>
        {isPaid ? (
          <p>Your payment has been confirmed by Sedifex. Taking you to your confirmation page…</p>
        ) : hasFailed ? (
          <p>Sedifex could not confirm this payment. Please contact support with the reference below.</p>
        ) : (
          <p>Don’t close this page yet; we’re confirming payment with Sedifex.</p>
        )}
        <p>Reference: {reference || 'Missing reference'}</p>
        <p>Payment status: {state.paymentStatus ?? 'pending'}</p>
        <p>Order status: {state.orderStatus ?? 'processing'}</p>
        {lastCheckedAt ? <p>Last checked: {lastCheckedAt}</p> : null}
        {state.error ? <p className="requestFeedback error">Status check error: {state.error}</p> : null}
        <div className="productStoreActions">
          <Link href={`/account/orders/${encodeURIComponent(reference)}`}>View order details</Link>
          <Link href="/contact">WhatsApp / Email support</Link>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutProcessingPage() {
  return (
    <Suspense fallback={<main className="container accountPage"><section className="accountCard"><p>Loading payment details…</p></section></main>}>
      <CheckoutProcessingContent />
    </Suspense>
  );
}
