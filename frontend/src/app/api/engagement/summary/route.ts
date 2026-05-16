import { NextRequest, NextResponse } from 'next/server';
import { getSummary } from '@/lib/engagement-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authorization = request.headers.get('authorization') ?? '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    const summary = await getSummary({
      publicProductId: searchParams.get('public_product_id') ?? searchParams.get('publicProductId') ?? undefined,
      storeId: searchParams.get('store_id') ?? searchParams.get('storeId') ?? undefined,
      sourceProductId: searchParams.get('source_product_id') ?? searchParams.get('sourceProductId') ?? undefined,
      token,
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error('engagement.summary.get.failed', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to load summary.' }, { status: 500 });
  }
}
