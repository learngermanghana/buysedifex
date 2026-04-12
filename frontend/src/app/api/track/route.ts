import { NextRequest, NextResponse } from 'next/server';

type TrackPayload = {
  eventName?: string;
  payload?: Record<string, unknown>;
};

const allowedEvents = new Set(['product_view', 'whatsapp_click', 'request_submit']);

export async function POST(request: NextRequest) {
  const body = (await request.json()) as TrackPayload;

  if (!body.eventName || !allowedEvents.has(body.eventName)) {
    return NextResponse.json({ error: 'Unsupported eventName' }, { status: 400 });
  }

  console.info('[tracking_event]', {
    eventName: body.eventName,
    payload: body.payload ?? {},
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
