'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  getEngagementSummary,
  listEngagementComments,
  postEngagementComment,
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
      setSummary(await getEngagementSummary(identity));
      setError('');
    } catch (commentsError) {
      console.error(commentsError);
      setError(getErrorMessage(commentsError, 'Unable to load comments right now.'));
    } finally {
      setLoading(false);
    }
  }, [identity]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSubmitComment = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedText = text.trim();
    if (!trimmedText) return;

    try {
      setPosting(true);
      setError('');
      setNotice('');
      await postEngagementComment({ ...identity, text: trimmedText });
      setText('');
      setNotice('Comment posted. It is visible now.');
      await refresh();
    } catch (submitError) {
      console.error(submitError);
      setError(getErrorMessage(submitError, 'Unable to post comment right now.'));
    } finally {
      setPosting(false);
    }
  };

  const showEmptyState = !error && comments.length === 0;

  return (
    <section className="productStoreCard" aria-label="Product comments">
      <h2>Customer comments</h2>
      {!isPublished ? <p>This listing is not currently public. Historical comments are read-only.</p> : null}
      <p>💬 {summary.commentsCount || comments.length} comments</p>

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
      {showEmptyState ? <p>{loading ? 'Loading comments…' : 'No comments yet.'}</p> : null}
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