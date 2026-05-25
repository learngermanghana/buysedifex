'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

type OrderItem = { name: string; quantity: string; price?: string; storeName?: string };
type OrderView = {
  reference: string;
  recordType: string;
  paymentStatus: string;
  orderStatus: string;
  deliveryStatus?: string;
  fulfillmentStatus?: string;
  amount?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  storeName?: string;
  deliveryLocation?: string;
  items: OrderItem[];
  merchantIds: string[];
  childReferences: string[];
};

type LookupResponse = { ok?: boolean; error?: string; order?: OrderView };
type TicketResponse = { ok?: boolean; error?: string; ticket?: { ticketId?: string; status?: string } };

const issueTypes = [
  { value: 'not_delivered', label: 'Item not delivered' },
  { value: 'wrong_item', label: 'Wrong item delivered' },
  { value: 'damaged_item', label: 'Damaged item' },
  { value: 'delivery_fee_issue', label: 'Delivery fee issue' },
  { value: 'refund_request', label: 'Refund request' },
  { value: 'seller_not_responding', label: 'Seller not responding' },
  { value: 'other', label: 'Other' },
];

const badgeClass = (value?: string) => {
  const normalized = String(value || '').toLowerCase();
  if (/paid|success|confirmed|delivered|completed/.test(normalized)) return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
  if (/failed|cancel|problem|refund|dispute/.test(normalized)) return 'bg-rose-100 text-rose-700 ring-rose-200';
  return 'bg-amber-100 text-amber-800 ring-amber-200';
};

export default function TrackOrderPage() {
  const [reference, setReference] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [order, setOrder] = useState<OrderView | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [issueType, setIssueType] = useState('not_delivered');
  const [message, setMessage] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [ticketStatus, setTicketStatus] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);

  const identityPayload = () => {
    const value = emailOrPhone.trim();
    return value.includes('@') ? { email: value, phone: '' } : { email: '', phone: value };
  };

  async function lookupOrder(event: FormEvent) {
    event.preventDefault();
    setLookupLoading(true);
    setLookupError('');
    setOrder(null);
    setTicketStatus('');

    try {
      const response = await fetch('/api/order-tools/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference, ...identityPayload() }),
      });
      const data = (await response.json().catch(() => null)) as LookupResponse | null;
      if (!response.ok || !data?.ok || !data.order) throw new Error(data?.error || 'Unable to find order.');
      setOrder(data.order);
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Unable to find order.');
    } finally {
      setLookupLoading(false);
    }
  }

  async function createTicket(event: FormEvent) {
    event.preventDefault();
    setTicketLoading(true);
    setTicketStatus('');

    try {
      const response = await fetch('/api/order-tools/ticket', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference, ...identityPayload(), issueType, message, evidenceUrl }),
      });
      const data = (await response.json().catch(() => null)) as TicketResponse | null;
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Unable to create support ticket.');
      setTicketStatus(`Ticket created: ${data.ticket?.ticketId || 'support ticket'} (${data.ticket?.status || 'open'}). Sedifex support will follow up.`);
      setMessage('');
      setEvidenceUrl('');
    } catch (error) {
      setTicketStatus(error instanceof Error ? error.message : 'Unable to create support ticket.');
    } finally {
      setTicketLoading(false);
    }
  }

  return (
    <main className="container" style={{ display: 'grid', gap: '1rem' }}>
      <section className="commerceHero" style={{ minHeight: 'auto' }}>
        <div className="commerceHeroContent">
          <p className="eyebrow">Guest order support</p>
          <h1>Track your Sedifex Market order</h1>
          <p>No account needed. Enter your order reference and the email or phone number used during checkout to view the order and report a problem.</p>
        </div>
      </section>

      <section className="productSummaryCard">
        <form onSubmit={lookupOrder} style={{ display: 'grid', gap: '.75rem' }}>
          <label>
            <strong>Order reference</strong>
            <input required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Example: market_... or store_reference" style={{ width: '100%', marginTop: '.4rem', border: '1px solid #cbd5e1', borderRadius: 12, padding: '.75rem' }} />
          </label>
          <label>
            <strong>Email or phone used for checkout</strong>
            <input required value={emailOrPhone} onChange={(event) => setEmailOrPhone(event.target.value)} placeholder="Email address or phone number" style={{ width: '100%', marginTop: '.4rem', border: '1px solid #cbd5e1', borderRadius: 12, padding: '.75rem' }} />
          </label>
          <button className="requestButton" type="submit" disabled={lookupLoading}>{lookupLoading ? 'Checking…' : 'Track order'}</button>
        </form>
        {lookupError ? <p className="requestFeedback error">{lookupError}</p> : null}
      </section>

      {order ? (
        <section className="productSummaryCard">
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div>
              <p className="eyebrow">Order found</p>
              <h2 style={{ margin: '.25rem 0' }}>{order.reference}</h2>
              <p>{order.customerName ? `Customer: ${order.customerName}` : 'Customer verified by checkout contact.'}</p>
            </div>
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'start' }}>
              <span className={`verifiedBadge ${badgeClass(order.paymentStatus)}`}>Payment: {order.paymentStatus}</span>
              <span className={`verifiedBadge ${badgeClass(order.orderStatus)}`}>Order: {order.orderStatus}</span>
              {order.deliveryStatus ? <span className={`verifiedBadge ${badgeClass(order.deliveryStatus)}`}>Delivery: {order.deliveryStatus}</span> : null}
            </div>
          </div>

          <div className="productStats">
            {order.amount ? <p><strong>Amount:</strong> {order.amount}</p> : null}
            {order.storeName ? <p><strong>Store:</strong> {order.storeName}</p> : null}
            {order.deliveryLocation ? <p><strong>Delivery location:</strong> {order.deliveryLocation}</p> : null}
            {order.merchantIds.length > 0 ? <p><strong>Stores in order:</strong> {order.merchantIds.length}</p> : null}
            {order.childReferences.length > 0 ? <p><strong>Child references:</strong> {order.childReferences.join(', ')}</p> : null}
          </div>

          <section className="productContentSection">
            <h2>Items</h2>
            {order.items.length === 0 ? <p>No item details found yet.</p> : null}
            {order.items.map((item, index) => (
              <div key={`${item.name}-${index}`} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '.75rem', background: '#f8fafc' }}>
                <strong>{item.name}</strong>
                <p style={{ margin: '.25rem 0 0' }}>Quantity: {item.quantity}{item.price ? ` · ${item.price}` : ''}{item.storeName ? ` · ${item.storeName}` : ''}</p>
              </div>
            ))}
          </section>
        </section>
      ) : null}

      {order ? (
        <section className="productSummaryCard">
          <p className="eyebrow">Need help?</p>
          <h2>Report a problem with this order</h2>
          <form onSubmit={createTicket} style={{ display: 'grid', gap: '.75rem' }}>
            <label>
              <strong>Issue type</strong>
              <select value={issueType} onChange={(event) => setIssueType(event.target.value)} style={{ width: '100%', marginTop: '.4rem', border: '1px solid #cbd5e1', borderRadius: 12, padding: '.75rem' }}>
                {issueTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <strong>Message</strong>
              <textarea required rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Explain the problem. Example: item not delivered, wrong item, damaged item, delivery fee issue..." style={{ width: '100%', marginTop: '.4rem', border: '1px solid #cbd5e1', borderRadius: 12, padding: '.75rem' }} />
            </label>
            <label>
              <strong>Evidence link optional</strong>
              <input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="Paste image/video link if available" style={{ width: '100%', marginTop: '.4rem', border: '1px solid #cbd5e1', borderRadius: 12, padding: '.75rem' }} />
            </label>
            <button className="requestButton" type="submit" disabled={ticketLoading}>{ticketLoading ? 'Creating ticket…' : 'Create support ticket'}</button>
          </form>
          {ticketStatus ? <p className={ticketStatus.startsWith('Ticket created') ? 'requestFeedback success' : 'requestFeedback error'}>{ticketStatus}</p> : null}
        </section>
      ) : null}

      <section className="productStoreCard">
        <h2>Create an account for easier history</h2>
        <p>Guest checkout works, but creating an account helps you see future order history faster.</p>
        <div className="productStoreActions">
          <Link href="/account">Open account</Link>
          <Link href="/contact">Contact Sedifex support</Link>
        </div>
      </section>
    </main>
  );
}
