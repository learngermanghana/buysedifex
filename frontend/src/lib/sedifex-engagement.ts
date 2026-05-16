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

type EngagementIdentityPayload = {
  public_product_id: string;
  store_id?: string;
  source_product_id?: string;
};

const configuredEngagementApiBase =
  process.env.NEXT_PUBLIC_SEDIFEX_ENGAGEMENT_API_BASE_URL ?? process.env.SEDIFEX_ENGAGEMENT_API_BASE_URL ?? '';

const engagementApiBase = configuredEngagementApiBase || '/api/engagement';

const buildUrl = (path: string) => {
  if (engagementApiBase.startsWith('/')) return `${engagementApiBase}${path}`;
  return new URL(path, engagementApiBase).toString();
};

const buildIdentityPayload = (input: EngagementIdentityInput): EngagementIdentityPayload => ({
  public_product_id: input.publicProductId,
  ...(input.storeId ? { store_id: input.storeId } : {}),
  ...(input.sourceProductId ? { source_product_id: input.sourceProductId } : {}),
});

const applyIdentityQueryParams = (endpoint: URLSearchParams, input: EngagementIdentityInput) => {
  endpoint.set('public_product_id', input.publicProductId);
  if (input.storeId) endpoint.set('store_id', input.storeId);
  if (input.sourceProductId) endpoint.set('source_product_id', input.sourceProductId);
};

const buildHeaders = (token?: string): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export const listEngagementComments = async (input: {
  publicProductId: string;
  storeId?: string;
  sourceProductId?: string;
}): Promise<SedifexComment[]> => {
  const params = new URLSearchParams();
  applyIdentityQueryParams(params, input);
  const response = await fetch(`${buildUrl('/comments')}?${params.toString()}`, { cache: 'no-store' });
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
  const params = new URLSearchParams();
  applyIdentityQueryParams(params, input);
  const response = await fetch(`${buildUrl('/summary')}?${params.toString()}`, { headers: buildHeaders(input.token), cache: 'no-store' });
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
  const response = await fetch(buildUrl('/comments'), {
    method: 'POST',
    headers: buildHeaders(input.token),
    body: JSON.stringify({ ...buildIdentityPayload(input), text: input.text }),
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
  const response = await fetch(buildUrl('/reactions'), {
    method: 'POST',
    headers: buildHeaders(input.token),
    body: JSON.stringify({ ...buildIdentityPayload(input), reaction: input.reaction }),
  });
  if (!response.ok) throw new Error(`Unable to update favorite. Status ${response.status}`);
};