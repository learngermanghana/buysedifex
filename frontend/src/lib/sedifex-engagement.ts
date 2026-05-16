import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type SedifexModerationStatus = 'approved' | 'pending' | 'rejected' | string;

export type SedifexComment = {
  id: string;
  text: string;
  authorName?: string;
  createdAt?: string;
  moderationStatus?: SedifexModerationStatus;
};

export type SedifexCommentSummary = {
  favoritesCount: number;
  commentsCount: number;
  isFavoritedByViewer: boolean;
};

type EngagementIdentityInput = {
  publicProductId: string;
  storeId?: string;
  sourceProductId?: string;
};

const cleanText = (value: unknown, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const requireDb = () => {
  if (!db) throw new Error('Firebase is not configured for Sedifex Market comments.');
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

const resolveIdentity = (input: EngagementIdentityInput) => {
  const publicProductId = cleanText(input.publicProductId, 180);
  const storeId = cleanText(input.storeId, 180) || 'sedifexmarket';
  const sourceProductId = cleanText(input.sourceProductId, 220) || publicProductId;

  if (!publicProductId && !sourceProductId) {
    throw new Error('Product ID is required before comments can load.');
  }

  return {
    publicProductId,
    storeId,
    sourceProductId,
    canonicalProductKey: `${storeId}:${sourceProductId || publicProductId}`,
  };
};

const writeThreadSummary = async (identity: ReturnType<typeof resolveIdentity>, commentsCount?: number) => {
  try {
    const firestore = requireDb();
    await setDoc(doc(firestore, 'engagement_threads', identity.canonicalProductKey), {
      canonicalProductKey: identity.canonicalProductKey,
      storeId: identity.storeId,
      sourceProductId: identity.sourceProductId,
      publicProductId: identity.publicProductId || null,
      ...(typeof commentsCount === 'number' ? { commentsCount } : {}),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.warn('engagement.thread.write.skipped', error);
  }
};

export const listEngagementComments = async (input: EngagementIdentityInput): Promise<SedifexComment[]> => {
  const firestore = requireDb();
  const identity = resolveIdentity(input);
  const snapshot = await getDocs(
    query(collection(firestore, 'engagement_comments'), where('canonicalProductKey', '==', identity.canonicalProductKey), limit(100)),
  );

  return snapshot.docs
    .map((commentDoc) => {
      const data = commentDoc.data() as Record<string, unknown>;
      const text = cleanText(data.text ?? data.body, 2000);
      const moderationStatus = cleanText(data.moderationStatus ?? data.status, 40) || 'approved';
      return {
        id: commentDoc.id,
        text,
        authorName: cleanText(data.authorName ?? data.authorDisplayName, 160) || 'Customer',
        createdAt: toIso(data.createdAt),
        moderationStatus,
      };
    })
    .filter((item) => item.text && item.moderationStatus !== 'rejected')
    .sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')));
};

export const getEngagementSummary = async (input: EngagementIdentityInput & { token?: string }): Promise<SedifexCommentSummary> => {
  try {
    const comments = await listEngagementComments(input);
    await writeThreadSummary(resolveIdentity(input), comments.length);
    return {
      favoritesCount: 0,
      commentsCount: comments.length,
      isFavoritedByViewer: false,
    };
  } catch (error) {
    console.warn('engagement.summary.firebase.failed', error);
    return { favoritesCount: 0, commentsCount: 0, isFavoritedByViewer: false };
  }
};

export const postEngagementComment = async (input: EngagementIdentityInput & { token?: string; text: string }) => {
  const firestore = requireDb();
  const identity = resolveIdentity(input);
  const text = cleanText(input.text, 2000);
  if (!text) throw new Error('Comment text is required.');

  const comment = await addDoc(collection(firestore, 'engagement_comments'), {
    canonicalProductKey: identity.canonicalProductKey,
    storeId: identity.storeId,
    sourceProductId: identity.sourceProductId,
    publicProductId: identity.publicProductId || null,
    body: text,
    text,
    authorDisplayName: 'Customer',
    authorName: 'Customer',
    originPlatform: 'sedifexmarket',
    status: 'approved',
    moderationStatus: 'approved',
    visibility: 'public',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const comments = await listEngagementComments(input).catch(() => []);
  await writeThreadSummary(identity, comments.length || undefined);
  return { ok: true, id: comment.id };
};

export const postEngagementFavorite = async () => {
  throw new Error('Favorites are temporarily disabled while marketplace comments are being stabilized.');
};
