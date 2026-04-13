import { NextResponse } from 'next/server';
import { listIntegrationCategoryKeys } from '@/lib/sedifex-integration-api';

export async function GET() {
  try {
    const response = await listIntegrationCategoryKeys();
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json({ items: [], error: (error as Error).message }, { status: 502 });
  }
}
