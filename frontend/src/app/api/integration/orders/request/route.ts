import { addDoc, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';
import { createCheckoutReference, type CheckoutItem } from '@/lib/sedifex-checkout';

type PayOnDeliveryOrderBody = {
  merchantId?: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number | null;
  currency?: string;
  sourceChannel?: string;
  sourceLabel?: string;
  clientOrderId?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  delivery?: {
    location?: string;
    notes?: string;
  };
};

type ProductPriceSnapshot = {
  name?: string;
  price: number | null;
  currency: string;
  publicProductId?: string;
  sourceProductId?: string;
};

const cleanText = (value: unknown, max = 300) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const cleanNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeSourceChannel = (value: unknown) => {
  const normalized = cleanText(value, 80).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (!normalized) return 'sedifex_market';
  if (normalized.includes('website') || normalized.includes('wordpress') || normalized.includes('client')) return 'client_website';
  if (normalized.includes('custom_page') || normalized.includes('public_page')) return 'sedifex_custom_page';
  if (normalized.includes('market')) return 'sedifex_market';
  return normalized;
};

const getSourceLabel = (channel: string, provided?: string) => {
  const customLabel = cleanText(provided, 100);
  if (customLabel) return customLabel;
  if (channel === 'client_website') return 'Client Website';
  if (channel === 'sedifex_custom_page') return 'Sedifex Public Page';
  return 'Sedifex Market';
};

const buildFreePayOnDeliveryFeePolicy = (input: { amount: number; currency: string }) => ({
  policyKey: 'sedifex_free_pay_on_delivery_v1',
  currency: input.currency,
  baseAmountMajor: input.amount,
  customerProcessingFeePercent: 0,
  customerProcessingFeeMajor: 0,
  customerTotalMajor: input.amount,
  sedifexCommissionPercent: 0,
  sedifexCommissionMajor: 0,
  merchantGrossMajor: input.amount,
  merchantNetMajor: input.amount,
  customerPaysProcessingFee: false,
  merchantPaysCommission: false,
  commissionCollectionMode: 'free_launch_period',
  useCase: 'product',
});

const readProductPriceSnapshot = async (input: { merchantId: string; productId: string }): Promise<ProductPriceSnapshot | null> => {
  if (!db) return null;

  const candidates: Array<Record<string, unknown> & { id?: string }> = [];

  const directDoc = await getDoc(doc(db, 'publicProducts', input.productId)).catch(() => null);
  if (directDoc?.exists()) candidates.push({ id: directDoc.id, ...directDoc.data() });

  const sourceSnapshot = await getDocs(
    query(collection(db, 'publicProducts'), where('sourceProductId', '==', input.productId), limit(10)),
  ).catch(() => null);
  sourceSnapshot?.docs.forEach((productDoc) => candidates.push({ id: productDoc.id, ...productDoc.data() }));

  const matched = candidates.find((candidate) => cleanText(candidate.storeId, 140) === input.merchantId) ?? candidates[0];
  if (!matched) return null;

  return {
    name: cleanText(matched.productName ?? matched.name, 220) || undefined,
    price: cleanNumber(matched.price),
    currency: cleanText(matched.currency, 20) || 'GHS',
    publicProductId: cleanText(matched.id, 220) || undefined,
    sourceProductId: cleanText(matched.sourceProductId, 220) || undefined,
  };
};

export async function POST(request: NextRequest) {
  try {
    if (!db || firebaseConfigError) {
      return NextResponse.json({ error: 'Firestore not configured' }, { status: 500 });
    }

    const body = (await request.json()) as PayOnDeliveryOrderBody;
    const merchantId = cleanText(body.merchantId, 140);
    const productId = cleanText(body.productId, 180);
    const customerName = cleanText(body.customer?.name, 160);
    const customerEmail = cleanText(body.customer?.email, 180).toLowerCase();
    const customerPhone = cleanText(body.customer?.phone, 80);
    const deliveryLocation = cleanText(body.delivery?.location, 300);
    const notes = cleanText(body.delivery?.notes, 1200);
    const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1));
    const sourceChannel = normalizeSourceChannel(body.sourceChannel);
    const sourceLabel = getSourceLabel(sourceChannel, body.sourceLabel);

    if (!merchantId) return NextResponse.json({ error: 'merchantId is required' }, { status: 400 });
    if (!productId) return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    if (!customerName) return NextResponse.json({ error: 'customer.name is required' }, { status: 400 });
    if (!customerEmail && !customerPhone) return NextResponse.json({ error: 'customer email or phone is required' }, { status: 400 });
    if (!deliveryLocation) return NextResponse.json({ error: 'delivery.location is required' }, { status: 400 });

    const productSnapshot = await readProductPriceSnapshot({ merchantId, productId });
    const unitPrice = cleanNumber(body.unitPrice) ?? productSnapshot?.price ?? null;
    const currency = cleanText(body.currency, 20) || productSnapshot?.currency || 'GHS';
    const productName = cleanText(body.productName, 220) || productSnapshot?.name || 'Product order';
    const subtotal = unitPrice == null ? 0 : roundMoney(unitPrice * quantity);

    const reference = createCheckoutReference(merchantId);
    const clientOrderId = cleanText(body.clientOrderId, 180) || `MARKET-POD-${reference}`;
    const cartItem: CheckoutItem & { name?: string; unitPrice?: number | null; subtotal?: number; publicProductId?: string; sourceProductId?: string } = {
      merchantId,
      productId,
      quantity,
      type: 'PRODUCT',
      name: productName,
      unitPrice,
      subtotal,
      publicProductId: productSnapshot?.publicProductId,
      sourceProductId: productSnapshot?.sourceProductId ?? productId,
    };
    const feePolicy = buildFreePayOnDeliveryFeePolicy({ amount: subtotal, currency });

    const orderRecord = {
      recordType: 'product_order',
      orderType: 'product',
      merchantId,
      storeId: merchantId,
      reference,
      clientOrderId,
      client_order_id: clientOrderId,
      sedifexOrderId: reference,
      sourceChannel,
      source_channel: sourceChannel,
      sourceLabel,
      source_label: sourceLabel,
      productId,
      productName,
      customer: {
        name: customerName,
        email: customerEmail || null,
        phone: customerPhone || null,
      },
      delivery: {
        location: deliveryLocation,
        notes: notes || null,
      },
      deliveryLocation,
      notes: notes || null,
      cart: [cartItem],
      items: [cartItem],
      pricingSnapshot: {
        currency,
        subtotal,
        unitPrice,
        quantity,
        final_total: subtotal,
        feePolicy,
        marketplaceFees: feePolicy,
        marketplace_fees: feePolicy,
      },
      pricing_snapshot: {
        currency,
        subtotal,
        unitPrice,
        quantity,
        final_total: subtotal,
        feePolicy,
        marketplaceFees: feePolicy,
        marketplace_fees: feePolicy,
      },
      payment: {
        mode: 'pay_on_delivery',
        status: 'pending_cash_collection',
        amount: subtotal,
        currency,
        reference,
        feePolicy,
        customerTotal: subtotal,
        sedifexCommission: 0,
        merchantNet: subtotal,
      },
      paymentReference: reference,
      payment_reference: reference,
      paymentStatus: 'pending_cash_collection',
      payment_status: 'pending_cash_collection',
      orderStatus: 'pending_delivery',
      order_status: 'pending_delivery',
      paymentCollectionMode: 'pay_on_delivery',
      sedifexCommissionStatus: 'free_launch_period',
      source: sourceChannel,
      syncStatus: 'pending',
      syncRequestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      createdAtServer: serverTimestamp(),
      updatedAt: new Date().toISOString(),
      updatedAtServer: serverTimestamp(),
    };

    const created = await addDoc(collection(db, 'integrationOrders'), orderRecord);

    return NextResponse.json({
      ok: true,
      orderId: created.id,
      sedifexOrderId: created.id,
      clientOrderId,
      reference,
      paymentStatus: 'pending_cash_collection',
      orderStatus: 'pending_delivery',
      sourceChannel,
      subtotal,
      feePolicy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create pay-on-delivery order';
    console.error('order.request.failed', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
