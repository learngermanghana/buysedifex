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

const engagementApiBase =
  process.env.NEXT_PUBLIC_SEDIFEX_ENGAGEMENT_API_BASE_URL ?? process.env.SEDIFEX_ENGAGEMENT_API_BASE_URL ?? '';

const buildIdentity = (input: { publicProductId: string; storeId?: string; sourceProductId?: string }) => ({
  publicProductId: input.publicProductId,
  ...(input.storeId ? { storeId: input.storeId } : {}),
  ...(input.sourceProductId ? { sourceProductId: input.sourceProductId } : {}),
});

const buildHeaders = (token?: string): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const assertBase = () => {
  if (!engagementApiBase) throw new Error('Sedifex engagement API base URL is not configured.');
};

export const listEngagementComments = async (input: {
  publicProductId: string;
  storeId?: string;
  sourceProductId?: string;
}): Promise<SedifexComment[]> => {
  assertBase();
  const endpoint = new URL('/v1/engagement/comments', engagementApiBase);
  endpoint.searchParams.set('publicProductId', input.publicProductId);
  if (input.storeId) endpoint.searchParams.set('storeId', input.storeId);
  if (input.sourceProductId) endpoint.searchParams.set('sourceProductId', input.sourceProductId);

  const response = await fetch(endpoint.toString(), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load comments. Status ${response.status}`);
  const payload = (await response.json()) as { comments?: SedifexComment[] } | SedifexComment[];
  const comments = Array.isArray(payload) ? payload : payload.comments ?? [];
  return comments.filter((item) => item.moderationStatus !== 'rejected');
};

export const getEngagementSummary = async (input: {
  publicProductId: string;
  storeId?: string;
  sourceProductId?: string;
  token?: string;
}): Promise<SedifexCommentSummary> => {
  assertBase();
  const endpoint = new URL('/v1/engagement/summary', engagementApiBase);
  endpoint.searchParams.set('publicProductId', input.publicProductId);
  if (input.storeId) endpoint.searchParams.set('storeId', input.storeId);
  if (input.sourceProductId) endpoint.searchParams.set('sourceProductId', input.sourceProductId);

  const response = await fetch(endpoint.toString(), { headers: buildHeaders(input.token), cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load summary. Status ${response.status}`);
  const payload = (await response.json()) as Partial<SedifexCommentSummary>;
  return {
    favoritesCount: payload.favoritesCount ?? 0,
    commentsCount: payload.commentsCount ?? 0,
    isFavoritedByViewer: payload.isFavoritedByViewer ?? false,
  };
};

export const postEngagementComment = async (input: {
  publicProductId: string;
  storeId?: string;
  sourceProductId?: string;
  token: string;
  text: string;
}) => {
  assertBase();
  const response = await fetch(new URL('/v1/engagement/comments', engagementApiBase).toString(), {
    method: 'POST',
    headers: buildHeaders(input.token),
    body: JSON.stringify({ ...buildIdentity(input), text: input.text }),
  });
  if (!response.ok) throw new Error(`Unable to post comment. Status ${response.status}`);
};

export const postEngagementFavorite = async (input: {
  publicProductId: string;
  storeId?: string;
  sourceProductId?: string;
  token: string;
  reaction: 'favorite' | 'unfavorite';
}) => {
  assertBase();
  const response = await fetch(new URL('/v1/engagement/reactions', engagementApiBase).toString(), {
    method: 'POST',
    headers: buildHeaders(input.token),
    body: JSON.stringify({ ...buildIdentity(input), reaction: input.reaction }),
  });
  if (!response.ok) throw new Error(`Unable to update favorite. Status ${response.status}`);
};
