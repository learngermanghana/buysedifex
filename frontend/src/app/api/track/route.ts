import { NextRequest, NextResponse } from 'next/server';
import { persistAnalytics } from '@/lib/server-analytics';

type TrackPayload = {
  eventName?: string;
  payload?: Record<string, unknown>;
};

const allowedEvents = new Set([
  'product_view',
  'whatsapp_click',
  'request_submit',
  'promo_impression',
  'promo_click',
  'save_item',
]);

export async function POST(request: NextRequest) {
  const body = (await request.json()) as TrackPayload;

  if (!body.eventName || !allowedEvents.has(body.eventName)) {
    return NextResponse.json({ error: 'Unsupported eventName' }, { status: 400 });
  }

  const payload = {
    eventName: body.eventName,
    payload: body.payload ?? {},
  };

  await persistAnalytics('track', payload);
  console.info('[tracking_event]', payload);

  return NextResponse.json({ ok: true });
}
