import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';
import { createCheckoutReference, type CheckoutItem } from '@/lib/sedifex-checkout';

type ManualBookingBody = {
  merchantId?: string;
  serviceId?: string;
  serviceName?: string;
  sourceChannel?: string;
  sourceLabel?: string;
  clientOrderId?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  booking?: {
    preferredDate?: string;
    preferredTime?: string;
    preferredBranch?: string;
    notes?: string;
  };
  payment?: {
    mode?: string;
    amount?: number;
    currency?: string;
  };
};

const cleanText = (value: unknown, max = 300) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const cleanChannel = (value: unknown) => {
  const raw = cleanText(value, 80).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (!raw) return 'sedifex_market';
  if (raw.includes('website') || raw.includes('wordpress') || raw.includes('client')) return 'client_website';
  if (raw.includes('custom_page') || raw.includes('public_page')) return 'sedifex_custom_page';
  if (raw.includes('market')) return 'sedifex_market';
  return raw;
};

const channelLabel = (channel: string, value?: string) => {
  const custom = cleanText(value, 100);
  if (custom) return custom;
  if (channel === 'client_website') return 'Client Website';
  if (channel === 'sedifex_custom_page') return 'Sedifex Public Page';
  return 'Sedifex Market';
};

export async function POST(request: NextRequest) {
  try {
    if (!db || firebaseConfigError) {
      return NextResponse.json({ error: 'Firestore not configured' }, { status: 500 });
    }

    const body = (await request.json()) as ManualBookingBody;
    const merchantId = cleanText(body.merchantId, 140);
    const serviceId = cleanText(body.serviceId, 180);
    const serviceName = cleanText(body.serviceName, 220) || 'Service booking';
    const customerName = cleanText(body.customer?.name, 160);
    const customerEmail = cleanText(body.customer?.email, 180).toLowerCase();
    const customerPhone = cleanText(body.customer?.phone, 80);
    const preferredDate = cleanText(body.booking?.preferredDate, 40);
    const preferredTime = cleanText(body.booking?.preferredTime, 40);
    const preferredBranch = cleanText(body.booking?.preferredBranch, 180);
    const notes = cleanText(body.booking?.notes, 1200);
    const sourceChannel = cleanChannel(body.sourceChannel);
    const sourceLabel = channelLabel(sourceChannel, body.sourceLabel);

    if (!merchantId) return NextResponse.json({ error: 'merchantId is required' }, { status: 400 });
    if (!serviceId) return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
    if (!customerName) return NextResponse.json({ error: 'customer.name is required' }, { status: 400 });
    if (!customerEmail && !customerPhone) return NextResponse.json({ error: 'customer email or phone is required' }, { status: 400 });
    if (!preferredDate) return NextResponse.json({ error: 'booking.preferredDate is required' }, { status: 400 });
    if (!preferredTime) return NextResponse.json({ error: 'booking.preferredTime is required' }, { status: 400 });

    const reference = createCheckoutReference(merchantId);
    const clientOrderId = cleanText(body.clientOrderId, 180) || `MARKET-BOOKING-${reference}`;
    const cartItem: CheckoutItem = { merchantId, productId: serviceId, quantity: 1, type: 'SERVICE' };
    const paymentMode = cleanText(body.payment?.mode, 50) || 'manual';
    const currency = cleanText(body.payment?.currency, 20) || 'GHS';
    const isManual = paymentMode === 'manual';
    const paymentStatus = isManual ? 'pending_manual' : 'pending';
    const bookingStatus = isManual ? 'pending_store_confirmation' : 'pending_payment';
    const amount = typeof body.payment?.amount === 'number' && Number.isFinite(body.payment.amount) ? body.payment.amount : null;

    const bookingRecord = {
      recordType: 'service_booking',
      orderType: 'service',
      merchantId,
      storeId: merchantId,
      reference,
      clientOrderId,
      client_order_id: clientOrderId,
      sedifexOrderId: reference,
      bookingId: reference,
      sourceChannel,
      source_channel: sourceChannel,
      sourceLabel,
      source_label: sourceLabel,
      serviceId,
      serviceName,
      customer: {
        name: customerName,
        email: customerEmail || null,
        phone: customerPhone || null,
      },
      booking: {
        preferredDate,
        preferredTime,
        preferredBranch: preferredBranch || null,
        notes: notes || null,
      },
      bookingDate: preferredDate,
      bookingTime: preferredTime,
      preferredBranch: preferredBranch || null,
      notes: notes || null,
      cart: [cartItem],
      items: [cartItem],
      payment: {
        mode: paymentMode,
        status: paymentStatus,
        amount,
        currency,
        reference,
      },
      paymentReference: reference,
      payment_reference: reference,
      paymentStatus,
      payment_status: paymentStatus,
      orderStatus: bookingStatus,
      order_status: bookingStatus,
      bookingStatus,
      paymentCollectionMode: paymentMode,
      source: sourceChannel,
      syncStatus: 'pending',
      syncRequestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      createdAtServer: serverTimestamp(),
      updatedAt: new Date().toISOString(),
      updatedAtServer: serverTimestamp(),
    };

    const created = await addDoc(collection(db, 'integrationBookings'), bookingRecord);

    return NextResponse.json({
      ok: true,
      bookingId: created.id,
      sedifexOrderId: created.id,
      clientOrderId,
      reference,
      sourceChannel,
      paymentStatus,
      bookingStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create booking request';
    console.error('booking.request.failed', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
