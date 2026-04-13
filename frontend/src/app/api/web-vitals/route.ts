import { NextRequest, NextResponse } from 'next/server';
import { persistAnalytics } from '@/lib/server-analytics';

export async function POST(request: NextRequest) {
  const body = await request.json();
  await persistAnalytics('web-vitals', { metric: body as Record<string, unknown> });
  console.info('[web-vitals]', body);
  return NextResponse.json({ ok: true });
}
