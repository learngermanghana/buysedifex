import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';
import { verifyWebhookSignature } from '@/lib/sedifex-checkout';

type PaymentWebhookPayload = {
  reference?: string;
  paymentStatus?: string;
  orderStatus?: string;
  sedifexOrderId?: string;
  clientOrderId?: string;
};

const findRecordByReference = async (reference: string) => {
  if (!db) return null;

  for (const collectionName of ['integrationOrders', 'integrationBookings']) {
    const snapshot = await getDocs(query(collection(db, collectionName), where('reference', '==', reference), limit(1)));
    const hit = snapshot.docs[0];
    if (hit) return { collectionName, id: hit.id };
  }

  return null;
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-sedifex-signature');
  const deliveryId = request.headers.get('x-sedifex-delivery-id')?.trim();

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('webhook.rejected', { reason: 'invalid_signature', deliveryId: deliveryId ?? null });
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }

  const eventName = request.headers.get('x-sedifex-event') ?? 'unknown';
  const payload = JSON.parse(rawBody) as PaymentWebhookPayload;

  if (!db || firebaseConfigError) {
    return NextResponse.json({ ok: true, warning: 'Firestore not configured' });
  }

  if (deliveryId) {
    const existingDelivery = await getDocs(
      query(collection(db, 'integrationWebhookEvents'), where('deliveryId', '==', deliveryId), limit(1)),
    );

    if (!existingDelivery.empty) {
      console.info('webhook.rejected', { reason: 'duplicate_delivery', deliveryId });
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  const ref = payload.reference?.trim();
  let updatedCollection: string | null = null;
  let updatedRecordId: string | null = null;

  if (ref) {
    const hit = await findRecordByReference(ref);

    if (hit) {
      const isPaymentSuccess = eventName === 'payment.succeeded' || ['success', 'confirmed', 'paid', 'captured'].includes((payload.paymentStatus ?? '').toLowerCase());
      const paymentStatus = payload.paymentStatus ?? (isPaymentSuccess ? 'success' : 'pending');
      const orderStatus = payload.orderStatus ?? (eventName === 'order.confirmed' ? 'confirmed' : 'processing');
      const bookingUpdate = hit.collectionName === 'integrationBookings'
        ? (isPaymentSuccess
          ? { bookingStatus: 'pending_store_confirmation', orderStatus: 'pending_store_confirmation', order_status: 'pending_store_confirmation' }
          : { bookingStatus: orderStatus })
        : {};

      await updateDoc(doc(db, hit.collectionName, hit.id), {
        paymentStatus: hit.collectionName === 'integrationBookings' && isPaymentSuccess ? 'success' : paymentStatus,
        payment_status: hit.collectionName === 'integrationBookings' && isPaymentSuccess ? 'success' : paymentStatus,
        orderStatus,
        order_status: orderStatus,
        ...bookingUpdate,
        paymentConfirmedAt: isPaymentSuccess ? new Date().toISOString() : null,
        sedifexOrderId: payload.sedifexOrderId ?? null,
        clientOrderId: payload.clientOrderId ?? null,
        syncStatus: 'synced',
        updatedAt: new Date().toISOString(),
        updatedAtServer: serverTimestamp(),
      });

      updatedCollection = hit.collectionName;
      updatedRecordId = hit.id;
    }
  }

  await addDoc(collection(db, 'integrationWebhookEvents'), {
    eventName,
    deliveryId: deliveryId ?? null,
    payload,
    reference: ref ?? null,
    updatedCollection,
    updatedRecordId,
    receivedAt: new Date().toISOString(),
    receivedAtServer: serverTimestamp(),
  });

  console.info('webhook.accepted', {
    eventName,
    deliveryId: deliveryId ?? null,
    reference: payload.reference ?? null,
    updatedCollection,
    updatedRecordId,
  });

  return NextResponse.json({ ok: true, updatedCollection, updatedRecordId });
}
