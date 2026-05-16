import { NextRequest, NextResponse } from 'next/server';
import { updateFavorite } from '@/lib/engagement-store';

const cleanText = (value: unknown, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const authorization = request.headers.get('authorization') ?? '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    const result = await updateFavorite({
      publicProductId: cleanText(body.public_product_id ?? body.publicProductId, 180),
      storeId: cleanText(body.store_id ?? body.storeId, 180),
      sourceProductId: cleanText(body.source_product_id ?? body.sourceProductId, 220),
      reaction: cleanText(body.reaction, 40) || 'favorite',
      token,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('engagement.reactions.post.failed', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to update favorite.' }, { status: 500 });
  }
}
