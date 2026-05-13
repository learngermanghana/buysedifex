'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const getFirstValue = (params: URLSearchParams, keys: string[]) => {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return '';
};

function CheckoutReturnContent() {
  const params = useSearchParams();
  const reference = getFirstValue(params, ['reference', 'orderReference', 'clientOrderId', 'bookingId']);
  const paymentStatus = getFirstValue(params, ['paymentStatus', 'status']);

  const processingHref = reference
    ? `/checkout/processing?reference=${encodeURIComponent(reference)}`
    : '/checkout/processing';

  return (
    <main className="container accountPage">
      <section className="accountCard">
        <h1>Payment return received</h1>
        <p>Thanks for completing checkout. We’re finalizing your order confirmation.</p>
        <p>Reference: {reference || 'Missing reference'}</p>
        <p>Payment status: {paymentStatus || 'pending'}</p>
        <p>
          <Link href={processingHref}>Continue to payment processing</Link>
        </p>
      </section>
    </main>
  );
}

export default function CheckoutReturnPage() {
  return (
    <Suspense
      fallback={
        <main className="container accountPage">
          <section className="accountCard">
            <p>Loading checkout return…</p>
          </section>
        </main>
      }
    >
      <CheckoutReturnContent />
    </Suspense>
  );
}
