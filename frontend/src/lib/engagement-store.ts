import crypto from 'crypto';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, firebaseConfigError } from '@/lib/firebase';

type EngagementIdentityInput = {
  publicProductId?: string;
  public_product_id?: string;
  storeId?: string;
  store_id?: string;
  sourceProductId?: string;
  source_product_id?: string;
};

type ResolvedIdentity = {
  publicProductId: string;
  storeId: string;
  sourceProductId: string;
  canonicalProductKey: string;
};

export type EngagementCommentRecord = {
  id: string;
  text: string;
  body: string;
  authorName: string;
  authorDisplayName: string;
  moderationStatus: string;
  status: string;
  visibility: string;
  originPlatform: string;
  createdAt?: string;
};

const cleanText = (value: unknown, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const requireDb = () => {
  if (!db || firebaseConfigError) {
    throw new Error(firebaseConfigError || 'Firebase is not configured.');
  }
  return db;
};

const toIso = (value: unknown) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  return undefined;
};

const stableViewerId = (token?: string | null) => {
  const cleanToken = cleanText(token, 5000);
  if (!cleanToken) return '';
  return crypto.createHash('sha256').update(cleanToken).digest('hex').slice(0, 40);
};

export async function resolveEngagementIdentity(input: EngagementIdentityInput): Promise<ResolvedIdentity> {
  const firestore = requireDb();
  const publicProductId = cleanText(input.publicProductId ?? input.public_product_id, 180);
  let storeId = cleanText(input.storeId ?? input.store_id, 180);
  let sourceProductId = cleanText(input.sourceProductId ?? input.source_product_id, 220);

  if ((!storeId || !sourceProductId) && publicProductId) {
    const productSnap = await getDoc(doc(firestore, 'publicProducts', publicProductId));
    if (productSnap.exists()) {
      const data = productSnap.data() as Record<string, unknown>;
      storeId = storeId || cleanText(data.storeId, 180);
      sourceProductId = sourceProductId || cleanText(data.sourceProductId, 220) || publicProductId;
    }
  }

  if (!storeId || !sourceProductId) {
    throw new Error('Unable to resolve product engagement identity.');
  }

  return {
    publicProductId,
    storeId,
    sourceProductId,
    canonicalProductKey: `${storeId}:${sourceProductId}`,
  };
}

async function ensureThread(identity: ResolvedIdentity) {
  const firestore = requireDb();
  try {
    await setDoc(doc(firestore, 'engagement_threads', identity.canonicalProductKey), {
      canonicalProductKey: identity.canonicalProductKey,
      storeId: identity.storeId,
      sourceProductId: identity.sourceProductId,
      publicProductId: identity.publicProductId || null,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.warn('engagement.thread.ensure.skipped', error);
  }
}

export async function listComments(input: EngagementIdentityInput): Promise<EngagementCommentRecord[]> {
  const firestore = requireDb();
  const identity = await resolveEngagementIdentity(input);
  const snapshot = await getDocs(
    query(collection(firestore, 'engagement_comments'), where('canonicalProductKey', '==', identity.canonicalProductKey), limit(100)),
  );

  return snapshot.docs
    .map((commentDoc) => {
      const data = commentDoc.data() as Record<string, unknown>;
      const status = cleanText(data.status ?? data.moderationStatus, 40) || 'approved';
      const body = cleanText(data.body ?? data.text, 2000);
      const authorDisplayName = cleanText(data.authorDisplayName ?? data.authorName, 160) || 'Customer';
      return {
        id: commentDoc.id,
        text: body,
        body,
        authorName: authorDisplayName,
        authorDisplayName,
        moderationStatus: status,
        status,
        visibility: cleanText(data.visibility, 40) || 'public',
        originPlatform: cleanText(data.originPlatform, 80) || 'sedifexmarket',
        createdAt: toIso(data.createdAt),
      };
    })
    .filter((comment) => comment.visibility !== 'store_only' && comment.status !== 'rejected')
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
}

export async function createComment(input: EngagementIdentityInput & { text?: string; body?: string; token?: string; authorDisplayName?: string }) {
  const firestore = requireDb();
  const identity = await resolveEngagementIdentity(input);
  const body = cleanText(input.body ?? input.text, 2000);
  if (!body) throw new Error('Comment text is required.');

  const comment = await addDoc(collection(firestore, 'engagement_comments'), {
    canonicalProductKey: identity.canonicalProductKey,
    storeId: identity.storeId,
    sourceProductId: identity.sourceProductId,
    publicProductId: identity.publicProductId || null,
    body,
    text: body,
    rating: null,
    authorUserId: stableViewerId(input.token) || null,
    authorDisplayName: cleanText(input.authorDisplayName, 160) || 'Customer',
    authorName: cleanText(input.authorDisplayName, 160) || 'Customer',
    originPlatform: 'sedifexmarket',
    status: 'approved',
    moderationStatus: 'approved',
    visibility: 'public',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await ensureThread(identity);
  await updateThreadCounts(identity).catch((error) => console.warn('engagement.thread.counts.skipped', error));
  return { id: comment.id, ok: true, moderationStatus: 'approved' };
}

export async function updateFavorite(input: EngagementIdentityInput & { token?: string; reaction?: string }) {
  const firestore = requireDb();
  const identity = await resolveEngagementIdentity(input);
  const viewerId = stableViewerId(input.token);
  if (!viewerId) throw new Error('Sign in is required to favorite products.');

  const favoriteRef = doc(firestore, 'engagement_favorites', `${identity.canonicalProductKey}_${viewerId}`);
  const isFavorite = input.reaction !== 'unfavorite';

  await setDoc(favoriteRef, {
    canonicalProductKey: identity.canonicalProductKey,
    storeId: identity.storeId,
    sourceProductId: identity.sourceProductId,
    publicProductId: identity.publicProductId || null,
    userId: viewerId,
    originPlatform: 'sedifexmarket',
    active: isFavorite,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await ensureThread(identity);
  await updateThreadCounts(identity).catch((error) => console.warn('engagement.thread.counts.skipped', error));
  return { ok: true, isFavoritedByViewer: isFavorite };
}

export async function getSummary(input: EngagementIdentityInput & { token?: string }) {
  const firestore = requireDb();
  const identity = await resolveEngagementIdentity(input);
  const comments = await getDocs(query(collection(firestore, 'engagement_comments'), where('canonicalProductKey', '==', identity.canonicalProductKey), limit(200)));
  const favorites = await getDocs(query(collection(firestore, 'engagement_favorites'), where('canonicalProductKey', '==', identity.canonicalProductKey), limit(500)));
  const viewerId = stableViewerId(input.token);
  const commentsCount = comments.docs.filter((commentDoc) => {
    const data = commentDoc.data() as Record<string, unknown>;
    return cleanText(data.status ?? data.moderationStatus, 40) !== 'rejected' && cleanText(data.visibility, 40) !== 'store_only';
  }).length;
  const activeFavorites = favorites.docs.filter((favoriteDoc) => (favoriteDoc.data() as Record<string, unknown>).active !== false);
  const isFavoritedByViewer = viewerId ? activeFavorites.some((favoriteDoc) => favoriteDoc.id.endsWith(`_${viewerId}`)) : false;

  setDoc(doc(firestore, 'engagement_threads', identity.canonicalProductKey), {
    canonicalProductKey: identity.canonicalProductKey,
    storeId: identity.storeId,
    sourceProductId: identity.sourceProductId,
    publicProductId: identity.publicProductId || null,
    commentsCount,
    favoritesCount: activeFavorites.length,
    updatedAt: serverTimestamp(),
  }, { merge: true }).catch((error) => console.warn('engagement.thread.summary.skipped', error));

  return { commentsCount, favoritesCount: activeFavorites.length, isFavoritedByViewer };
}

async function updateThreadCounts(identity: ResolvedIdentity) {
  await getSummary(identity);
}