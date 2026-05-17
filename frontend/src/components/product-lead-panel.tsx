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
  itemType?: string;
  price?: number | null;
  currency?: string;
};

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';
type SubmitMode = 'online' | 'delivery' | 'manual_booking' | null;

type CheckoutFormState = {
  customerName: string;
  email: string;
  phone: string;
  quantity: string;
  paymentMethod: string;
  deliveryLocation: string;
  preferredDate: string;
  preferredTime: string;
  preferredBranch: string;
  notes: string;
};

const createInitialFormState = (): CheckoutFormState => ({
  customerName: '',
  email: '',
  phone: '',
  quantity: '1',
  paymentMethod: 'online',
  deliveryLocation: '',
  preferredDate: '',
  preferredTime: '',
  preferredBranch: '',
  notes: '',
});

const PRODUCT_PAYMENT_METHODS = [
  { id: 'online', label: 'Online Payment (Paystack)' },
  { id: 'pay-on-delivery', label: 'Pay on Delivery' },
];

const SERVICE_PAYMENT_METHODS = [
  { id: 'online', label: 'Pay online now (Paystack)' },
  { id: 'manual', label: 'Request booking / pay later' },
];

const normalizeWhatsAppPhone = (value?: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const normalized = trimmed.replace(/[^\d]/g, '');
  return normalized ? `https://wa.me/${normalized}` : '';
};

const normalizeCheckoutQuantity = (value: string) => {
  const quantity = Math.floor(Number(value));
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be at least 1.');
  return quantity;
};

const normalizeCheckoutItemType = (value?: string): 'PRODUCT' | 'SERVICE' => {
  return value?.trim().toLowerCase() === 'service' ? 'SERVICE' : 'PRODUCT';
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

export function ProductLeadPanel({ productId, merchantId, productName, city, storeName, whatsappPhone, itemType, price, currency }: ProductLeadPanelProps) {
  const isService = normalizeCheckoutItemType(itemType) === 'SERVICE';
  const [formState, setFormState] = useState<CheckoutFormState>(() => createInitialFormState());
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [checkoutCards, setCheckoutCards] = useState<Array<{ merchantId: string; reference: string; checkoutUrl?: string; bookingId?: string; recordType?: string }>>([]);
  const [submitMode, setSubmitMode] = useState<SubmitMode>(null);
  const [manualReference, setManualReference] = useState('');
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');
  const supportPhone = (whatsappPhone ?? '').trim();
  const paymentMethods = isService ? SERVICE_PAYMENT_METHODS : PRODUCT_PAYMENT_METHODS;

  useEffect(() => {
    void trackEvent(isService ? 'service_view' : 'product_view', { productId, productName });
  }, [isService, productId, productName]);

  useEffect(() => {
    setFormState((current) => ({ ...createInitialFormState(), customerName: current.customerName, email: current.email, phone: current.phone }));
  }, [isService]);

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

    const unsubscribe = subscribeToAuth(() => void applySignedInProfile());
    void applySignedInProfile();
    return unsubscribe;
  }, []);

  const whatsappMessage = useMemo(() => {
    const action = isService ? 'book' : 'buy';
    const noun = isService ? 'service' : 'product';
    const message = `Hi ${storeName}, I want to ${action} ${productName} on Sedifex.\nMy ${isService ? 'preferred branch/location' : 'location'}: ${city?.trim() || 'Please share your location'}.`;
    return encodeURIComponent(message.replace('service product', noun));
  }, [city, isService, productName, storeName]);

  const whatsappHref = normalizeWhatsAppPhone(whatsappPhone);
  const whatsappLinkWithMessage = whatsappHref ? `${whatsappHref}${whatsappHref.includes('?') ? '&' : '?'}text=${whatsappMessage}` : '';

  const isSubmitDisabled =
    submitState === 'submitting' ||
    !formState.customerName.trim() ||
    !formState.email.trim() ||
    !formState.phone.trim() ||
    (isService
      ? !formState.preferredDate.trim() || !formState.preferredTime.trim()
      : !formState.deliveryLocation.trim());

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState('submitting');
    setSubmitErrorMessage('');
    setManualReference('');

    try {
      const quantity = isService ? 1 : normalizeCheckoutQuantity(formState.quantity);
      const checkoutType = normalizeCheckoutItemType(itemType);
      const isOnlinePayment = formState.paymentMethod === 'online';
      let payload: { merchantCheckouts?: Array<{ merchantId: string; reference: string; checkoutUrl?: string; bookingId?: string; recordType?: string }> } = {};

      if (isOnlinePayment) {
        const response = await fetch('/api/integration/checkout/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart: [{ productId, merchantId, quantity, type: checkoutType }],
            customer: {
              name: formState.customerName.trim(),
              email: formState.email.trim(),
              phone: formState.phone.trim(),
            },
            booking: isService
              ? {
                  preferredDate: formState.preferredDate.trim(),
                  preferredTime: formState.preferredTime.trim(),
                  preferredBranch: formState.preferredBranch.trim(),
                  notes: formState.notes.trim(),
                }
              : undefined,
          }),
        });
        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorPayload?.error ?? 'Failed to submit checkout request');
        }
        payload = (await response.json()) as typeof payload;
        setCheckoutCards(payload.merchantCheckouts ?? []);
      } else if (isService) {
        const response = await fetch('/api/integration/bookings/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantId,
            serviceId: productId,
            serviceName: productName,
            customer: {
              name: formState.customerName.trim(),
              email: formState.email.trim(),
              phone: formState.phone.trim(),
            },
            booking: {
              preferredDate: formState.preferredDate.trim(),
              preferredTime: formState.preferredTime.trim(),
              preferredBranch: formState.preferredBranch.trim(),
              notes: formState.notes.trim(),
            },
            payment: { mode: 'manual', currency: 'GHS' },
          }),
        });
        const manualPayload = (await response.json().catch(() => null)) as { reference?: string; error?: string } | null;
        if (!response.ok) throw new Error(manualPayload?.error ?? 'Failed to submit booking request');
        setManualReference(manualPayload?.reference ?? '');
        payload = { merchantCheckouts: manualPayload?.reference ? [{ merchantId, reference: manualPayload.reference, recordType: 'service_booking' }] : [] };
        setCheckoutCards([]);
      } else {
        const response = await fetch('/api/integration/orders/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantId,
            productId,
            productName,
            quantity,
            unitPrice: price ?? null,
            currency: currency ?? 'GHS',
            customer: {
              name: formState.customerName.trim(),
              email: formState.email.trim(),
              phone: formState.phone.trim(),
            },
            delivery: {
              location: formState.deliveryLocation.trim(),
              notes: formState.notes.trim(),
            },
          }),
        });
        const orderPayload = (await response.json().catch(() => null)) as { reference?: string; error?: string } | null;
        if (!response.ok) throw new Error(orderPayload?.error ?? 'Failed to submit pay-on-delivery order');
        setManualReference(orderPayload?.reference ?? '');
        payload = { merchantCheckouts: orderPayload?.reference ? [{ merchantId, reference: orderPayload.reference, recordType: 'product_order' }] : [] };
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
          deliveryLocation: isService ? formState.preferredBranch.trim() : formState.deliveryLocation.trim(),
          bookingDate: formState.preferredDate.trim(),
          bookingTime: formState.preferredTime.trim(),
          notes: formState.notes.trim(),
          itemType: checkoutType,
        }),
      });

      const nextSubmitMode: SubmitMode = isOnlinePayment ? 'online' : isService ? 'manual_booking' : 'delivery';
      setSubmitMode(nextSubmitMode);
      await trackEvent(isService ? 'booking_create_succeeded' : 'checkout_create_succeeded', { productId, productName, quantity, paymentMethod: formState.paymentMethod });

      const signedInUserId = getSignedInUserId();
      if (signedInUserId) {
        const firstCheckout = payload.merchantCheckouts?.[0];
        await addPurchaseHistoryItem(signedInUserId, {
          productId,
          productName,
          quantity,
          paymentMethod: formState.paymentMethod,
          deliveryLocation: isService ? `${formState.preferredDate} ${formState.preferredTime} ${formState.preferredBranch}`.trim() : formState.deliveryLocation.trim(),
          reference: firstCheckout?.reference,
          paymentStatus: isOnlinePayment ? 'pending' : isService ? 'pending_manual' : 'pending_cash_collection',
          orderStatus: isService ? 'pending_store_confirmation' : 'pending_delivery',
        });
      }

      setSubmitState('success');
      setFormState(createInitialFormState());
    } catch (error) {
      console.error(error);
      const rawMessage = error instanceof Error ? error.message : isService ? 'Unable to create booking at the moment.' : 'Unable to create checkout at the moment.';
      const userMessage = rawMessage.includes('missing-store-id')
        ? 'This merchant checkout is unavailable right now due to a store setup issue. Please contact support or try another merchant.'
        : rawMessage.includes('valid checkout total could not be computed')
          ? 'This item is missing a valid Sedifex product/service ID or price. Please contact support or try another item.'
          : rawMessage;
      setSubmitErrorMessage(userMessage);
      void trackEvent(isService ? 'booking_create_failed' : 'checkout_create_failed', { productId, productName, reason: rawMessage });
      setSubmitState('error');
    }
  };

  return (
    <aside className="stickyProductActions" aria-label={isService ? 'Book service options' : 'Buy and checkout options'}>
      <h3>{isService ? 'Book this service' : 'Buy this product'}</h3>
      <p className="checkoutHint">
        {isService
          ? 'Choose your preferred date and time. The store will confirm your booking after payment or manual review.'
          : 'Complete checkout here without leaving Sedifex. Online orders are paid with Paystack. Pay on delivery is free during launch.'}
      </p>

      <div className="paymentMethodList" aria-label="Available payment methods">
        {paymentMethods.map((method) => <span key={method.id} className="paymentChip">{method.label}</span>)}
      </div>

      <form id="service-booking-form" className="requestForm" onSubmit={onSubmit}>
        <label htmlFor="checkout-name">Full name</label>
        <input id="checkout-name" name="customerName" type="text" required value={formState.customerName} onChange={(event) => setFormState((current) => ({ ...current, customerName: event.target.value }))} />

        <label htmlFor="checkout-email">Email address</label>
        <input id="checkout-email" name="email" type="email" required value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} placeholder="name@example.com" />

        <label htmlFor="checkout-phone">Phone number</label>
        <input id="checkout-phone" name="phone" type="tel" pattern="[+0-9\s()\-]{7,}" required value={formState.phone} onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))} placeholder="+233 20 000 0000" />

        <label htmlFor="checkout-payment">Payment method</label>
        <select id="checkout-payment" name="paymentMethod" required value={formState.paymentMethod} onChange={(event) => setFormState((current) => ({ ...current, paymentMethod: event.target.value }))}>
          {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}
        </select>

        {isService ? (
          <>
            <label htmlFor="booking-date">Preferred booking date</label>
            <input id="booking-date" name="preferredDate" type="date" min={new Date().toISOString().split('T')[0]} required value={formState.preferredDate} onChange={(event) => setFormState((current) => ({ ...current, preferredDate: event.target.value }))} />

            <label htmlFor="booking-time">Preferred booking time</label>
            <input id="booking-time" name="preferredTime" type="time" required value={formState.preferredTime} onChange={(event) => setFormState((current) => ({ ...current, preferredTime: event.target.value }))} />

            <label htmlFor="booking-branch">Branch / location</label>
            <input id="booking-branch" name="preferredBranch" type="text" value={formState.preferredBranch} onChange={(event) => setFormState((current) => ({ ...current, preferredBranch: event.target.value }))} placeholder="Branch, town, or location preference" />
          </>
        ) : (
          <>
            <label htmlFor="checkout-delivery-location">Delivery location</label>
            <input id="checkout-delivery-location" name="deliveryLocation" type="text" required value={formState.deliveryLocation} onChange={(event) => setFormState((current) => ({ ...current, deliveryLocation: event.target.value }))} placeholder="Town / suburb / landmark" minLength={3} />

            <label htmlFor="checkout-quantity">Quantity</label>
            <input id="checkout-quantity" name="quantity" type="number" min={1} step={1} required value={formState.quantity} onChange={(event) => setFormState((current) => ({ ...current, quantity: event.target.value }))} />
          </>
        )}

        <label htmlFor="checkout-notes">{isService ? 'Booking notes (optional)' : 'Order notes (optional)'}</label>
        <textarea id="checkout-notes" name="notes" rows={3} value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} placeholder={isService ? 'Special request, preferred staff, branch details, etc.' : 'Color, preferred call time, gate number, etc.'} />

        <button className="requestButton" type="submit" disabled={isSubmitDisabled}>
          {submitState === 'submitting'
            ? isService
              ? formState.paymentMethod === 'online' ? 'Creating booking checkout...' : 'Submitting booking request...'
              : formState.paymentMethod === 'online' ? 'Creating Paystack checkout...' : 'Submitting delivery order...'
            : isService
              ? formState.paymentMethod === 'online' ? 'Pay now & request booking' : 'Request booking'
              : formState.paymentMethod === 'online' ? 'Pay online with Paystack' : 'Place pay-on-delivery order'}
        </button>

        {submitState === 'success' ? (
          <p className="requestFeedback success">
            {isService
              ? `Booking request received${manualReference ? ` — Reference: ${manualReference}` : ''}. ${submitMode === 'online' ? 'Payment checkout created. After payment, the store will confirm your selected time.' : 'The store will review and confirm your preferred time.'}`
              : `Success! Your order has been received and is being processed${manualReference ? ` — Reference: ${manualReference}` : ''}. ${submitMode === 'online' ? 'Please complete your payment using the Paystack checkout below.' : 'You selected pay on delivery. The store will collect payment directly during delivery. Sedifex charges no fee for pay on delivery during launch.'}`}
            {' '}A Sedifex team member will reach out shortly{supportPhone ? `, or call ${supportPhone} to speak directly with the store.` : '.'}
          </p>
        ) : null}
        {submitState === 'error' ? <p className="requestFeedback error">{isService ? 'Unable to create booking.' : 'Unable to create checkout.'} {submitErrorMessage || 'Check your contact details or merchant availability.'}</p> : null}
      </form>

      {checkoutCards.map((card) => (
        <div key={card.reference} className="storeShowcaseCard">
          <strong>{isService ? 'Booking checkout ready' : 'Merchant checkout ready'}</strong>
          <p>Merchant: {card.merchantId}</p>
          <p>Reference: {card.reference}</p>
          {card.checkoutUrl ? <a className="requestButton" href={card.checkoutUrl}>{isService ? 'Pay now & request booking' : 'Pay now'}</a> : <p className="requestFeedback error">Checkout URL unavailable.</p>}
        </div>
      ))}

      <p className="checkoutHint">Payment confirmed only after Sedifex webhook verification.</p>
      <p className="checkoutHint">Need help? <a href="/contact">WhatsApp/email support</a> · <a href={isService ? '/services' : '/return-policy'}>{isService ? 'Browse more services' : 'Returns/refunds policy'}</a>{supportPhone ? ` · Store phone: ${supportPhone}` : ''}</p>
      <p className="checkoutHint">Need clarification before {isService ? 'booking' : 'ordering'}?</p>
      {whatsappLinkWithMessage ? (
        <a className="secondaryButton enquiryWhatsAppButton" href={whatsappLinkWithMessage} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('whatsapp_enquiry_click', { productId, productName, itemType: isService ? 'service' : 'product' })}>
          Ask about this {isService ? 'service' : 'product'} on WhatsApp
        </a>
      ) : <span className="secondaryButton enquiryWhatsAppButton" aria-disabled="true">WhatsApp unavailable for enquiries</span>}
    </aside>
  );
}
