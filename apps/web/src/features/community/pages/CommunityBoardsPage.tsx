import { Group, Paper, Select, Stack, Switch, Tabs, Text, Textarea } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CommunityBoardCategory, CommunityBoardPostView, CommunityPostSort } from '@work-archive/shared-types';

import { AppButton, FeedbackMessage, LoadingState, PageHeader, PageShell, StateMessage } from '@shared/components/AppPrimitives';
import { useAuthSession } from '@features/auth';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { fetchCommunityBoardPosts, publishCommunityPost } from '../services/community.api';
import styles from './CommunityBoardsPage.module.css';

const categories: Array<{ label: string; value: CommunityBoardCategory }> = [
  { label: '자유', value: 'free' }, { label: '추천', value: 'recommendation' },
  { label: '질문', value: 'question' }, { label: '정보', value: 'information' },
  { label: '스포일러', value: 'spoiler' },
];

export function CommunityBoardsPage() {
  const { mode, user } = useAuthSession();
  const canWrite = mode === 'authenticated' && Boolean(user?.handle);
  const [category, setCategory] = useState<CommunityBoardCategory | 'all'>('all');
  const [sort, setSort] = useState<CommunityPostSort>('latest');
  const [posts, setPosts] = useState<CommunityBoardPostView[]>([]);
  const [body, setBody] = useState('');
  const [composerCategory, setComposerCategory] = useState<CommunityBoardCategory>('free');
  const [spoiler, setSpoiler] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  usePageTitle('커뮤니티 게시판');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchCommunityBoardPosts(sort, category === 'all' ? undefined : category);
      setPosts(result.posts.map((post) => ({ ...post, category: post.category ?? 'free', commentCount: post.commentCount ?? 0 })));
    } finally { setLoading(false); }
  }, [category, sort]);
  useEffect(() => void load(), [load]);

  async function publish() {
    if (!body.trim()) return;
    setPublishing(true); setFeedback(null);
    try {
      await publishCommunityPost({ body: body.trim(), category: composerCategory, spoiler: spoiler || composerCategory === 'spoiler' });
      setBody(''); setSpoiler(false); setFeedback('게시판에 글을 공개했습니다.'); await load();
    } catch (error) { setFeedback(error instanceof Error ? error.message : '글을 공개하지 못했습니다.'); }
    finally { setPublishing(false); }
  }

  return (
    <PageShell size={1100}>
      <PageHeader description="작품을 연결해도, 연결하지 않아도 괜찮은 별도의 자유 토론 공간입니다." eyebrow="COMMUNITY BOARD" title="게시판" titleOrder={1} />
      <Group className={styles.subnav ?? ''} gap="xs"><Link to="/community">작품 피드</Link><Link aria-current="page" to="/community/boards">게시판</Link><Link to="/community/taste">취향 찾기</Link></Group>
      {canWrite ? (
        <Paper className={styles.composer ?? ''} p="lg" radius="lg" withBorder>
          <Stack gap="md">
            <Group align="flex-end" justify="space-between"><Select data={categories} label="분류" onChange={(value) => value && setComposerCategory(value as CommunityBoardCategory)} value={composerCategory} /><Text c="dimmed" size="sm">작품 연결은 선택 사항입니다.</Text></Group>
            <Textarea autosize maxLength={1000} minRows={3} onChange={(event) => setBody(event.currentTarget.value)} placeholder="함께 이야기하고 싶은 내용을 적어보세요." value={body} />
            <Group justify="space-between"><Switch checked={spoiler} label="스포일러 포함" onChange={(event) => setSpoiler(event.currentTarget.checked)} /><AppButton disabled={!body.trim()} loading={publishing} onClick={() => void publish()} tone="primary">글 공개</AppButton></Group>
          </Stack>
        </Paper>
      ) : <StateMessage description="읽기는 누구나 가능하며, 글 작성에는 로그인과 고유 핸들이 필요합니다." title="게시판은 공개 열람이 가능합니다" />}
      {feedback && <FeedbackMessage tone={feedback.includes('못') ? 'error' : 'success'}>{feedback}</FeedbackMessage>}
      <div className={styles.toolbar}>
        <Tabs onChange={(value) => value && setCategory(value as CommunityBoardCategory | 'all')} value={category}><Tabs.List><Tabs.Tab value="all">전체</Tabs.Tab>{categories.map((item) => <Tabs.Tab key={item.value} value={item.value}>{item.label}</Tabs.Tab>)}</Tabs.List></Tabs>
        <Select data={[{ label: '최신순', value: 'latest' }, { label: '인기순', value: 'popular' }]} onChange={(value) => value && setSort(value as CommunityPostSort)} value={sort} />
      </div>
      {loading ? <LoadingState rows={5} title="게시글을 불러오는 중" /> : posts.length ? (
        <Stack gap="sm">{posts.map((post) => <Link className={styles.postLink} key={post.id} to={`/community/posts/${post.id}`}><Paper p="lg" radius="lg" withBorder><Group justify="space-between" wrap="nowrap"><div><Text c="indigo" fw={750} size="xs">{categories.find((item) => item.value === post.category)?.label ?? '자유'}</Text><Text fw={800} lineClamp={2}>{post.spoiler ? '[스포일러] ' : ''}{post.body}</Text><Text c="dimmed" mt={6} size="xs">{post.author.displayName} · 공감 {post.reactionCount} · 댓글 {post.commentCount}</Text></div></Group></Paper></Link>)}</Stack>
      ) : <StateMessage description="선택한 분류에 공개된 글이 없습니다." title="첫 이야기를 기다리고 있어요" />}
    </PageShell>
  );
}
