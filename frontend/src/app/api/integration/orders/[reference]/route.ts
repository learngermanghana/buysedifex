import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';
import { getMerchantToken } from '@/lib/sedifex-checkout';

const getRequiredEnv = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

const getIntegrationApiBaseUrl = () => {
  const rawBaseUrl = getRequiredEnv('SEDIFEX_INTEGRATION_API_BASE_URL');
  let parsed: URL;
  try {
    parsed = new URL(rawBaseUrl);
  } catch {
    throw new Error('SEDIFEX_INTEGRATION_API_BASE_URL must be an absolute URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('SEDIFEX_INTEGRATION_API_BASE_URL must use http or https protocol.');
  }
  return parsed.toString().replace(/\/$/, '');
};

const getContractVersion = () => process.env.SEDIFEX_INTEGRATION_API_VERSION ?? '2026-04-13';

const getMerchantIdFromReference = (reference: string) => {
  const firstSeparatorIndex = reference.indexOf('_');
  if (firstSeparatorIndex <= 0) return '';
  return reference.slice(0, firstSeparatorIndex).trim();
};

type RouteContext = {
  params: Promise<{ reference: string }> | { reference: string };
};

const findLocalRecordByReference = async (reference: string) => {
  if (!db || firebaseConfigError) return null;

  for (const collectionName of ['integrationOrders', 'integrationBookings']) {
    const snapshot = await getDocs(query(collection(db, collectionName), where('reference', '==', reference), limit(1)));
    const hit = snapshot.docs[0];
    if (hit) return { id: hit.id, collectionName, data: hit.data() as Record<string, unknown> };
  }

  return null;
};

const normalizeLocalRecord = (record: Awaited<ReturnType<typeof findLocalRecordByReference>>, reference: string) => {
  if (!record) return null;
  const data = record.data;
  return {
    ok: true,
    id: record.id,
    collectionName: record.collectionName,
    recordType: data.recordType ?? (record.collectionName === 'integrationBookings' ? 'service_booking' : 'product_order'),
    reference: data.reference ?? reference,
    paymentReference: data.paymentReference ?? data.payment_reference ?? reference,
    paymentStatus: data.paymentStatus ?? data.payment_status ?? 'pending',
    orderStatus: data.orderStatus ?? data.order_status ?? data.bookingStatus ?? 'processing',
    bookingStatus: data.bookingStatus ?? null,
    merchantId: data.merchantId ?? data.storeId ?? null,
    storeId: data.storeId ?? data.merchantId ?? null,
    customer: data.customer ?? null,
    items: data.items ?? data.cart ?? [],
    cart: data.cart ?? data.items ?? [],
    pricingSnapshot: data.pricingSnapshot ?? data.pricing_snapshot ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    paymentConfirmedAt: data.paymentConfirmedAt ?? null,
    sedifexOrderId: data.sedifexOrderId ?? null,
    clientOrderId: data.clientOrderId ?? null,
  };
};

const isSettledLocalStatus = (payload: Record<string, unknown>) => {
  const paymentStatus = String(payload.paymentStatus ?? '').toLowerCase();
  const orderStatus = String(payload.orderStatus ?? '').toLowerCase();
  return ['confirmed', 'success', 'paid', 'captured'].includes(paymentStatus) || ['confirmed', 'success', 'paid', 'completed'].includes(orderStatus);
};

async function fetchUpstreamOrder(reference: string, merchantId: string) {
  const merchantToken = getMerchantToken(merchantId);
  const baseUrl = getIntegrationApiBaseUrl();
  const upstreamUrl = new URL(`${baseUrl}/integration/orders/${encodeURIComponent(reference)}`);
  upstreamUrl.searchParams.set('store_id', merchantId);
  upstreamUrl.searchParams.set('merchant_id', merchantId);
  upstreamUrl.searchParams.set('storeId', merchantId);
  upstreamUrl.searchParams.set('merchantId', merchantId);

  const response = await fetch(upstreamUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Sedifex-Contract-Version': getContractVersion(),
      Authorization: `Bearer ${merchantToken}`,
      'x-api-key': merchantToken,
      'x-sedifex-store-id': merchantId,
    },
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { response, payload };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { reference: rawReference } = await Promise.resolve(context.params);
    const reference = decodeURIComponent(rawReference ?? '').trim();
    if (!reference) {
      return NextResponse.json({ ok: false, error: 'missing-reference' }, { status: 400 });
    }

    const merchantId = getMerchantIdFromReference(reference);
    if (!merchantId) {
      return NextResponse.json({ ok: false, error: 'invalid-reference' }, { status: 400 });
    }

    const localRecord = normalizeLocalRecord(await findLocalRecordByReference(reference), reference);
    if (localRecord && isSettledLocalStatus(localRecord)) {
      return NextResponse.json(localRecord, { headers: { 'Cache-Control': 'no-store' } });
    }

    try {
      const { response, payload } = await fetchUpstreamOrder(reference, merchantId);
      if (response.ok) {
        return NextResponse.json(payload ?? localRecord ?? { ok: false, error: 'empty-sedifex-response' }, {
          headers: { 'Cache-Control': 'no-store' },
        });
      }

      if (localRecord) {
        return NextResponse.json({ ...localRecord, upstreamStatusWarning: response.status, upstreamDetails: payload }, { headers: { 'Cache-Control': 'no-store' } });
      }

      return NextResponse.json(
        {
          ok: false,
          error: 'sedifex-order-status-failed',
          status: response.status,
          details: payload,
        },
        { status: response.status },
      );
    } catch (upstreamError) {
      if (localRecord) {
        return NextResponse.json(
          {
            ...localRecord,
            upstreamError: upstreamError instanceof Error ? upstreamError.message : 'Unable to reach Sedifex order status endpoint',
          },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }
      throw upstreamError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown order status error';
    console.error('checkout.order_status.failed', { message });
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
