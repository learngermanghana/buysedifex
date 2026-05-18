import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';
import { createCheckoutReference, type CheckoutItem } from '@/lib/sedifex-checkout';
import { createIntegrationBooking, getIntegrationAvailability } from '@/lib/sedifex-bookings';

type ManualBookingBody = { merchantId?: string; serviceId?: string; serviceName?: string; slotId?: string; customer?: { name?: string; email?: string; phone?: string }; booking?: { preferredDate?: string; preferredTime?: string; preferredBranch?: string; notes?: string }; payment?: { mode?: string; amount?: number; currency?: string } };
const cleanText = (value: unknown, max = 300) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export async function GET(request: NextRequest) {
  try {
    const merchantId = cleanText(request.nextUrl.searchParams.get('merchantId'), 140);
    const serviceId = cleanText(request.nextUrl.searchParams.get('serviceId'), 180);
    if (!merchantId || !serviceId) return NextResponse.json({ slots: [] });
    const availability = (await getIntegrationAvailability(merchantId, serviceId)) as { slots?: unknown[]; data?: { slots?: unknown[] } };
    return NextResponse.json({ ok: true, slots: (availability.slots ?? availability.data?.slots ?? []) as unknown[] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch availability';
    const missingEndpoint = message.includes('(404)') || message.toLowerCase().includes('not found');
    return NextResponse.json({ ok: false, slots: [], error: missingEndpoint ? 'Booking endpoint is unavailable on Sedifex (404). Please contact support.' : message }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!db || firebaseConfigError) return NextResponse.json({ error: 'Firestore not configured' }, { status: 500 });
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
    const slotId = cleanText(body.slotId, 180);
    if (!merchantId) return NextResponse.json({ error: 'merchantId is required' }, { status: 400 });
    if (!serviceId) return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
    if (!customerName) return NextResponse.json({ error: 'customer.name is required' }, { status: 400 });
    if (!customerEmail && !customerPhone) return NextResponse.json({ error: 'customer email or phone is required' }, { status: 400 });
    if (!preferredDate) return NextResponse.json({ error: 'booking.preferredDate is required' }, { status: 400 });
    if (!preferredTime) return NextResponse.json({ error: 'booking.preferredTime is required' }, { status: 400 });

    const paymentMode = cleanText(body.payment?.mode, 50) || 'manual';
    const amount = typeof body.payment?.amount === 'number' && Number.isFinite(body.payment.amount) ? body.payment.amount : null;
    const currency = cleanText(body.payment?.currency, 20) || 'GHS';
    const sedifex = (await createIntegrationBooking({ merchantId, serviceId, serviceName, slotId: slotId || undefined, customer: { name: customerName, email: customerEmail || undefined, phone: customerPhone || undefined }, quantity: 1, notes, paymentMethod: paymentMode, paymentAmount: amount, bookingDate: preferredDate, bookingTime: preferredTime, branchLocationName: preferredBranch, attributes: { source: 'sedifex_market', sourceChannel: 'sedifex_market', productName: serviceName, serviceName, preferredDate, preferredTime, preferredBranch } })) as Record<string, unknown>;

    const reference = String(sedifex.reference ?? sedifex.bookingReference ?? sedifex.bookingId ?? createCheckoutReference(merchantId));
    const cartItem: CheckoutItem = { merchantId, productId: serviceId, quantity: 1, type: 'SERVICE' };
    await addDoc(collection(db, 'integrationBookings'), {
      recordType: 'service_booking', merchantId, storeId: merchantId, reference, serviceId, serviceName, customer: { name: customerName, email: customerEmail || null, phone: customerPhone || null }, booking: { preferredDate, preferredTime, preferredBranch: preferredBranch || null, notes: notes || null }, bookingDate: preferredDate, bookingTime: preferredTime, branchLocationName: preferredBranch || null, paymentMethod: paymentMode, paymentAmount: amount, paymentCurrency: currency, cart: [cartItem], items: [cartItem], sourceChannel: 'sedifex_market', sedifexResponse: sedifex, createdAt: new Date().toISOString(), createdAtServer: serverTimestamp(), updatedAt: new Date().toISOString(), updatedAtServer: serverTimestamp(),
    });

    return NextResponse.json({ ok: true, bookingId: sedifex.bookingId ?? reference, reference, sedifex });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create booking request';
    console.error('booking.request.failed', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
