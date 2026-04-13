import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';

type ConcernPayload = {
  name?: string;
  contact?: string;
  concernType?: string;
  details?: string;
  pagePath?: string;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ConcernPayload;

  if (
    !isNonEmptyString(body.name) ||
    !isNonEmptyString(body.contact) ||
    !isNonEmptyString(body.concernType) ||
    !isNonEmptyString(body.details)
  ) {
    return NextResponse.json({ error: 'Invalid concern payload' }, { status: 400 });
  }

  if (!db || firebaseConfigError) {
    return NextResponse.json({ error: 'Concern reporting is not configured' }, { status: 503 });
  }

  const concern = {
    name: body.name.trim(),
    contact: body.contact.trim(),
    concernType: body.concernType.trim(),
    details: body.details.trim(),
    pagePath: isNonEmptyString(body.pagePath) ? body.pagePath.trim() : '/contact',
    source: 'contact-page-concern-form',
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'concerns'), concern);

  return NextResponse.json({ ok: true, concernId: docRef.id });
}
