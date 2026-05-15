'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  getEngagementSummary,
  listEngagementComments,
  postEngagementComment,
  postEngagementFavorite,
  SedifexComment,
  SedifexCommentSummary,
} from '@/lib/sedifex-engagement';

type Props = {
  publicProductId: string;
  storeId?: string;
  sourceProductId?: string;
  isPublished?: boolean;
};

const initialSummary: SedifexCommentSummary = { favoritesCount: 0, commentsCount: 0, isFavoritedByViewer: false };

export function ProductEngagementPanel({ publicProductId, storeId, sourceProductId, isPublished = true }: Props) {
  const [comments, setComments] = useState<SedifexComment[]>([]);
  const [summary, setSummary] = useState<SedifexCommentSummary>(initialSummary);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canWrite = isPublished;

  const identity = useMemo(() => ({ publicProductId, storeId, sourceProductId }), [publicProductId, sourceProductId, storeId]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getFirebaseAuth()?.currentUser?.getIdToken();
      const [loadedComments, loadedSummary] = await Promise.all([
        listEngagementComments(identity),
        getEngagementSummary({ ...identity, token: token ?? undefined }),
      ]);
      setComments(loadedComments.filter((item) => item.moderationStatus === 'approved'));
      setSummary(loadedSummary);
      setError('');
    } catch (refreshError) {
      console.error(refreshError);
      setError('Unable to load comments right now.');
    } finally {
      setLoading(false);
    }
  }, [identity]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  const onSubmitComment = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedText = text.trim();
    if (!trimmedText) return;
    const token = await getFirebaseAuth()?.currentUser?.getIdToken();
    if (!token) {
      setError('Sign in to comment.');
      return;
    }

    await postEngagementComment({ ...identity, token, text: trimmedText });
    setText('');
    await refresh();
  };

  const onToggleFavorite = async () => {
    const token = await getFirebaseAuth()?.currentUser?.getIdToken();
    if (!token) {
      setError('Sign in to favorite.');
      return;
    }

    await postEngagementFavorite({ ...identity, token, reaction: summary.isFavoritedByViewer ? 'unfavorite' : 'favorite' });
    await refresh();
  };

  return (
    <section className="productStoreCard" aria-label="Product comments and favorites">
      <h2>Community engagement</h2>
      {!isPublished ? <p>This listing is not currently public. Historical comments are read-only.</p> : null}
      <p>❤️ {summary.favoritesCount} favorites · 💬 {summary.commentsCount} comments</p>
      {canWrite ? (
        <button className="secondaryButton" type="button" onClick={() => void onToggleFavorite()} disabled={loading}>
          {summary.isFavoritedByViewer ? 'Remove favorite' : 'Favorite'}
        </button>
      ) : null}

      {canWrite ? (
        <form className="requestForm" onSubmit={(event) => void onSubmitComment(event)}>
          <label htmlFor="comment-text">Add comment</label>
          <textarea id="comment-text" rows={3} value={text} onChange={(event) => setText(event.target.value)} />
          <button className="requestButton" type="submit" disabled={loading || !text.trim()}>Post comment</button>
        </form>
      ) : null}

      {error ? <p className="requestFeedback error">{error}</p> : null}
      {comments.length === 0 ? <p>{loading ? 'Loading comments…' : 'No approved comments yet.'}</p> : null}
      <ul>
        {comments.map((comment) => (
          <li key={comment.id}>
            <strong>{comment.authorName ?? 'Customer'}</strong>
            <p>{comment.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
