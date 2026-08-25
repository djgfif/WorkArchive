import { Avatar, Group, Paper, Rating, Stack, Switch, Text, Textarea } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CommunityBoardPostView, CommunityCommentView, CommunityReviewView } from '@work-archive/shared-types';

import { AppButton, FeedbackMessage, LoadingState, PageShell, StateMessage } from '@shared/components/AppPrimitives';
import { useAuthSession } from '@features/auth';
import { getDisplayImageUrl } from '@shared/utils/image-proxy';
import { fetchCommunityComments, fetchCommunityPost, fetchCommunityReview, publishCommunityComment, reportCommunityTarget, setCommunityTargetReaction } from '../services/community.api';
import styles from './CommunityDetailPage.module.css';

type DetailKind = 'post' | 'review';

function CommunityDetail({ kind }: { kind: DetailKind }) {
  const { id = '' } = useParams();
  const { mode, user } = useAuthSession();
  const canParticipate = mode === 'authenticated' && Boolean(user?.handle);
  const [content, setContent] = useState<CommunityBoardPostView | CommunityReviewView | null>(null);
  const [comments, setComments] = useState<CommunityCommentView[]>([]);
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, replies] = await Promise.all([
        kind === 'review' ? fetchCommunityReview(id) : fetchCommunityPost(id),
        fetchCommunityComments(kind, id),
      ]);
      setContent(detail); setComments(replies);
    } catch (error) { setFeedback(error instanceof Error ? error.message : '내용을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [id, kind]);
  useEffect(() => void load(), [load]);

  async function comment() {
    if (!body.trim()) return;
    try {
      await publishCommunityComment({ body: body.trim(), parentId, spoiler, targetId: id, targetType: kind });
      setBody(''); setParentId(null); setSpoiler(false); setFeedback('댓글을 공개했습니다.'); await load();
    } catch (error) { setFeedback(error instanceof Error ? error.message : '댓글을 공개하지 못했습니다.'); }
  }
  async function reactComment(commentEntry: CommunityCommentView) {
    await setCommunityTargetReaction('comment', commentEntry.id, commentEntry.viewerHasReacted);
    await load();
  }
  async function report(targetType: DetailKind | 'comment', targetId: string) {
    try {
      await reportCommunityTarget(targetType, targetId);
      setFeedback('신고를 접수했습니다. 운영자가 확인합니다.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '신고를 접수하지 못했습니다.');
    }
  }
  async function share() {
    const data = { title: content?.work?.title ?? 'Work Archive 커뮤니티', url: window.location.href };
    if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(data.url); setFeedback('링크를 복사했습니다.'); }
  }

  if (loading) return <PageShell size={900}><LoadingState rows={5} title="이야기를 불러오는 중" /></PageShell>;
  if (!content) return <PageShell size={900}><StateMessage description={feedback ?? '삭제되었거나 공개되지 않은 콘텐츠입니다.'} title="내용을 찾을 수 없습니다" tone="error" /></PageShell>;
  const review = kind === 'review' ? content as CommunityReviewView : null;
  const avatar = getDisplayImageUrl(content.author.avatarUrl);

  return (
    <PageShell size={900}>
      <Group className={styles.backRow ?? ''} gap="sm"><Link to={kind === 'post' ? '/community/boards' : '/community'}>← 커뮤니티로</Link><button onClick={() => void share()} type="button">공유</button>{canParticipate && !content.viewerCanDelete && <button onClick={() => void report(kind, content.id)} type="button">신고</button>}</Group>
      <Paper className={styles.article ?? ''} p="xl" radius="lg" withBorder>
        <Stack gap="lg">
          <Group justify="space-between"><Link className={styles.author} to={content.author.handle ? `/u/${content.author.handle}` : '/community'}><Avatar radius="xl" src={avatar || null}>{content.author.displayName.slice(0, 1)}</Avatar><span><Text fw={800}>{content.author.displayName}</Text><Text c="dimmed" size="xs">{content.author.handle ? `@${content.author.handle}` : '커뮤니티 사용자'}</Text></span></Link><Text c="dimmed" size="xs">{new Date(content.createdAt).toLocaleDateString('ko-KR')}</Text></Group>
          {content.work && <div className={styles.work}><Text c="dimmed" size="xs">연결된 작품</Text><Text fw={850} size="xl">{content.work.title}</Text>{review?.rating !== null && review && <Group gap="xs"><Rating color="yellow" fractions={2} readOnly value={review.rating ?? 0} /><Text className={styles.rating ?? ''}>{review.rating?.toFixed(1)}</Text></Group>}</div>}
          <Text className={styles.body ?? ''}>{content.spoiler ? `스포일러 포함 · ${content.body}` : content.body}</Text>
        </Stack>
      </Paper>

      <section className={styles.comments}>
        <Text fw={850} size="lg">댓글 {content.commentCount}</Text>
        {canParticipate ? <Paper p="lg" radius="lg" withBorder><Stack gap="sm">{parentId && <FeedbackMessage tone="info">답글 작성 중 · 한 단계 답글만 지원합니다.</FeedbackMessage>}<Textarea autosize minRows={2} onChange={(event) => setBody(event.currentTarget.value)} placeholder="작품과 사람을 존중하는 댓글을 남겨주세요." value={body} /><Group justify="space-between"><Switch checked={spoiler} label="스포일러 포함" onChange={(event) => setSpoiler(event.currentTarget.checked)} /><Group><AppButton disabled={!body.trim()} onClick={() => void comment()} tone="primary">댓글 공개</AppButton></Group></Group></Stack></Paper> : <StateMessage description="로그인하고 고유 핸들을 만든 사용자가 댓글과 반응에 참여할 수 있습니다." title="댓글은 공개 열람이 가능합니다" />}
        {feedback && <FeedbackMessage tone={feedback.includes('못') ? 'error' : 'success'}>{feedback}</FeedbackMessage>}
        <Stack gap="sm">{comments.map((entry) => <Paper key={entry.id} p="lg" radius="lg" withBorder><CommentEntry canParticipate={canParticipate} comment={entry} onReact={reactComment} onReply={setParentId} onReport={(commentId) => report('comment', commentId)} /></Paper>)}</Stack>
      </section>
    </PageShell>
  );
}

function CommentEntry({ canParticipate, comment, onReact, onReply, onReport }: { canParticipate: boolean; comment: CommunityCommentView; onReact: (comment: CommunityCommentView) => Promise<void>; onReply: (id: string) => void; onReport: (id: string) => Promise<void> }) {
  return <Stack gap="sm"><Group justify="space-between"><Text fw={750}>{comment.author.displayName}</Text><Text c="dimmed" size="xs">{new Date(comment.createdAt).toLocaleDateString('ko-KR')}</Text></Group><Text>{comment.spoiler ? '스포일러가 포함된 댓글입니다.' : comment.body}</Text><Group gap="xs"><button aria-pressed={comment.viewerHasReacted} disabled={!canParticipate} onClick={() => void onReact(comment)} type="button">공감 {comment.reactionCount}</button>{canParticipate && <button onClick={() => onReply(comment.id)} type="button">답글</button>}{canParticipate && !comment.viewerCanDelete && <button onClick={() => void onReport(comment.id)} type="button">신고</button>}</Group>{comment.replies.map((reply) => <div className={styles.reply} key={reply.id}><Text fw={700} size="sm">{reply.author.displayName}</Text><Text size="sm">{reply.spoiler ? '스포일러가 포함된 답글입니다.' : reply.body}</Text></div>)}</Stack>;
}

export function CommunityPostDetailPage() { return <CommunityDetail kind="post" />; }
export function CommunityReviewDetailPage() { return <CommunityDetail kind="review" />; }
