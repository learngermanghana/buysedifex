import { NextRequest, NextResponse } from 'next/server';
import { createComment, listComments } from '@/lib/engagement-store';

const cleanText = (value: unknown, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const comments = await listComments({
      publicProductId: searchParams.get('public_product_id') ?? searchParams.get('publicProductId') ?? undefined,
      storeId: searchParams.get('store_id') ?? searchParams.get('storeId') ?? undefined,
      sourceProductId: searchParams.get('source_product_id') ?? searchParams.get('sourceProductId') ?? undefined,
    });
    return NextResponse.json({ ok: true, comments });
  } catch (error) {
    console.error('engagement.comments.get.failed', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to load comments.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const authorization = request.headers.get('authorization') ?? '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    const result = await createComment({
      publicProductId: cleanText(body.public_product_id ?? body.publicProductId, 180),
      storeId: cleanText(body.store_id ?? body.storeId, 180),
      sourceProductId: cleanText(body.source_product_id ?? body.sourceProductId, 220),
      text: cleanText(body.text ?? body.body, 2000),
      authorDisplayName: cleanText(body.authorDisplayName ?? body.author_name, 160),
      token,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('engagement.comments.post.failed', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to post comment.' }, { status: 500 });
  }
}
