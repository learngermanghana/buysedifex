'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type ProductLeadPanelProps = {
  productId: string;
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

export function ProductLeadPanel({ productId, productName, city, storeName, whatsappPhone }: ProductLeadPanelProps) {
  const [formState, setFormState] = useState<CheckoutFormState>(initialFormState);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

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
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          productName,
          customerName: formState.customerName.trim(),
          contact: formState.contact.trim(),
          companyName: formState.companyName.trim(),
          quantity,
          paymentMethod: formState.paymentMethod,
          deliveryLocation: formState.deliveryLocation.trim(),
          notes: formState.notes.trim(),
          pagePath: window.location.pathname,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit checkout request');
      }

      await trackEvent('checkout_request_submit', { productId, productName, quantity, paymentMethod: formState.paymentMethod });
      setSubmitState('success');
      setFormState(initialFormState);
    } catch (error) {
      console.error(error);
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

        <button className="requestButton" type="submit" disabled={submitState === 'submitting'}>
          {submitState === 'submitting' ? 'Submitting checkout...' : 'Place order request'}
        </button>

        {submitState === 'success' ? <p className="requestFeedback success">Checkout request sent successfully.</p> : null}
        {submitState === 'error' ? <p className="requestFeedback error">Unable to submit checkout request. Try again.</p> : null}
      </form>
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
