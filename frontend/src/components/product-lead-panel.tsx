'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type ProductLeadPanelProps = {
  productId: string;
  productName: string;
  city?: string;
  whatsappHref?: string;
};

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

type RequestFormState = {
  name: string;
  phone: string;
  notes: string;
  quantity: string;
};

const initialFormState: RequestFormState = {
  name: '',
  phone: '',
  notes: '',
  quantity: '1',
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

export function ProductLeadPanel({ productId, productName, city, whatsappHref }: ProductLeadPanelProps) {
  const [formState, setFormState] = useState<RequestFormState>(initialFormState);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  useEffect(() => {
    void trackEvent('product_view', { productId, productName });
  }, [productId, productName]);

  const whatsappMessage = useMemo(() => {
    const message = `Hi, I'm interested in ${productName}.\nIs it available?\n\nI'm located in ${city?.trim() || 'your city'}.`;
    return encodeURIComponent(message);
  }, [city, productName]);

  const whatsappLinkWithMessage = whatsappHref ? `${whatsappHref}?text=${whatsappMessage}` : '';

  const handleWhatsappClick = async () => {
    await trackEvent('whatsapp_click', { productId, productName });
  };

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
          name: formState.name.trim(),
          phone: formState.phone.trim(),
          notes: formState.notes.trim(),
          quantity,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit request');
      }

      await trackEvent('request_submit', { productId, productName, quantity });
      setSubmitState('success');
      setFormState(initialFormState);
    } catch (error) {
      console.error(error);
      setSubmitState('error');
    }
  };

  return (
    <aside className="stickyProductActions">
      {whatsappLinkWithMessage ? (
        <a className="waButton" href={whatsappLinkWithMessage} target="_blank" rel="noopener noreferrer" onClick={handleWhatsappClick}>
          Chat on WhatsApp
        </a>
      ) : (
        <span className="waButton" aria-disabled="true">
          WhatsApp unavailable
        </span>
      )}

      <form className="requestForm" onSubmit={onSubmit}>
        <h3>Request this product</h3>
        <label htmlFor="request-name">Name</label>
        <input
          id="request-name"
          name="name"
          type="text"
          required
          value={formState.name}
          onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
        />

        <label htmlFor="request-phone">Phone</label>
        <input
          id="request-phone"
          name="phone"
          type="tel"
          required
          value={formState.phone}
          onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
        />

        <label htmlFor="request-notes">Notes</label>
        <textarea
          id="request-notes"
          name="notes"
          required
          value={formState.notes}
          onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Share your preference or any extra request details"
        />

        <label htmlFor="request-quantity">Quantity</label>
        <input
          id="request-quantity"
          name="quantity"
          type="number"
          min={1}
          step={1}
          required
          value={formState.quantity}
          onChange={(event) => setFormState((current) => ({ ...current, quantity: event.target.value }))}
        />

        <button className="requestButton" type="submit" disabled={submitState === 'submitting'}>
          {submitState === 'submitting' ? 'Submitting request...' : 'Submit request'}
        </button>

        {submitState === 'success' ? <p className="requestFeedback success">Request submitted successfully.</p> : null}
        {submitState === 'error' ? <p className="requestFeedback error">Unable to submit request. Try again.</p> : null}
      </form>
    </aside>
  );
}
