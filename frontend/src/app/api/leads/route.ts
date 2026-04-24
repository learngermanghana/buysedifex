import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';

type LeadPayload = {
  productId?: string;
  productName?: string;
  customerName?: string;
  contact?: string;
  companyName?: string;
  paymentMethod?: string;
  deliveryLocation?: string;
  quantity?: number;
  notes?: string;
  pagePath?: string;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as LeadPayload;

  if (
    !isNonEmptyString(body.productId) ||
    !isNonEmptyString(body.productName) ||
    !isNonEmptyString(body.customerName) ||
    !isNonEmptyString(body.contact) ||
    !isNonEmptyString(body.paymentMethod) ||
    !isNonEmptyString(body.deliveryLocation) ||
    typeof body.quantity !== 'number' ||
    Number.isNaN(body.quantity) ||
    body.quantity < 1
  ) {
    return NextResponse.json({ error: 'Invalid checkout payload' }, { status: 400 });
  }

  if (!db || firebaseConfigError) {
    return NextResponse.json({ error: 'Checkout capture is not configured' }, { status: 503 });
  }

  const lead = {
    productId: body.productId.trim(),
    productName: body.productName.trim(),
    customerName: body.customerName.trim(),
    contact: body.contact.trim(),
    companyName: isNonEmptyString(body.companyName) ? body.companyName.trim() : '',
    paymentMethod: body.paymentMethod.trim(),
    deliveryLocation: body.deliveryLocation.trim(),
    quantity: Math.floor(body.quantity),
    notes: isNonEmptyString(body.notes) ? body.notes.trim() : '',
    source: 'product-direct-checkout-form',
    pagePath: isNonEmptyString(body.pagePath) ? body.pagePath.trim() : '/',
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'checkoutRequests'), lead);

  return NextResponse.json({ ok: true, checkoutRequestId: docRef.id });
}
