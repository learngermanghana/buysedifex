import { NextRequest, NextResponse } from 'next/server';
import { lookupGuestOrder } from '@/lib/guest-order-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { reference?: string; email?: string; phone?: string } | null;
    const result = await lookupGuestOrder(body?.reference || '', { email: body?.email || '', phone: body?.phone || '' });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, order: result.order }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to look up order.' }, { status: 500 });
  }
}
