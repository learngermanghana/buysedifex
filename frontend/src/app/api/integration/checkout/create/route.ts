import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';
import {
  amountFromPreview,
  createMasterReference,
  initializeMasterPaystackCheckout,
  majorFromMinor,
  saveMarketplaceCustomerCopies,
  saveMasterCheckoutRecords,
  type MerchantPreviewBundle,
} from '@/lib/marketplace-master-checkout';
import {
  createCheckoutReference,
  createMerchantCheckout,
  groupCartByMerchant,
  previewMerchantCheckout,
  type CheckoutItem,
  type MerchantPaymentRouting,
  type SedifexCheckoutPreviewResponse,
} from '@/lib/sedifex-checkout';

type CheckoutCreateBody = {
  customerUid?: string | null;
  cart?: CheckoutItem[];
  customer?: { name?: string; email?: string; phone?: string; uid?: string | null };
  delivery?: { location?: string; notes?: string };
  booking?: { preferredDate?: string; preferredTime?: string; preferredBranch?: string; notes?: string };
};

const isServiceCart = (cart: CheckoutItem[]) => cart.some((item) => String((item as { type?: unknown }).type ?? '').trim().toUpperCase() === 'SERVICE');
const cleanText = (value: unknown, max = 300) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const cleanEmail = (value: unknown) => cleanText(value, 220).toLowerCase();

const readMerchantPaymentRouting = async (merchantId: string): Promise<MerchantPaymentRouting | null> => {
  if (!db || firebaseConfigError) return null;
  const storeSnap = await getDoc(doc(db, 'storeSettings', merchantId)).catch(() => null);
  const fallbackSnap = storeSnap?.exists() ? storeSnap : await getDoc(doc(db, 'stores', merchantId)).catch(() => null);
  if (!fallbackSnap?.exists()) return null;
  const data = fallbackSnap.data() as Record<string, unknown>;
  const routing = data.paymentRouting && typeof data.paymentRouting === 'object' ? (data.paymentRouting as MerchantPaymentRouting) : null;
  const directSubaccount = cleanText(data.paystackSubaccountCode, 120);
  if (routing) return routing;
  return directSubaccount
    ? { provider: 'paystack', settlementMode: 'subaccount', paystackSubaccountCode: directSubaccount, subaccountCode: directSubaccount, commissionControlledBy: 'sedifex', status: 'active' }
    : null;
};

async function createSingleMerchantCheckout(input: {
  merchantId: string;
  merchantCart: CheckoutItem[];
  customerUid?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  deliveryLocation?: string;
  deliveryNotes?: string;
  booking: { preferredDate: string; preferredTime: string; preferredBranch: string; notes: string };
}) {
  const preview = await previewMerchantCheckout(input.merchantId, input.merchantCart);
  const paymentRouting = await readMerchantPaymentRouting(input.merchantId);
  const reference = createCheckoutReference(input.merchantId);
  const checkout = await createMerchantCheckout(input.merchantId, input.merchantCart, reference, preview, { email: input.customerEmail, phone: input.customerPhone }, paymentRouting);
  const cartIsServiceBooking = isServiceCart(input.merchantCart);
  const collectionName = cartIsServiceBooking ? 'integrationBookings' : 'integrationOrders';
  const recordType = cartIsServiceBooking ? 'service_booking' : 'product_order';
  const subaccountCode = paymentRouting?.paystackSubaccountCode ?? paymentRouting?.subaccountCode ?? null;
  const checkoutPayload = checkout as { authorizationUrl?: string; checkoutUrl?: string; bookingId?: string; orderId?: string; payment_reference?: string; payment_status?: string; order_status?: string; pricing_snapshot?: SedifexCheckoutPreviewResponse };
  const checkoutRecord = {
    recordType,
    merchantId: input.merchantId,
    storeId: input.merchantId,
    reference,
    sourceChannel: 'sedifex_market',
    source_channel: 'sedifex_market',
    sourceLabel: 'Sedifex Market',
    source_label: 'Sedifex Market',
    customerUid: input.customerUid || null,
    clientOrderId: reference,
    client_order_id: reference,
    sedifexOrderId: reference,
    customer: { uid: input.customerUid || null, name: input.customerName || null, email: input.customerEmail, phone: input.customerPhone || null },
    deliveryLocation: input.deliveryLocation || null,
    deliveryNotes: input.deliveryNotes || null,
    ...(cartIsServiceBooking ? { booking: input.booking, bookingDate: input.booking.preferredDate || null, bookingTime: input.booking.preferredTime || null, preferredBranch: input.booking.preferredBranch || null, notes: input.booking.notes || null } : {}),
    cart: input.merchantCart,
    items: input.merchantCart,
    pricingSnapshot: preview,
    pricing_snapshot: preview,
    paymentRouting: paymentRouting ?? null,
    paystackSplit: subaccountCode ? { provider: 'paystack', mode: 'subaccount', subaccount: subaccountCode, percentageCharge: paymentRouting?.percentageCharge ?? null, commissionControlledBy: paymentRouting?.commissionControlledBy ?? 'sedifex', status: paymentRouting?.status ?? 'active' } : null,
    paymentReference: reference,
    payment_reference: reference,
    paymentStatus: 'pending',
    payment_status: 'pending',
    orderStatus: cartIsServiceBooking ? 'pending_booking_payment' : 'pending_payment',
    order_status: cartIsServiceBooking ? 'pending_booking_payment' : 'pending_payment',
    bookingStatus: cartIsServiceBooking ? 'pending_payment' : null,
    paymentCollectionMode: 'online_checkout',
    source: 'sedifex_market',
    syncStatus: 'pending',
    syncRequestedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
  };
  let recordId: string | undefined;
  if (db && !firebaseConfigError) {
    const batch = writeBatch(db);
    const createdRecord = doc(collection(db, collectionName));
    batch.set(createdRecord, checkoutRecord);
    batch.set(doc(db, 'sedifexAdmin', 'marketplace', 'orders', reference), { ...checkoutRecord, checkoutUrl: checkoutPayload.authorizationUrl ?? checkoutPayload.checkoutUrl ?? null }, { merge: true });
    if (input.customerUid) batch.set(doc(db, 'marketCustomers', input.customerUid, 'orders', reference), { ...checkoutRecord, checkoutUrl: checkoutPayload.authorizationUrl ?? checkoutPayload.checkoutUrl ?? null }, { merge: true });
    await batch.commit();
    recordId = createdRecord.id;
  } else if (db) {
    const createdRecord = await addDoc(collection(db, collectionName), checkoutRecord);
    recordId = createdRecord.id;
  }
  return {
    merchantId: input.merchantId,
    reference,
    recordType,
    recordId,
    orderId: checkoutPayload.orderId ?? (cartIsServiceBooking ? undefined : recordId ?? reference),
    bookingId: checkoutPayload.bookingId ?? (cartIsServiceBooking ? recordId ?? reference : undefined),
    payment_reference: checkoutPayload.payment_reference ?? reference,
    payment_status: checkoutPayload.payment_status ?? 'pending',
    order_status: checkoutPayload.order_status ?? (cartIsServiceBooking ? 'pending_booking_payment' : 'pending_payment'),
    checkoutUrl: checkoutPayload.authorizationUrl ?? checkoutPayload.checkoutUrl,
    preview: checkoutPayload.pricing_snapshot ?? preview,
    paystackSplit: subaccountCode ? { enabled: true, subaccount: subaccountCode } : { enabled: false },
  };
}

async function createMasterCheckout(grouped: Map<string, CheckoutItem[]>, body: { customerUid?: string | null; customerName: string; customerEmail: string; customerPhone?: string; deliveryLocation?: string; deliveryNotes?: string }) {
  if (!db || firebaseConfigError) throw new Error('Firebase is required for multi-store master checkout.');
  const merchantPreviews: MerchantPreviewBundle[] = await Promise.all(Array.from(grouped.entries()).map(async ([merchantId, merchantCart]) => {
    const preview = await previewMerchantCheckout(merchantId, merchantCart);
    return { merchantId, merchantCart, preview, routing: await readMerchantPaymentRouting(merchantId), childReference: createCheckoutReference(merchantId), amountMinor: amountFromPreview(preview) };
  }));
  const masterReference = createMasterReference();
  const totalAmountMinor = merchantPreviews.reduce((sum, merchant) => sum + merchant.amountMinor, 0);
  if (!totalAmountMinor) throw new Error('Unable to calculate total checkout amount.');
  const paystack = await initializeMasterPaystackCheckout({ reference: masterReference, amountMinor: totalAmountMinor, email: body.customerEmail, customerName: body.customerName, phone: body.customerPhone, merchantIds: merchantPreviews.map((merchant) => merchant.merchantId), childReferences: merchantPreviews.map((merchant) => merchant.childReference), customerUid: body.customerUid });
  await saveMasterCheckoutRecords({ db, customerUid: body.customerUid, customerName: body.customerName, customerEmail: body.customerEmail, customerPhone: body.customerPhone, deliveryLocation: body.deliveryLocation, deliveryNotes: body.deliveryNotes, merchantPreviews, checkoutUrl: paystack.authorization_url || '', accessCode: paystack.access_code || null, masterReference, totalAmountMinor });
  return { merchantId: 'sedifex_market', reference: masterReference, recordType: 'marketplace_master_order', payment_reference: masterReference, payment_status: 'pending', order_status: 'pending_payment', checkoutUrl: paystack.authorization_url, amount: majorFromMinor(totalAmountMinor), amountMinor: totalAmountMinor, merchantCount: merchantPreviews.length, childReferences: merchantPreviews.map((merchant) => merchant.childReference) };
}

export async function POST(request: NextRequest) {
  console.info('checkout.create.requested');
  try {
    const body = (await request.json()) as CheckoutCreateBody;
    const cart = Array.isArray(body.cart) ? body.cart : [];
    const customerUid = cleanText(body.customerUid || body.customer?.uid, 160) || null;
    const customerName = cleanText(body.customer?.name, 160);
    const customerEmail = cleanEmail(body.customer?.email);
    const customerPhone = cleanText(body.customer?.phone, 80);
    const deliveryLocation = cleanText(body.delivery?.location, 300);
    const deliveryNotes = cleanText(body.delivery?.notes, 1200);
    if (cart.length === 0) return NextResponse.json({ error: 'Cart is required' }, { status: 400 });
    if (!customerEmail) return NextResponse.json({ error: 'customer.email is required' }, { status: 400 });
    const grouped = groupCartByMerchant(cart);
    const merchantIds = Array.from(grouped.keys());
    if (db && !firebaseConfigError) await saveMarketplaceCustomerCopies({ db, customerUid, customer: { name: customerName, email: customerEmail, phone: customerPhone }, deliveryLocation, merchantIds });
    if (grouped.size > 1) {
      const masterCheckout = await createMasterCheckout(grouped, { customerUid, customerName, customerEmail, customerPhone, deliveryLocation, deliveryNotes });
      return NextResponse.json({ ok: true, checkoutMode: 'master_multi_store', merchantCheckouts: [masterCheckout], masterCheckout });
    }
    const [merchantId, merchantCart] = Array.from(grouped.entries())[0];
    const result = await createSingleMerchantCheckout({ merchantId, merchantCart, customerUid, customerName, customerEmail, customerPhone, deliveryLocation, deliveryNotes, booking: { preferredDate: cleanText(body.booking?.preferredDate, 40), preferredTime: cleanText(body.booking?.preferredTime, 40), preferredBranch: cleanText(body.booking?.preferredBranch, 180), notes: cleanText(body.booking?.notes, 1200) } });
    return NextResponse.json({ ok: true, checkoutMode: 'single_merchant', merchantCheckouts: [result] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown checkout error';
    console.error('checkout.create.failed', { message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
