import { NextRequest, NextResponse } from 'next/server';
import { lookupGuestOrder, saveOrderSupportTicket } from '@/lib/guest-order-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { reference?: string; email?: string; phone?: string; issueType?: string; message?: string; evidenceUrl?: string } | null;
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (message.length < 10) return NextResponse.json({ ok: false, error: 'Please describe the issue in at least 10 characters.' }, { status: 400 });

    const lookup = await lookupGuestOrder(body?.reference || '', { email: body?.email || '', phone: body?.phone || '' });
    if (!lookup.ok) return NextResponse.json({ ok: false, error: lookup.error }, { status: lookup.status });

    const ticket = await saveOrderSupportTicket({
      order: lookup.order,
      rawOrder: lookup.rawOrder,
      identity: { email: body?.email || '', phone: body?.phone || '' },
      issueType: body?.issueType || 'other',
      message,
      evidenceUrl: body?.evidenceUrl || '',
    });

    return NextResponse.json({ ok: true, ticket });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to create support ticket.' }, { status: 500 });
  }
}
