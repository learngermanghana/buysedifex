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

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export function ProductEngagementPanel({ publicProductId, storeId, sourceProductId, isPublished = true }: Props) {
  const [comments, setComments] = useState<SedifexComment[]>([]);
  const [summary, setSummary] = useState<SedifexCommentSummary>(initialSummary);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canWrite = isPublished;

  const identity = useMemo(() => ({ publicProductId, storeId, sourceProductId }), [publicProductId, sourceProductId, storeId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const loadedComments = await listEngagementComments(identity);
      setComments(loadedComments.filter((item) => item.moderationStatus !== 'rejected'));
      setError('');
    } catch (commentsError) {
      console.error(commentsError);
      setError(getErrorMessage(commentsError, 'Unable to load comments right now.'));
    }

    try {
      const token = await getFirebaseAuth()?.currentUser?.getIdToken();
      const loadedSummary = await getEngagementSummary({ ...identity, token: token ?? undefined });
      setSummary(loadedSummary);
    } catch (summaryError) {
      console.warn('engagement.summary.load.failed', summaryError);
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

    try {
      setPosting(true);
      setError('');
      setNotice('');
      const token = await getFirebaseAuth()?.currentUser?.getIdToken();
      await postEngagementComment({ ...identity, token: token ?? '', text: trimmedText });
      setText('');
      setNotice('Comment posted. It is approved and visible now.');
      await refresh();
    } catch (submitError) {
      console.error(submitError);
      setError(getErrorMessage(submitError, 'Unable to post comment right now.'));
    } finally {
      setPosting(false);
    }
  };

  const onToggleFavorite = async () => {
    try {
      setError('');
      setNotice('');
      const token = await getFirebaseAuth()?.currentUser?.getIdToken();
      if (!token) {
        setError('Sign in to favorite products.');
        return;
      }

      await postEngagementFavorite({ ...identity, token, reaction: summary.isFavoritedByViewer ? 'unfavorite' : 'favorite' });
      await refresh();
    } catch (favoriteError) {
      console.error(favoriteError);
      setError(getErrorMessage(favoriteError, 'Unable to update favorite right now.'));
    }
  };

  const showEmptyState = !error && comments.length === 0;

  return (
    <section className="productStoreCard" aria-label="Product comments and favorites">
      <h2>Community engagement</h2>
      {!isPublished ? <p>This listing is not currently public. Historical comments are read-only.</p> : null}
      <p>❤️ {summary.favoritesCount} favorites · 💬 {summary.commentsCount} comments</p>
      {canWrite ? (
        <button className="secondaryButton" type="button" onClick={() => void onToggleFavorite()} disabled={loading || posting}>
          {summary.isFavoritedByViewer ? 'Remove favorite' : 'Favorite'}
        </button>
      ) : null}

      {canWrite ? (
        <form className="requestForm" onSubmit={(event) => void onSubmitComment(event)}>
          <label htmlFor="comment-text">Add comment</label>
          <textarea id="comment-text" rows={3} value={text} onChange={(event) => setText(event.target.value)} />
          <button className="requestButton" type="submit" disabled={loading || posting || !text.trim()}>
            {posting ? 'Posting…' : 'Post comment'}
          </button>
        </form>
      ) : null}

      {notice ? <p className="requestFeedback success">{notice}</p> : null}
      {error ? <p className="requestFeedback error">{error}</p> : null}
      {showEmptyState ? <p>{loading ? 'Loading comments…' : 'No approved comments yet.'}</p> : null}
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