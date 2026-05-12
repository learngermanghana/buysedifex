import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';
import { verifyWebhookSignature } from '@/lib/sedifex-checkout';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-sedifex-signature');
  const deliveryId = request.headers.get('x-sedifex-delivery-id')?.trim();

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('webhook.rejected', { reason: 'invalid_signature', deliveryId: deliveryId ?? null });
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }

  const eventName = request.headers.get('x-sedifex-event') ?? 'unknown';
  const payload = JSON.parse(rawBody) as {
    reference?: string;
    paymentStatus?: string;
    orderStatus?: string;
    sedifexOrderId?: string;
    clientOrderId?: string;
  };

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
  if (ref) {
    const docs = await getDocs(query(collection(db, 'integrationBookings'), where('reference', '==', ref), limit(1)));
    const hit = docs.docs[0];

    if (hit) {
      await updateDoc(doc(db, 'integrationBookings', hit.id), {
        paymentStatus: payload.paymentStatus ?? (eventName === 'payment.succeeded' ? 'confirmed' : 'pending'),
        orderStatus: payload.orderStatus ?? (eventName === 'order.confirmed' ? 'confirmed' : 'processing'),
        paymentConfirmedAt: payload.paymentStatus === 'confirmed' ? new Date().toISOString() : null,
        sedifexOrderId: payload.sedifexOrderId ?? null,
        clientOrderId: payload.clientOrderId ?? null,
        syncStatus: 'synced',
        updatedAt: new Date().toISOString(),
        updatedAtServer: serverTimestamp(),
      });
    }
  }

  await addDoc(collection(db, 'integrationWebhookEvents'), {
    eventName,
    deliveryId: deliveryId ?? null,
    payload,
    receivedAt: new Date().toISOString(),
    receivedAtServer: serverTimestamp(),
  });

  console.info('webhook.accepted', { eventName, deliveryId: deliveryId ?? null, reference: payload.reference ?? null });

  return NextResponse.json({ ok: true });
}
