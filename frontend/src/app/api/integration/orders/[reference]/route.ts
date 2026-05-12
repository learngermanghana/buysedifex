import { NextRequest, NextResponse } from 'next/server';

const getContractVersion = () => process.env.SEDIFEX_INTEGRATION_API_VERSION ?? '2026-04-13';

export async function GET(_request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const token = process.env.SEDIFEX_PARTNER_API_TOKEN;
  const baseUrl = process.env.SEDIFEX_INTEGRATION_API_BASE_URL;

  if (!token || !baseUrl) {
    return NextResponse.json({ error: 'Sedifex integration is not configured' }, { status: 503 });
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/integration/orders/${encodeURIComponent(reference)}`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'X-Sedifex-Contract-Version': getContractVersion(),
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({ ok: false, reference }));
  return NextResponse.json(payload, { status: response.status });
}
