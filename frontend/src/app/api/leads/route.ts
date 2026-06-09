import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';
import { validateCheckoutCustomer } from '@/lib/checkout-customer-validation';

type LeadPayload = {
  productId?: string;
  merchantId?: string;
  productName?: string;
  storeName?: string;
  customerName?: string;
  contact?: string;
  companyName?: string;
  paymentMethod?: string;
  deliveryLocation?: string;
  quantity?: number;
  notes?: string;
  pagePath?: string;
  sourceChannel?: string;
  leadType?: string;
  customer?: Record<string, unknown>;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as LeadPayload;


  const isWhatsappEnquiry = body.leadType === 'whatsapp_enquiry';

  if (isWhatsappEnquiry) {
    if (!isNonEmptyString(body.productId) || !isNonEmptyString(body.merchantId) || !isNonEmptyString(body.productName)) {
      return NextResponse.json({ error: 'Invalid WhatsApp lead payload' }, { status: 400 });
    }

    if (!db || firebaseConfigError) {
      return NextResponse.json({ error: 'Lead capture is not configured' }, { status: 503 });
    }

    const docRef = await addDoc(collection(db, 'marketLeads'), {
      productId: body.productId.trim(),
      merchantId: body.merchantId.trim(),
      productName: body.productName.trim(),
      storeName: isNonEmptyString(body.storeName) ? body.storeName.trim() : '',
      customer: body.customer ?? null,
      sourceChannel: isNonEmptyString(body.sourceChannel) ? body.sourceChannel.trim() : 'sedifex_market',
      leadType: 'whatsapp_enquiry',
      createdAt: new Date().toISOString(),
      createdAtServer: serverTimestamp(),
    });

    return NextResponse.json({ ok: true, leadReference: docRef.id });
  }
  const customerValidation = validateCheckoutCustomer({
    name: body.customer?.name ?? body.customerName,
    email: body.customer?.email,
    phone: body.customer?.phone,
  });

  if (
    !isNonEmptyString(body.productId) ||
    !isNonEmptyString(body.productName) ||
    !customerValidation.valid ||
    !isNonEmptyString(body.paymentMethod) ||
    !isNonEmptyString(body.deliveryLocation) ||
    typeof body.quantity !== 'number' ||
    Number.isNaN(body.quantity) ||
    body.quantity < 1
  ) {
    return NextResponse.json({ error: customerValidation.firstError || 'Invalid checkout payload', fieldErrors: customerValidation.errors }, { status: 400 });
  }

  if (!db || firebaseConfigError) {
    return NextResponse.json({ error: 'Checkout capture is not configured' }, { status: 503 });
  }

  const lead = {
    productId: body.productId.trim(),
    productName: body.productName.trim(),
    customerName: customerValidation.customer.name,
    contact: `${customerValidation.customer.phone} | ${customerValidation.customer.email}`,
    customer: customerValidation.customer,
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
