import { NextRequest, NextResponse } from 'next/server';
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

    const merchantToken = getMerchantToken(merchantId);
    const baseUrl = getIntegrationApiBaseUrl();
    const endpoint = `${baseUrl}/integration/orders/${encodeURIComponent(reference)}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Sedifex-Contract-Version': getContractVersion(),
        Authorization: `Bearer ${merchantToken}`,
        'x-api-key': merchantToken,
      },
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'sedifex-order-status-failed',
          status: response.status,
          details: payload,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(payload ?? { ok: false, error: 'empty-sedifex-response' }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown order status error';
    console.error('checkout.order_status.failed', { message });
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
