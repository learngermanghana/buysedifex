import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';
import { verifyWebhookSignature } from '@/lib/sedifex-checkout';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-sedifex-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
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
    payload,
    receivedAt: new Date().toISOString(),
    receivedAtServer: serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
