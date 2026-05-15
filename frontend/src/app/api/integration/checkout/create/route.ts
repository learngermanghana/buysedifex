import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';
import {
  createCheckoutReference,
  createMerchantCheckout,
  groupCartByMerchant,
  previewMerchantCheckout,
  type CheckoutItem,
  type SedifexCheckoutPreviewResponse,
} from '@/lib/sedifex-checkout';

type CheckoutCreateBody = {
  cart?: CheckoutItem[];
  customer?: { email?: string; phone?: string };
};

export async function POST(request: NextRequest) {
  console.info('checkout.create.requested');

  try {
    const body = (await request.json()) as CheckoutCreateBody;
    const cart = Array.isArray(body.cart) ? body.cart : [];

    if (cart.length === 0) {
      console.warn('checkout.create.failed', { reason: 'empty_cart' });
      return NextResponse.json({ error: 'Cart is required' }, { status: 400 });
    }

    const grouped = groupCartByMerchant(cart);
    console.info('checkout.create.grouped', { merchantIds: Array.from(grouped.keys()) });

    const merchantResults = await Promise.all(
      Array.from(grouped.entries()).map(async ([merchantId, merchantCart]) => {
      console.info('checkout.create.merchant.started', { merchantId, cartItems: merchantCart.length });
      const preview = await previewMerchantCheckout(merchantId, merchantCart);
      console.info('checkout.create.merchant.preview_succeeded', { merchantId });
      const reference = createCheckoutReference(merchantId);
      const checkout = await createMerchantCheckout(merchantId, merchantCart, reference, preview);
      console.info('checkout.create.merchant.checkout_succeeded', { merchantId, reference });

      const checkoutRecord = {
        merchantId,
        reference,
        customer: body.customer ?? null,
        cart: merchantCart,
        pricingSnapshot: preview,
        pricing_snapshot: preview,
        paymentReference: reference,
        payment_reference: reference,
        paymentStatus: 'pending',
        payment_status: 'pending',
        orderStatus: 'pending',
        order_status: 'pending',
        bookingStatus: 'booked',
        paymentCollectionMode: 'online_checkout',
        syncStatus: 'pending',
        syncRequestedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdAtServer: serverTimestamp(),
      };

      if (db && !firebaseConfigError) {
        await addDoc(collection(db, 'integrationBookings'), checkoutRecord);
      }

      const checkoutPayload = checkout as {
        authorizationUrl?: string;
        checkoutUrl?: string;
        bookingId?: string;
        payment_reference?: string;
        payment_status?: string;
        order_status?: string;
        pricing_snapshot?: SedifexCheckoutPreviewResponse;
      };

      return {
        merchantId,
        reference,
        payment_reference: checkoutPayload.payment_reference ?? reference,
        payment_status: checkoutPayload.payment_status ?? 'pending',
        order_status: checkoutPayload.order_status ?? 'pending',
        bookingId: checkoutPayload.bookingId ?? reference,
        checkoutUrl: checkoutPayload.authorizationUrl ?? checkoutPayload.checkoutUrl,
        preview: checkoutPayload.pricing_snapshot ?? preview,
      };
      }),
    );

    console.info('checkout.create.succeeded', { merchants: merchantResults.length });
    return NextResponse.json({ ok: true, merchantCheckouts: merchantResults });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown checkout error';
    const missingStoreId = message.includes('missing-store-id');
    console.error('checkout.create.failed', { message, cause: missingStoreId ? 'upstream_missing_store_id' : 'unknown' });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
