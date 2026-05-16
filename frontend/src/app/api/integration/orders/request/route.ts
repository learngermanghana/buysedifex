import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
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

const cleanText = (value: unknown, max = 300) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const cleanNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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

export async function POST(request: NextRequest) {
  try {
    if (!db || firebaseConfigError) {
      return NextResponse.json({ error: 'Firestore not configured' }, { status: 500 });
    }

    const body = (await request.json()) as PayOnDeliveryOrderBody;
    const merchantId = cleanText(body.merchantId, 140);
    const productId = cleanText(body.productId, 180);
    const productName = cleanText(body.productName, 220) || 'Product order';
    const customerName = cleanText(body.customer?.name, 160);
    const customerEmail = cleanText(body.customer?.email, 180).toLowerCase();
    const customerPhone = cleanText(body.customer?.phone, 80);
    const deliveryLocation = cleanText(body.delivery?.location, 300);
    const notes = cleanText(body.delivery?.notes, 1200);
    const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1));
    const unitPrice = cleanNumber(body.unitPrice);
    const currency = cleanText(body.currency, 20) || 'GHS';
    const subtotal = unitPrice == null ? 0 : Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100;

    if (!merchantId) return NextResponse.json({ error: 'merchantId is required' }, { status: 400 });
    if (!productId) return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    if (!customerName) return NextResponse.json({ error: 'customer.name is required' }, { status: 400 });
    if (!customerEmail && !customerPhone) return NextResponse.json({ error: 'customer email or phone is required' }, { status: 400 });
    if (!deliveryLocation) return NextResponse.json({ error: 'delivery.location is required' }, { status: 400 });

    const reference = createCheckoutReference(merchantId);
    const cartItem: CheckoutItem & { name?: string; unitPrice?: number | null; subtotal?: number } = {
      merchantId,
      productId,
      quantity,
      type: 'PRODUCT',
      name: productName,
      unitPrice,
      subtotal,
    };
    const feePolicy = buildFreePayOnDeliveryFeePolicy({ amount: subtotal, currency });

    const orderRecord = {
      recordType: 'product_order',
      merchantId,
      storeId: merchantId,
      reference,
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
        final_total: subtotal,
        feePolicy,
        marketplaceFees: feePolicy,
        marketplace_fees: feePolicy,
      },
      pricing_snapshot: {
        currency,
        subtotal,
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
      source: 'sedifex_market',
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
      reference,
      paymentStatus: 'pending_cash_collection',
      orderStatus: 'pending_delivery',
      feePolicy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create pay-on-delivery order';
    console.error('order.request.failed', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
