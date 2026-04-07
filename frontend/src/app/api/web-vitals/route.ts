import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  console.info('[web-vitals]', body);
  return NextResponse.json({ ok: true });
}
