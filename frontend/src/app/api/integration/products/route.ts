import { NextRequest, NextResponse } from 'next/server';
import { listIntegrationProducts } from '@/lib/sedifex-integration-api';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const response = await listIntegrationProducts({
      categoryKey: params.get('categoryKey') ?? undefined,
      page: Number(params.get('page') ?? '1'),
      pageSize: Number(params.get('pageSize') ?? '12'),
      sort: params.get('sort') ?? 'newest',
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json({ items: [], hasMore: false, error: (error as Error).message }, { status: 502 });
  }
}
