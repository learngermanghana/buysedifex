'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { addPurchaseHistoryItem, getSignedInCustomerProfile, getSignedInUserId, subscribeToAuth } from '@/lib/customer-auth';

type ProductLeadPanelProps = {
  productId: string;
  merchantId: string;
  productName: string;
  city?: string;
  storeName: string;
  whatsappPhone?: string;
};

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';
type SubmitMode = 'online' | 'delivery' | null;

type CheckoutFormState = {
  customerName: string;
  email: string;
  phone: string;
  quantity: string;
  paymentMethod: string;
  deliveryLocation: string;
  notes: string;
};

const initialFormState: CheckoutFormState = {
  customerName: '',
  email: '',
  phone: '',
  quantity: '1',
  paymentMethod: 'online',
  deliveryLocation: '',
  notes: '',
};

const PAYMENT_METHODS = [
  { id: 'online', label: 'Online Payment (Paystack)' },
  { id: 'pay-on-delivery', label: 'Pay on Delivery' },
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
  const [submitMode, setSubmitMode] = useState<SubmitMode>(null);
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');
  const supportPhone = (whatsappPhone ?? '').trim();

  useEffect(() => {
    void trackEvent('product_view', { productId, productName });
  }, [productId, productName]);

  useEffect(() => {
    const applySignedInProfile = async () => {
      const profile = await getSignedInCustomerProfile();
      if (!profile) return;

      setFormState((current) => ({
        ...current,
        customerName: current.customerName.trim() ? current.customerName : profile.fullName,
        email: current.email.trim() ? current.email : profile.email,
        phone: current.phone.trim() ? current.phone : profile.phone,
      }));
    };

    const unsubscribe = subscribeToAuth(() => {
      void applySignedInProfile();
    });

    void applySignedInProfile();

    return unsubscribe;
  }, []);

  const whatsappMessage = useMemo(() => {
    const message = `Hi ${storeName}, I want to buy ${productName} on Sedifex.\nMy location: ${city?.trim() || 'Please share your location'}.`;
    return encodeURIComponent(message);
  }, [city, productName, storeName]);

  const whatsappHref = normalizeWhatsAppPhone(whatsappPhone);
  const whatsappLinkWithMessage = whatsappHref ? `${whatsappHref}${whatsappHref.includes('?') ? '&' : '?'}text=${whatsappMessage}` : '';

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState('submitting');
    setSubmitErrorMessage('');

    try {
      const quantity = Number(formState.quantity);
      const isOnlinePayment = formState.paymentMethod === 'online';

      let payload: { merchantCheckouts?: Array<{ merchantId: string; reference: string; checkoutUrl?: string }> } = {};
      if (isOnlinePayment) {
        const response = await fetch('/api/integration/checkout/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart: [{ productId, merchantId, quantity }],
            customer: {
              email: formState.email.trim(),
              phone: formState.phone.trim(),
            },
          }),
        });

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorPayload?.error ?? 'Failed to submit checkout request');
        }

        payload = (await response.json()) as { merchantCheckouts?: Array<{ merchantId: string; reference: string; checkoutUrl?: string }> };
        setCheckoutCards(payload.merchantCheckouts ?? []);
      } else {
        setCheckoutCards([]);
      }

      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          productName,
          storeName,
          customerName: formState.customerName.trim(),
          contact: `${formState.phone.trim()} | ${formState.email.trim()}`,
          companyName: storeName,
          quantity,
          paymentMethod: formState.paymentMethod,
          deliveryLocation: formState.deliveryLocation.trim(),
          notes: formState.notes.trim(),
        }),
      });
      setSubmitMode(isOnlinePayment ? 'online' : 'delivery');
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
      const rawMessage = error instanceof Error ? error.message : 'Unable to create checkout at the moment.';
      const userMessage = rawMessage.includes('missing-store-id')
        ? 'This merchant checkout is unavailable right now due to a store setup issue. Please contact support or try another merchant.'
        : rawMessage;
      setSubmitErrorMessage(userMessage);
      void trackEvent('checkout_create_failed', { productId, productName, reason: rawMessage });
      setSubmitState('error');
    }
  };

  return (
    <aside className="stickyProductActions" aria-label="Buy and checkout options">
      <h3>Buy this product</h3>
      <p className="checkoutHint">Complete checkout here without leaving Sedifex. All orders are paid online with Paystack.</p>

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

        <label htmlFor="checkout-email">Email address</label>
        <input
          id="checkout-email"
          name="email"
          type="email"
          required
          value={formState.email}
          onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
          placeholder="name@example.com"
        />

        <label htmlFor="checkout-phone">Phone number</label>
        <input
          id="checkout-phone"
          name="phone"
          type="tel"
          pattern="[+0-9\s()\-]{7,}"
          required
          value={formState.phone}
          onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
          placeholder="+233 20 000 0000"
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

        <button className="requestButton" type="submit" disabled={submitState === 'submitting' || !formState.customerName.trim() || !formState.email.trim() || !formState.phone.trim() || !formState.deliveryLocation.trim()}>
          {submitState === 'submitting' ? (formState.paymentMethod === 'online' ? 'Creating Paystack checkout...' : 'Submitting delivery order...') : (formState.paymentMethod === 'online' ? 'Pay online with Paystack' : 'Place pay-on-delivery order')}
        </button>

        {submitState === 'success' ? <p className="requestFeedback success">Success! Your order has been received and is being processed. {submitMode === 'online' ? 'Please complete your payment using the Paystack checkout below.' : 'You selected pay on delivery and your request has been saved.'} A Sedifex team member will reach out shortly{supportPhone ? `, or call ${supportPhone} to speak directly with Sedifex.` : '.'}</p> : null}
        {submitState === 'error' ? <p className="requestFeedback error">Unable to create checkout. {submitErrorMessage || 'Check your location/contact or merchant availability.'}</p> : null}
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
      <p className="checkoutHint">Need help? <a href="/contact">WhatsApp/email support</a> · <a href="/return-policy">Returns/refunds policy</a>{supportPhone ? ` · Store phone: ${supportPhone}` : ''}</p>
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
