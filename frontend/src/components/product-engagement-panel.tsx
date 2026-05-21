'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import styles from './product-engagement-panel.module.css';
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
    <section className={`productStoreCard ${styles.commentCard}`} aria-label="Product comments">
      <div className={styles.commentHeader}>
        <h2 className={styles.commentTitle}>Customer comments</h2>
        {!isPublished ? <p>This listing is not currently public. Historical comments are read-only.</p> : null}
        <p className={styles.commentCount}>💬 {summary.commentsCount || comments.length} comments</p>
      </div>

      {canWrite ? (
        <form className={styles.commentForm} onSubmit={(event) => void onSubmitComment(event)}>
          <label className={styles.commentLabel} htmlFor="comment-text">Add comment</label>
          <div className={styles.commentInputRow}>
            <textarea
              className={styles.commentTextarea}
              id="comment-text"
              rows={4}
              value={text}
              placeholder="Share your question or experience with this product..."
              onChange={(event) => setText(event.target.value)}
            />
            <button className={`requestButton ${styles.commentButton}`} type="submit" disabled={loading || posting || !text.trim()}>
              {posting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      ) : null}

      {notice ? <p className="requestFeedback success">{notice}</p> : null}
      {error ? <p className="requestFeedback error">{error}</p> : null}
      {showEmptyState ? <p className={styles.commentEmpty}>{loading ? 'Loading comments…' : 'No comments yet.'}</p> : null}
      <ul className={styles.commentList}>
        {comments.map((comment) => (
          <li className={styles.commentItem} key={comment.id}>
            <strong>{comment.authorName ?? 'Customer'}</strong>
            <p>{comment.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
