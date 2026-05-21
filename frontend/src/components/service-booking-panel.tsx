'use client';
import { FormEvent, useEffect, useState } from 'react';
import './service-booking-panel.css';

type ListingKind = 'service' | 'course';
type Props = {
  productId: string;
  merchantId: string;
  productName: string;
  price?: number | null;
  currency?: string;
  whatsappPhone?: string;
  storeName?: string;
  storeWebsiteUrl?: string;
  listingType?: string;
  itemType?: string;
};
type Slot = { id: string; startAt?: string; endAt?: string; timezone?: string; seatsRemaining?: number; location?: string; serviceName?: string; description?: string; registrationMode?: string; price?: number | null; depositAmount?: number | null };

const formatMoney = (value?: number | null, currency = 'GHS') => (typeof value === 'number' ? `${currency.toUpperCase() === 'GHS' ? 'GH₵' : currency.toUpperCase()} ${value.toFixed(2)}` : 'Price confirmed by store');

const resolveListingKind = (input: Pick<Props, 'listingType' | 'itemType'>): ListingKind => {
  const values = [input.listingType, input.itemType].map((value) => (value ?? '').trim().toLowerCase());
  return values.includes('course') ? 'course' : 'service';
};

const isValidHttpUrl = (value?: string): value is string => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const channelCopy = (kind: ListingKind, storeName?: string) => {
  const businessLabel = kind === 'course' ? 'school' : 'business';
  const actionNoun = kind === 'course' ? 'registration' : 'booking';
  const verb = kind === 'course' ? 'register' : 'book';
  const websiteButton = kind === 'course' ? 'Visit school website' : 'Visit business website';
  const title = kind === 'course' ? 'Register through the school website' : 'Book through the business website';
  const intro = kind === 'course'
    ? `Visit ${storeName || 'the school'} website, open the registration or courses page, select this course, and complete your application or payment online.`
    : `Visit ${storeName || 'the business'} website, open the booking or services page, select this service, and complete your booking or payment online.`;
  const sedifexNote = kind === 'course'
    ? 'Online registrations and payments from this school are connected to Sedifex, so the school receives your details automatically.'
    : 'Online bookings and payments from this business are connected to Sedifex, so the business receives your request automatically.';
  const steps = kind === 'course'
    ? ['Visit the school website.', 'Open Registration, Courses, or Apply.', 'Select this course.', 'Submit your application or payment online.', 'The school receives your details through Sedifex.']
    : ['Visit the business website.', 'Open Booking, Services, or Appointments.', 'Select this service.', 'Submit your booking or payment online.', 'The business receives your request through Sedifex.'];
  return { businessLabel, actionNoun, verb, websiteButton, title, intro, sedifexNote, steps };
};

export function ServiceBookingPanel({ productId, merchantId, productName, price, currency = 'GHS', whatsappPhone, storeName, storeWebsiteUrl, listingType, itemType }: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [message, setMessage] = useState('');
  const [showSedifexForm, setShowSedifexForm] = useState(false);
  const [state, setState] = useState({ fullName: '', email: '', phone: '', preferredDate: '', preferredTime: '', preferredBranch: '', notes: '', paymentMethod: 'manual', slotId: '' });
  const listingKind = resolveListingKind({ listingType, itemType });
  const copy = channelCopy(listingKind, storeName);
  const slotsAvailable = slots.length > 0;
  const isOnline = state.paymentMethod === 'online';
  const whatsappHref = whatsappPhone ? `https://wa.me/${whatsappPhone.replace(/[^\d]/g, '')}` : '';
  const websiteHref = isValidHttpUrl(storeWebsiteUrl) ? storeWebsiteUrl : '';

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
    if (!customer.email && !customer.phone) return setMessage('Provide phone number or email.');
    const booking = { preferredDate: state.preferredDate, preferredTime: state.preferredTime, preferredBranch: state.preferredBranch, notes: state.notes };
    const response = await fetch(isOnline ? '/api/integration/checkout/create' : '/api/integration/bookings/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isOnline ? { cart: [{ productId, merchantId, quantity: 1, type: 'SERVICE', serviceName: productName, itemName: productName, productName }], customer, booking: { ...booking, serviceId: productId, serviceName: productName, slotId: state.slotId || undefined, bookingDate: booking.preferredDate, bookingTime: booking.preferredTime, branchLocationName: booking.preferredBranch, sourceChannel: 'sedifex_market', recordType: listingKind === 'course' ? 'course_registration' : 'service_booking' } } : { merchantId, serviceId: productId, serviceName: productName, slotId: state.slotId || undefined, customer, booking, payment: { mode: 'manual', currency }, sourceChannel: 'sedifex_market', recordType: listingKind === 'course' ? 'course_registration' : 'service_booking' }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data?.error || `Unable to submit ${copy.actionNoun} request.`);
    if (isOnline) {
      const checkoutUrl = data?.merchantCheckouts?.[0]?.checkoutUrl;
      setMessage(checkoutUrl ? 'Redirecting to secure checkout...' : `${copy.actionNoun} created. Complete payment from your checkout link.`);
      if (checkoutUrl) window.location.href = checkoutUrl as string;
      return;
    }
    setMessage(`${listingKind === 'course' ? 'Registration' : 'Booking'} request sent${data?.reference ? ` (${data.reference})` : ''}.`);
  };

  return (
    <aside className="serviceBookingPanel" aria-label={listingKind === 'course' ? 'Course registration options' : 'Service booking options'}>
      <p className="eyebrow">{listingKind === 'course' ? 'Course registration' : 'Booking options'}</p>
      <h3>{copy.title}</h3>
      <p className="productCartPrice">{formatMoney(price, currency)}</p>

      <section className="officialBookingCard" aria-label="Official website booking instructions">
        <p className="officialBookingLead">{copy.intro}</p>
        <p className="sedifexPoweredNote">{copy.sedifexNote}</p>
        <ol className="bookingSteps">
          {copy.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        {websiteHref ? (
          <a className="requestButton officialWebsiteButton" href={websiteHref} target="_blank" rel="noopener noreferrer">
            {copy.websiteButton}
          </a>
        ) : (
          <p className="requestFeedback error">This {copy.businessLabel} has not added a website link yet. Use the Sedifex request option below.</p>
        )}
        <p className="checkoutHint">Look for {listingKind === 'course' ? 'Registration, Courses, or Apply' : 'Booking, Services, or Appointments'} on the website.</p>
      </section>

      <div className="bookingDivider"><span>Alternative</span></div>
      <button type="button" className="secondaryButton fullWidthButton" onClick={() => setShowSedifexForm((current) => !current)}>
        {showSedifexForm ? 'Hide Sedifex request form' : `Send ${copy.actionNoun} request on Sedifex Market`}
      </button>

      {showSedifexForm ? (
        <form onSubmit={submit} className="leadForm">
          <p className="checkoutHint">Use this if the website is unavailable. Sedifex will send your request to the {copy.businessLabel} with your details.</p>
          <label>Full name<input required value={state.fullName} onChange={(e) => setState((s) => ({ ...s, fullName: e.target.value }))} /></label>
          <label>Email<input type="email" value={state.email} onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))} /></label>
          <label>Phone<input value={state.phone} onChange={(e) => setState((s) => ({ ...s, phone: e.target.value }))} /></label>
          {slotsAvailable && <label>Available slots<select value={state.slotId} onChange={(e) => { const slot = slots.find((item) => item.id === e.target.value); const start = slot?.startAt ? new Date(slot.startAt) : null; const date = start ? start.toISOString().slice(0, 10) : ''; const time = start ? start.toISOString().slice(11, 16) : ''; setState((s) => ({ ...s, slotId: e.target.value, preferredDate: date || s.preferredDate, preferredTime: time || s.preferredTime, preferredBranch: slot?.location || s.preferredBranch })); }}><option value="">Select a slot</option>{slots.map((slot) => { const start = slot.startAt ? new Date(slot.startAt) : null; const end = slot.endAt ? new Date(slot.endAt) : null; const label = [start ? start.toLocaleString() : 'Time TBD', end ? `- ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '', slot.location ? `· ${slot.location}` : '', typeof slot.seatsRemaining === 'number' ? `· ${slot.seatsRemaining} seat(s) left` : ''].filter(Boolean).join(' '); return <option key={slot.id} value={slot.id}>{label}</option>;})}</select></label>}
          <label>Preferred date<input type="date" required={!slotsAvailable} value={state.preferredDate} onChange={(e) => setState((s) => ({ ...s, preferredDate: e.target.value }))} /></label>
          <label>Preferred time<input type="time" required={!slotsAvailable} value={state.preferredTime} onChange={(e) => setState((s) => ({ ...s, preferredTime: e.target.value }))} /></label>
          <label>Branch / location<input value={state.preferredBranch} onChange={(e) => setState((s) => ({ ...s, preferredBranch: e.target.value }))} /></label>
          <label>Notes<textarea value={state.notes} onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))} /></label>
          <fieldset><legend>Payment method</legend><label><input type="radio" checked={isOnline} onChange={() => setState((s) => ({ ...s, paymentMethod: 'online' }))} /> Pay online through Sedifex</label><label><input type="radio" checked={!isOnline} onChange={() => setState((s) => ({ ...s, paymentMethod: 'manual' }))} /> Request first / pay after confirmation</label></fieldset>
          <button type="submit" className="requestButton">{isOnline ? `Pay online & ${copy.verb}` : `Send ${copy.actionNoun} request`}</button>
          {whatsappHref && <a className="secondaryButton" href={whatsappHref} target="_blank" rel="noopener noreferrer">Enquire on WhatsApp</a>}
          {loadingSlots && <p className="checkoutHint">Checking available slots...</p>}
          {message && <p className="requestFeedback">{message}</p>}
        </form>
      ) : null}
    </aside>
  );
}
