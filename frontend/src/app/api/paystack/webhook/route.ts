import crypto from 'node:crypto';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';

type PaystackWebhook = {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    fees?: number;
    channel?: string;
    paid_at?: string;
    gateway_response?: string;
    customer?: { email?: string; phone?: string };
    metadata?: Record<string, unknown>;
  };
};

type MerchantOrder = {
  merchantId?: string;
  storeId?: string;
  childReference?: string;
};

const getWebhookSecret = () =>
  process.env.SEDIFEX_MARKET_PAYSTACK_SECRET_KEY?.trim() || process.env.PAYSTACK_SECRET_KEY?.trim() || '';

const verifyPaystackSignature = (rawBody: string, signature: string | null) => {
  const secret = getWebhookSecret();
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
};

const statusUpdateForEvent = (event: string, data: PaystackWebhook['data']) => {
  const now = serverTimestamp();
  const success = event === 'charge.success' || data?.status === 'success';
  const failed = event === 'charge.failed' || ['failed', 'abandoned'].includes(String(data?.status ?? '').toLowerCase());

  if (success) {
    return {
      paymentStatus: 'success',
      payment_status: 'success',
      orderStatus: 'confirmed',
      order_status: 'confirmed',
      status: 'confirmed',
      paystackStatus: data?.status ?? 'success',
      paystackChannel: data?.channel ?? null,
      paystackFees: data?.fees ?? null,
      amountPaidMinor: data?.amount ?? null,
      paymentConfirmedAt: now,
      paymentUpdatedAt: now,
      updatedAt: now,
      syncStatus: 'pending',
      syncRequestedAt: now,
      lastPaymentEvent: event,
      lastPaymentMetadata: data?.metadata ?? null,
    };
  }

  if (failed) {
    return {
      paymentStatus: 'failed',
      payment_status: 'failed',
      orderStatus: 'payment_failed',
      order_status: 'payment_failed',
      status: 'payment_failed',
      paystackStatus: data?.status ?? 'failed',
      paymentFailedAt: now,
      paymentUpdatedAt: now,
      updatedAt: now,
      lastPaymentEvent: event,
      lastPaymentMetadata: data?.metadata ?? null,
    };
  }

  return {
    paystackStatus: data?.status ?? null,
    paymentUpdatedAt: now,
    updatedAt: now,
    lastPaymentEvent: event,
    lastPaymentMetadata: data?.metadata ?? null,
  };
};

async function updateMatchingIntegrationOrders(reference: string, update: Record<string, unknown>) {
  if (!db) return 0;
  const refs = new Map<string, ReturnType<typeof doc>>();
  const fields = ['reference', 'paymentReference', 'payment_reference', 'masterReference', 'parentReference'];

  for (const field of fields) {
    const snapshot = await getDocs(query(collection(db, 'integrationOrders'), where(field, '==', reference)));
    snapshot.docs.forEach((hit) => refs.set(hit.ref.path, hit.ref));
  }

  let count = 0;
  for (const ref of refs.values()) {
    await updateDoc(ref, update).catch(() => null);
    count += 1;
  }
  return count;
}

async function updateMarketplaceMasterOrder(reference: string, update: Record<string, unknown>, payload: PaystackWebhook) {
  if (!db || firebaseConfigError) throw new Error('Firebase is not configured.');
  const firestore = db;
  const masterRef = doc(firestore, 'marketplaceOrders', reference);
  const masterSnap = await getDoc(masterRef);
  if (!masterSnap.exists()) return { found: false, updatedChildren: 0 };

  const master = masterSnap.data() as Record<string, unknown>;
  const merchantOrders = Array.isArray(master.merchantOrders) ? (master.merchantOrders as MerchantOrder[]) : [];
  const customerUid = typeof master.customerUid === 'string' ? master.customerUid : '';

  const batch = writeBatch(firestore);
  batch.set(masterRef, update, { merge: true });
  batch.set(doc(firestore, 'sedifexAdmin', 'marketplace', 'orders', reference), update, { merge: true });
  if (customerUid) batch.set(doc(firestore, 'marketCustomers', customerUid, 'orders', reference), update, { merge: true });

  merchantOrders.forEach((merchantOrder) => {
    const merchantId = merchantOrder.merchantId || merchantOrder.storeId;
    const childReference = merchantOrder.childReference;
    if (!merchantId || !childReference) return;
    const childUpdate = {
      ...update,
      masterReference: reference,
      parentReference: reference,
      paymentReference: reference,
      payment_reference: reference,
      settlementStatus: update.paymentStatus === 'success' ? 'pending_settlement' : update.paymentStatus === 'failed' ? 'payment_failed' : 'pending_payment',
    };
    batch.set(doc(firestore, 'stores', merchantId, 'integrationOrders', childReference), childUpdate, { merge: true });
    batch.set(doc(firestore, 'marketplaceOrders', reference, 'merchantOrders', merchantId), childUpdate, { merge: true });
  });

  await batch.commit();
  const matchedTopLevel = await updateMatchingIntegrationOrders(reference, update);

  console.info('paystack.marketplace.webhook.updated', {
    reference,
    event: payload.event,
    merchantOrders: merchantOrders.length,
    matchedTopLevel,
  });

  return { found: true, updatedChildren: merchantOrders.length + matchedTopLevel };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  if (!verifyPaystackSignature(rawBody, signature)) {
    console.warn('paystack.marketplace.webhook.invalid_signature');
    return NextResponse.json({ ok: false, error: 'invalid-signature' }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as PaystackWebhook;
    const reference = payload.data?.reference?.trim();
    if (!reference) return NextResponse.json({ ok: false, error: 'missing-reference' }, { status: 400 });

    const update = statusUpdateForEvent(payload.event ?? '', payload.data);
    const result = await updateMarketplaceMasterOrder(reference, update, payload);

    return NextResponse.json({ ok: true, reference, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Paystack webhook error';
    console.error('paystack.marketplace.webhook.failed', { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
