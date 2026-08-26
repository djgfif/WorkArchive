import { Avatar, Group, Paper, Rating, Stack, Switch, Text, Textarea } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CommunityBoardPostView, CommunityCommentView, CommunityReviewView } from '@work-archive/shared-types';

import { AppButton, FeedbackMessage, LoadingState, PageShell, StateMessage } from '@shared/components/AppPrimitives';
import { useAuthSession } from '@features/auth';
import { getDisplayImageUrl } from '@shared/utils/image-proxy';
import { formatAppDate, useAppTranslation } from '@app/i18n';
import { fetchCommunityComments, fetchCommunityPost, fetchCommunityReview, publishCommunityComment, reportCommunityTarget, setCommunityTargetReaction } from '../services/community.api';
import styles from './CommunityDetailPage.module.css';

type DetailKind = 'post' | 'review';
type FeedbackState = { message: string; tone: 'error' | 'success' };

function CommunityDetail({ kind }: { kind: DetailKind }) {
  const { t } = useAppTranslation();
  const { id = '' } = useParams();
  const { mode, user } = useAuthSession();
  const canParticipate = mode === 'authenticated' && Boolean(user?.handle);
  const [content, setContent] = useState<CommunityBoardPostView | CommunityReviewView | null>(null);
  const [comments, setComments] = useState<CommunityCommentView[]>([]);
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, replies] = await Promise.all([
        kind === 'review' ? fetchCommunityReview(id) : fetchCommunityPost(id),
        fetchCommunityComments(kind, id),
      ]);
      setContent(detail); setComments(replies);
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : t('community.social.detail.loadError'), tone: 'error' }); }
    finally { setLoading(false); }
  }, [id, kind, t]);
  useEffect(() => void load(), [load]);

  async function comment() {
    if (!body.trim()) return;
    try {
      await publishCommunityComment({ body: body.trim(), parentId, spoiler, targetId: id, targetType: kind });
      setBody(''); setParentId(null); setSpoiler(false); setFeedback({ message: t('community.social.detail.commentSuccess'), tone: 'success' }); await load();
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : t('community.social.detail.commentError'), tone: 'error' }); }
  }
  async function reactComment(commentEntry: CommunityCommentView) {
    await setCommunityTargetReaction('comment', commentEntry.id, commentEntry.viewerHasReacted);
    await load();
  }
  async function report(targetType: DetailKind | 'comment', targetId: string) {
    try {
      await reportCommunityTarget(targetType, targetId);
      setFeedback({ message: t('community.social.detail.reportSuccess'), tone: 'success' });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : t('community.social.detail.reportError'), tone: 'error' });
    }
  }
  async function share() {
    const data = { title: content?.work?.title ?? t('community.social.detail.shareTitle'), url: window.location.href };
    if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(data.url); setFeedback({ message: t('community.social.detail.copied'), tone: 'success' }); }
  }

  if (loading) return <PageShell size={900}><LoadingState rows={5} title={t('community.social.detail.loading')} /></PageShell>;
  if (!content) return <PageShell size={900}><StateMessage description={feedback?.message ?? t('community.social.detail.missingDescription')} title={t('community.social.detail.missingTitle')} tone="error" /></PageShell>;
  const review = kind === 'review' ? content as CommunityReviewView : null;
  const avatar = getDisplayImageUrl(content.author.avatarUrl);

  return (
    <PageShell size={900}>
      <Group className={styles.backRow ?? ''} gap="sm"><Link to={kind === 'post' ? '/community/boards' : '/community'}>{t('community.social.detail.back')}</Link><button onClick={() => void share()} type="button">{t('community.social.share')}</button>{canParticipate && !content.viewerCanDelete && <button onClick={() => void report(kind, content.id)} type="button">{t('community.social.detail.report')}</button>}</Group>
      <Paper className={styles.article ?? ''} p="xl" radius="lg" withBorder>
        <Stack gap="lg">
          <Group justify="space-between"><Link className={styles.author} to={content.author.handle ? `/u/${content.author.handle}` : '/community'}><Avatar radius="xl" src={avatar || null}>{content.author.displayName.slice(0, 1)}</Avatar><span><Text fw={800}>{content.author.displayName}</Text><Text c="dimmed" size="xs">{content.author.handle ? `@${content.author.handle}` : t('community.social.anonymousUser')}</Text></span></Link><Text c="dimmed" size="xs">{formatAppDate(content.createdAt)}</Text></Group>
          {content.work && <div className={styles.work}><Text c="dimmed" size="xs">{t('community.social.detail.connectedWork')}</Text><Text fw={850} size="xl">{content.work.title}</Text>{review?.rating !== null && review && <Group gap="xs"><Rating color="yellow" fractions={2} readOnly value={review.rating ?? 0} /><Text className={styles.rating ?? ''}>{review.rating?.toFixed(1)}</Text></Group>}</div>}
          <Text className={styles.body ?? ''}>{content.spoiler ? t('community.social.detail.spoilerPrefix', { body: content.body }) : content.body}</Text>
        </Stack>
      </Paper>

      <section className={styles.comments}>
        <Text fw={850} size="lg">{t('community.social.detail.comments', { count: content.commentCount })}</Text>
        {canParticipate ? <Paper p="lg" radius="lg" withBorder><Stack gap="sm">{parentId && <FeedbackMessage tone="info">{t('community.social.detail.replying')}</FeedbackMessage>}<Textarea autosize minRows={2} onChange={(event) => setBody(event.currentTarget.value)} placeholder={t('community.social.detail.commentPlaceholder')} value={body} /><Group justify="space-between"><Switch checked={spoiler} label={t('community.spoilerLabel')} onChange={(event) => setSpoiler(event.currentTarget.checked)} /><Group><AppButton disabled={!body.trim()} onClick={() => void comment()} tone="primary">{t('community.social.detail.publishComment')}</AppButton></Group></Group></Stack></Paper> : <StateMessage description={t('community.social.detail.publicCommentsDescription')} title={t('community.social.detail.publicCommentsTitle')} />}
        {feedback && <FeedbackMessage tone={feedback.tone}>{feedback.message}</FeedbackMessage>}
        <Stack gap="sm">{comments.map((entry) => <Paper key={entry.id} p="lg" radius="lg" withBorder><CommentEntry canParticipate={canParticipate} comment={entry} onReact={reactComment} onReply={setParentId} onReport={(commentId) => report('comment', commentId)} /></Paper>)}</Stack>
      </section>
    </PageShell>
  );
}

function CommentEntry({ canParticipate, comment, onReact, onReply, onReport }: { canParticipate: boolean; comment: CommunityCommentView; onReact: (comment: CommunityCommentView) => Promise<void>; onReply: (id: string) => void; onReport: (id: string) => Promise<void> }) {
  const { t } = useAppTranslation();
  return <Stack gap="sm"><Group justify="space-between"><Text fw={750}>{comment.author.displayName}</Text><Text c="dimmed" size="xs">{formatAppDate(comment.createdAt)}</Text></Group><Text>{comment.spoiler ? t('community.social.detail.spoilerComment') : comment.body}</Text><Group gap="xs"><button aria-pressed={comment.viewerHasReacted} disabled={!canParticipate} onClick={() => void onReact(comment)} type="button">{t('community.social.reactionCount', { count: comment.reactionCount })}</button>{canParticipate && <button onClick={() => onReply(comment.id)} type="button">{t('community.social.detail.reply')}</button>}{canParticipate && !comment.viewerCanDelete && <button onClick={() => void onReport(comment.id)} type="button">{t('community.social.detail.report')}</button>}</Group>{comment.replies.map((reply) => <div className={styles.reply} key={reply.id}><Text fw={700} size="sm">{reply.author.displayName}</Text><Text size="sm">{reply.spoiler ? t('community.social.detail.spoilerReply') : reply.body}</Text></div>)}</Stack>;
}

export function CommunityPostDetailPage() { return <CommunityDetail kind="post" />; }
export function CommunityReviewDetailPage() { return <CommunityDetail kind="review" />; }
