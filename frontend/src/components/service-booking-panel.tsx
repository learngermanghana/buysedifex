'use client';
import { FormEvent, useEffect, useState } from 'react';

type Props = { productId: string; merchantId: string; productName: string; price?: number | null; currency?: string; whatsappPhone?: string };
type Slot = { id: string; label?: string; bookingDate?: string; bookingTime?: string; seatsRemaining?: number };

const formatMoney = (value?: number | null, currency = 'GHS') => (typeof value === 'number' ? `${currency.toUpperCase() === 'GHS' ? 'GH₵' : currency.toUpperCase()} ${value.toFixed(2)}` : 'Price confirmed by store');

export function ServiceBookingPanel({ productId, merchantId, productName, price, currency = 'GHS', whatsappPhone }: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [message, setMessage] = useState('');
  const [state, setState] = useState({ fullName: '', email: '', phone: '', preferredDate: '', preferredTime: '', preferredBranch: '', notes: '', paymentMethod: 'online', slotId: '' });
  const isOnline = state.paymentMethod === 'online';
  const whatsappHref = whatsappPhone ? `https://wa.me/${whatsappPhone.replace(/[^\d]/g, '')}` : '';

  useEffect(() => {
    const load = async () => {
      setLoadingSlots(true);
      try {
        const response = await fetch(`/api/integration/bookings/request?merchantId=${encodeURIComponent(merchantId)}&serviceId=${encodeURIComponent(productId)}`);
        if (!response.ok) return;
        const data = (await response.json()) as { slots?: Slot[] };
        setSlots(Array.isArray(data.slots) ? data.slots : []);
      } finally { setLoadingSlots(false); }
    };
    if (merchantId && productId) void load();
  }, [merchantId, productId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('Submitting...');
    const customer = { name: state.fullName.trim(), email: state.email.trim(), phone: state.phone.trim() };
    const booking = { preferredDate: state.preferredDate, preferredTime: state.preferredTime, preferredBranch: state.preferredBranch, notes: state.notes };
    const response = await fetch(isOnline ? '/api/integration/checkout/create' : '/api/integration/bookings/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isOnline ? { cart: [{ productId, merchantId, quantity: 1, type: 'SERVICE' }], customer, booking } : { merchantId, serviceId: productId, serviceName: productName, slotId: state.slotId || undefined, customer, booking, payment: { mode: 'manual', currency } }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data?.error || 'Unable to submit booking request.');
    if (isOnline) {
      const checkoutUrl = data?.merchantCheckouts?.[0]?.checkoutUrl;
      setMessage(checkoutUrl ? 'Redirecting to Paystack checkout...' : 'Booking created. Complete payment from your checkout link.');
      if (checkoutUrl) window.location.href = checkoutUrl as string;
      return;
    }
    setMessage(`Booking request sent${data?.reference ? ` (${data.reference})` : ''}.`);
  };

  return (
    <aside className="serviceBookingPanel" aria-label="Service booking options">
      <p className="eyebrow">Booking</p><h3>Book this service</h3><p className="productCartPrice">{formatMoney(price, currency)}</p>
      <p className="checkoutHint">Choose a preferred date and time. The store will confirm your booking.</p>
      <form onSubmit={submit} className="leadForm">
        <label>Full name<input required value={state.fullName} onChange={(e) => setState((s) => ({ ...s, fullName: e.target.value }))} /></label>
        <label>Email<input type="email" required value={state.email} onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))} /></label>
        <label>Phone<input required value={state.phone} onChange={(e) => setState((s) => ({ ...s, phone: e.target.value }))} /></label>
        {slots.length > 0 && <label>Available slots<select value={state.slotId} onChange={(e) => { const slot = slots.find((item) => item.id === e.target.value); setState((s) => ({ ...s, slotId: e.target.value, preferredDate: slot?.bookingDate || s.preferredDate, preferredTime: slot?.bookingTime || s.preferredTime })); }}><option value="">Select a slot</option>{slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label || `${slot.bookingDate || ''} ${slot.bookingTime || ''}`.trim()} {typeof slot.seatsRemaining === 'number' ? `(${slot.seatsRemaining} left)` : ''}</option>)}</select></label>}
        <label>Preferred date<input type="date" required value={state.preferredDate} onChange={(e) => setState((s) => ({ ...s, preferredDate: e.target.value }))} /></label>
        <label>Preferred time<input type="time" required value={state.preferredTime} onChange={(e) => setState((s) => ({ ...s, preferredTime: e.target.value }))} /></label>
        <label>Branch / location<input value={state.preferredBranch} onChange={(e) => setState((s) => ({ ...s, preferredBranch: e.target.value }))} /></label>
        <label>Notes<textarea value={state.notes} onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))} /></label>
        <fieldset><legend>Payment method</legend><label><input type="radio" checked={isOnline} onChange={() => setState((s) => ({ ...s, paymentMethod: 'online' }))} /> Pay now with Paystack</label><label><input type="radio" checked={!isOnline} onChange={() => setState((s) => ({ ...s, paymentMethod: 'manual' }))} /> Request booking / pay later</label></fieldset>
        <button type="submit" className="requestButton">{isOnline ? 'Pay now & book' : 'Request booking'}</button>
        {whatsappHref && <a className="secondaryButton" href={whatsappHref} target="_blank" rel="noopener noreferrer">Enquire on WhatsApp</a>}
        {loadingSlots && <p className="checkoutHint">Checking available slots...</p>}
        {message && <p className="requestFeedback">{message}</p>}
      </form>
    </aside>
  );
}
