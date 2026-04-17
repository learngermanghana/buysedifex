import { NextRequest, NextResponse } from 'next/server';
import { persistAnalytics } from '@/lib/server-analytics';

type LeadPayload = {
  productId?: string;
  productName?: string;
  name?: string;
  phone?: string;
  notes?: string;
  location?: string;
  branchLocationId?: string;
  branchId?: string;
  locationId?: string;
  storeBranchId?: string;
  quantity?: number;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as LeadPayload;
  const normalizedNotes =
    body.notes ??
    body.location ??
    body.branchLocationId ??
    body.branchId ??
    body.locationId ??
    body.storeBranchId;

  if (
    !isNonEmptyString(body.productId) ||
    !isNonEmptyString(body.productName) ||
    !isNonEmptyString(body.name) ||
    !isNonEmptyString(body.phone) ||
    !isNonEmptyString(normalizedNotes) ||
    typeof body.quantity !== 'number' ||
    Number.isNaN(body.quantity) ||
    body.quantity < 1
  ) {
    return NextResponse.json({ error: 'Invalid lead payload' }, { status: 400 });
  }

  const lead = {
    productId: body.productId.trim(),
    productName: body.productName.trim(),
    name: body.name.trim(),
    phone: body.phone.trim(),
    notes: normalizedNotes.trim(),
    quantity: Math.floor(body.quantity),
    createdAt: new Date().toISOString(),
    source: 'product-request-form',
  };

  await persistAnalytics('leads', lead);
  console.info('[lead_created]', lead);

  return NextResponse.json({ ok: true, lead });
}
