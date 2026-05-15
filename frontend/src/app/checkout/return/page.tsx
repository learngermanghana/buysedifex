'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

const getFirstValue = (params: URLSearchParams, keys: string[]) => {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return '';
};

function CheckoutReturnContent() {
  const router = useRouter();
  const params = useSearchParams();
  const reference = getFirstValue(params, ['reference', 'orderReference', 'clientOrderId', 'bookingId']);
  const paymentStatus = getFirstValue(params, ['paymentStatus', 'status']);

  const processingHref = reference
    ? `/checkout/processing?reference=${encodeURIComponent(reference)}`
    : '/checkout/processing';

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(processingHref);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [processingHref, router]);

  return (
    <main className="container accountPage">
      <section className="accountCard">
        <h1>Payment return received</h1>
        <p>Thanks for completing checkout. We’re taking you to payment processing automatically.</p>
        <p>Reference: {reference || 'Missing reference'}</p>
        <p>Payment status: {paymentStatus || 'pending'}</p>
        <p>Redirecting to payment processing…</p>
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
