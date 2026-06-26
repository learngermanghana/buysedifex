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
const MAX_POLL_ATTEMPTS = 10;
const HIDDEN_TAB_RETRY_MS = 30_000;

const normalizeStatus = (value?: string) => value?.trim().toLowerCase() ?? '';

const getNextPollDelay = (attempt: number) => {
  if (attempt <= 1) return 5_000;
  if (attempt <= 3) return 10_000;
  if (attempt <= 5) return 15_000;
  return 30_000;
};

function CheckoutProcessingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const reference = params.get('reference') ?? '';
  const [state, setState] = useState<PollState>({ reference });
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('');
  const [automaticChecksPaused, setAutomaticChecksPaused] = useState(false);

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
    let inFlight = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    const clearPollTimer = () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
    };

    const schedulePoll = (delay: number) => {
      if (!active) return;
      clearPollTimer();
      timer = setTimeout(() => {
        void pollStatus();
      }, delay);
    };

    const pollStatus = async () => {
      if (!active || inFlight) return;

      if (document.visibilityState === 'hidden') {
        schedulePoll(HIDDEN_TAB_RETRY_MS);
        return;
      }

      if (attempt >= MAX_POLL_ATTEMPTS) {
        setAutomaticChecksPaused(true);
        return;
      }

      attempt += 1;
      inFlight = true;
      let shouldContinue = true;

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
        const paid = SUCCESS_PAYMENT_STATUSES.has(nextPaymentStatus) || SUCCESS_ORDER_STATUSES.has(nextOrderStatus);
        const failed = FAILED_PAYMENT_STATUSES.has(nextPaymentStatus) || FAILED_PAYMENT_STATUSES.has(nextOrderStatus);

        if (paid) {
          shouldContinue = false;
          redirectTimer = setTimeout(() => {
            router.replace(`/checkout/success?reference=${encodeURIComponent(reference)}`);
          }, 900);
        } else if (failed) {
          shouldContinue = false;
        }
      } catch (error) {
        if (!active) return;
        setLastCheckedAt(new Date().toLocaleTimeString());
        setState((current) => ({
          ...current,
          ok: false,
          error: error instanceof Error ? error.message : 'Unable to check order status',
        }));
      } finally {
        inFlight = false;
        if (!active || !shouldContinue) return;

        if (attempt >= MAX_POLL_ATTEMPTS) {
          setAutomaticChecksPaused(true);
          return;
        }

        schedulePoll(getNextPollDelay(attempt));
      }
    };

    const handleVisibilityChange = () => {
      if (!active || document.visibilityState !== 'visible' || inFlight || attempt >= MAX_POLL_ATTEMPTS) return;
      clearPollTimer();
      void pollStatus();
    };

    setAutomaticChecksPaused(false);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void pollStatus();

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearPollTimer();
      if (redirectTimer) clearTimeout(redirectTimer);
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
        {automaticChecksPaused && !isPaid && !hasFailed ? (
          <p>Payment confirmation is taking longer than expected. Automatic checks have paused; open the order details to refresh the status.</p>
        ) : null}
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
