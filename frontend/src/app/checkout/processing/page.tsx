'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type PollState = { paymentStatus?: string; orderStatus?: string; reference?: string; error?: string };

export default function CheckoutProcessingPage() {
  const params = useSearchParams();
  const reference = params.get('reference') ?? '';
  const [state, setState] = useState<PollState>({ reference });

  useEffect(() => {
    if (!reference) return;
    let active = true;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/integration/orders/${encodeURIComponent(reference)}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as PollState;
      if (!active) return;
      setState((current) => ({ ...current, ...payload }));
      if ((payload.paymentStatus ?? '').toLowerCase() === 'confirmed') {
        clearInterval(timer);
      }
    }, 4000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [reference]);

  return (
    <main className="container accountPage">
      <section className="accountCard">
        <h1>Payment processing</h1>
        <p>Don’t close this page yet; we’re confirming payment with Sedifex.</p>
        <p>Reference: {reference || 'Missing reference'}</p>
        <p>Payment status: {state.paymentStatus ?? 'pending'}</p>
        <p>Order status: {state.orderStatus ?? 'processing'}</p>
        <p>If this takes longer than expected, contact support:</p>
        <p><Link href="/contact">WhatsApp / Email support</Link></p>
      </section>
    </main>
  );
}
