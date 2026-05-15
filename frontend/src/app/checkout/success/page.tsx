'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function CheckoutSuccessContent() {
  const params = useSearchParams();
  const reference = params.get('reference') ?? '';

  return (
    <main className="container accountPage">
      <section className="accountCard">
        <p className="eyebrow">Secure Sedifex checkout</p>
        <h1>Payment confirmed</h1>
        <p>Your order has been received. Keep this reference for support or follow-up with the store.</p>
        <p><strong>Reference:</strong> {reference || 'N/A'}</p>
        <div className="featureRow" aria-label="Order trust signals">
          <article className="featureCard"><h2>Verified store</h2><p>This order was placed through a Sedifex-connected store.</p></article>
          <article className="featureCard"><h2>Secure payment</h2><p>Payment confirmation is handled through Sedifex and Paystack.</p></article>
          <article className="featureCard"><h2>Support ready</h2><p>Use your order reference when contacting support.</p></article>
        </div>
        <div className="productStoreActions">
          {reference ? <Link href={`/account/orders/${encodeURIComponent(reference)}`}>View order</Link> : null}
          <Link href="/">Continue shopping</Link>
          <Link href="/contact">Contact support</Link>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<main className="container accountPage"><section className="accountCard"><p>Loading confirmation…</p></section></main>}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
