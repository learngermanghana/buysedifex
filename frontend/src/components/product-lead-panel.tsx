'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { addPurchaseHistoryItem, getSignedInUserId } from '@/lib/customer-auth';

type ProductLeadPanelProps = {
  productId: string;
  merchantId: string;
  productName: string;
  city?: string;
  storeName: string;
  whatsappPhone?: string;
};

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

type CheckoutFormState = {
  customerName: string;
  contact: string;
  companyName: string;
  quantity: string;
  paymentMethod: string;
  deliveryLocation: string;
  notes: string;
};

const initialFormState: CheckoutFormState = {
  customerName: '',
  contact: '',
  companyName: '',
  quantity: '1',
  paymentMethod: 'pay-on-delivery',
  deliveryLocation: '',
  notes: '',
};

const PAYMENT_METHODS = [
  { id: 'pay-on-delivery', label: 'Pay on Delivery' },
  { id: 'mobile-money', label: 'Mobile Money' },
  { id: 'bank-transfer', label: 'Bank Transfer' },
  { id: 'cash', label: 'Cash' },
];

const normalizeWhatsAppPhone = (value?: string) => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const normalized = trimmed.replace(/[^\d]/g, '');
  if (!normalized) {
    return '';
  }

  return `https://wa.me/${normalized}`;
};

const trackEvent = async (eventName: string, payload: Record<string, unknown>) => {
  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName, payload }),
      keepalive: true,
    });
  } catch (error) {
    console.warn('Failed to track event', error);
  }
};

export function ProductLeadPanel({ productId, merchantId, productName, city, storeName, whatsappPhone }: ProductLeadPanelProps) {
  const [formState, setFormState] = useState<CheckoutFormState>(initialFormState);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [checkoutCards, setCheckoutCards] = useState<Array<{ merchantId: string; reference: string; checkoutUrl?: string }>>([]);

  useEffect(() => {
    void trackEvent('product_view', { productId, productName });
  }, [productId, productName]);

  const whatsappMessage = useMemo(() => {
    const message = `Hi ${storeName}, I want to buy ${productName} on Sedifex.\nMy location: ${city?.trim() || 'Please share your location'}.`;
    return encodeURIComponent(message);
  }, [city, productName, storeName]);

  const whatsappHref = normalizeWhatsAppPhone(whatsappPhone);
  const whatsappLinkWithMessage = whatsappHref ? `${whatsappHref}${whatsappHref.includes('?') ? '&' : '?'}text=${whatsappMessage}` : '';

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState('submitting');

    try {
      const quantity = Number(formState.quantity);
      const response = await fetch('/api/integration/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: [{ productId, merchantId, quantity }],
          customer: {
            email: formState.contact.includes('@') ? formState.contact.trim() : undefined,
            phone: formState.contact.includes('@') ? undefined : formState.contact.trim(),
          },
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorPayload?.error ?? 'Failed to submit checkout request');
      }

      const payload = (await response.json()) as { merchantCheckouts?: Array<{ merchantId: string; reference: string; checkoutUrl?: string }> };
      setCheckoutCards(payload.merchantCheckouts ?? []);
      await trackEvent('checkout_create_succeeded', { productId, productName, quantity, paymentMethod: formState.paymentMethod });
      const signedInUserId = getSignedInUserId();
      if (signedInUserId) {
        const firstCheckout = payload.merchantCheckouts?.[0];
        await addPurchaseHistoryItem(signedInUserId, {
          productId,
          productName,
          quantity,
          paymentMethod: formState.paymentMethod,
          deliveryLocation: formState.deliveryLocation.trim(),
          reference: firstCheckout?.reference,
          paymentStatus: 'pending',
          orderStatus: 'pending',
        });
      }
      setSubmitState('success');
      setFormState(initialFormState);
    } catch (error) {
      console.error(error);
      void trackEvent('checkout_create_failed', { productId, productName });
      setSubmitState('error');
    }
  };

  return (
    <aside className="stickyProductActions" aria-label="Buy and checkout options">
      <h3>Buy this product</h3>
      <p className="checkoutHint">Complete checkout here without leaving Sedifex. WhatsApp is for pre-purchase questions.</p>

      <div className="paymentMethodList" aria-label="Available payment methods">
        {PAYMENT_METHODS.map((method) => (
          <span key={method.id} className="paymentChip">
            {method.label}
          </span>
        ))}
      </div>

      <form className="requestForm" onSubmit={onSubmit}>
        <label htmlFor="checkout-name">Full name</label>
        <input
          id="checkout-name"
          name="customerName"
          type="text"
          required
          value={formState.customerName}
          onChange={(event) => setFormState((current) => ({ ...current, customerName: event.target.value }))}
        />

        <label htmlFor="checkout-contact">Phone or email</label>
        <input
          id="checkout-contact"
          name="contact"
          type="text"
          pattern="(^[^\s@]+@[^\s@]+\.[^\s@]+$)|(^[+0-9\s()-]{7,}$)"
          required
          value={formState.contact}
          onChange={(event) => setFormState((current) => ({ ...current, contact: event.target.value }))}
        />

        <label htmlFor="checkout-company">Company name (optional)</label>
        <input
          id="checkout-company"
          name="companyName"
          type="text"
          value={formState.companyName}
          onChange={(event) => setFormState((current) => ({ ...current, companyName: event.target.value }))}
        />

        <label htmlFor="checkout-payment">Payment method</label>
        <select
          id="checkout-payment"
          name="paymentMethod"
          required
          value={formState.paymentMethod}
          onChange={(event) => setFormState((current) => ({ ...current, paymentMethod: event.target.value }))}
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method.id} value={method.id}>
              {method.label}
            </option>
          ))}
        </select>

        <label htmlFor="checkout-delivery-location">Delivery location</label>
        <input
          id="checkout-delivery-location"
          name="deliveryLocation"
          type="text"
          required
          value={formState.deliveryLocation}
          onChange={(event) => setFormState((current) => ({ ...current, deliveryLocation: event.target.value }))}
          placeholder="Town / suburb / landmark"
          minLength={3}
        />

        <label htmlFor="checkout-quantity">Quantity</label>
        <input
          id="checkout-quantity"
          name="quantity"
          type="number"
          min={1}
          step={1}
          required
          value={formState.quantity}
          onChange={(event) => setFormState((current) => ({ ...current, quantity: event.target.value }))}
        />

        <label htmlFor="checkout-notes">Order notes (optional)</label>
        <textarea
          id="checkout-notes"
          name="notes"
          rows={3}
          value={formState.notes}
          onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Color, preferred call time, gate number, etc."
        />

        <button className="requestButton" type="submit" disabled={submitState === 'submitting' || !formState.customerName.trim() || !formState.contact.trim() || !formState.deliveryLocation.trim()}>
          {submitState === 'submitting' ? 'Creating secure checkout...' : 'Continue to secure checkout'}
        </button>

        {submitState === 'success' ? <p className="requestFeedback success">Checkout created. Use the merchant checkout card below to pay.</p> : null}
        {submitState === 'error' ? <p className="requestFeedback error">Unable to create checkout. Check your location/contact or merchant availability.</p> : null}
      </form>
      {checkoutCards.map((card) => (
        <div key={card.reference} className="storeShowcaseCard">
          <strong>Merchant checkout ready</strong>
          <p>Merchant: {card.merchantId}</p>
          <p>Reference: {card.reference}</p>
          {card.checkoutUrl ? <a className="requestButton" href={card.checkoutUrl}>Pay now</a> : <p className="requestFeedback error">Checkout URL unavailable.</p>}
        </div>
      ))}
      <p className="checkoutHint">Payment confirmed only after Sedifex webhook verification.</p>
      <p className="checkoutHint">Need help? <a href="/contact">WhatsApp/email support</a> · <a href="/return-policy">Returns/refunds policy</a></p>
      <p className="checkoutHint">Need clarification before ordering?</p>
      {whatsappLinkWithMessage ? (
        <a
          className="secondaryButton enquiryWhatsAppButton"
          href={whatsappLinkWithMessage}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('whatsapp_enquiry_click', { productId, productName })}
        >
          Ask about this product on WhatsApp
        </a>
      ) : (
        <span className="secondaryButton enquiryWhatsAppButton" aria-disabled="true">
          WhatsApp unavailable for enquiries
        </span>
      )}

    </aside>
  );
}
