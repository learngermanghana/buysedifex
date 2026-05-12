import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';
import {
  createCheckoutReference,
  createMerchantCheckout,
  groupCartByMerchant,
  previewMerchantCheckout,
  type CheckoutItem,
} from '@/lib/sedifex-checkout';

type CheckoutCreateBody = {
  cart?: CheckoutItem[];
  customer?: { email?: string; phone?: string };
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CheckoutCreateBody;
  const cart = Array.isArray(body.cart) ? body.cart : [];

  if (cart.length === 0) {
    return NextResponse.json({ error: 'Cart is required' }, { status: 400 });
  }

  const grouped = groupCartByMerchant(cart);

  const merchantResults = await Promise.all(
    Array.from(grouped.entries()).map(async ([merchantId, merchantCart]) => {
      const preview = await previewMerchantCheckout(merchantId, merchantCart);
      const reference = createCheckoutReference(merchantId);
      const checkout = await createMerchantCheckout(merchantId, merchantCart, reference);

      const checkoutRecord = {
        merchantId,
        reference,
        customer: body.customer ?? null,
        cart: merchantCart,
        pricingSnapshot: preview,
        paymentReference: reference,
        paymentStatus: 'pending',
        orderStatus: 'pending',
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
      };

      return {
        merchantId,
        reference,
        bookingId: checkoutPayload.bookingId ?? reference,
        checkoutUrl: checkoutPayload.authorizationUrl ?? checkoutPayload.checkoutUrl,
        preview,
      };
    }),
  );

  return NextResponse.json({ ok: true, merchantCheckouts: merchantResults });
}
