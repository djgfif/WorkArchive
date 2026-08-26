import { Group, Paper, Select, Stack, Switch, Tabs, Text, Textarea } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CommunityBoardCategory, CommunityBoardPostView, CommunityPostSort } from '@work-archive/shared-types';

import { AppButton, AppLinkButton, FeedbackMessage, LoadingState, PageHeader, PageShell, StateMessage } from '@shared/components/AppPrimitives';
import { useAuthSession } from '@features/auth';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { useAppTranslation } from '@app/i18n';
import { fetchCommunityBoardPosts, publishCommunityPost } from '../services/community.api';
import styles from './CommunityBoardsPage.module.css';

type FeedbackState = { message: string; tone: 'error' | 'success' };

export function CommunityBoardsPage() {
  const { t } = useAppTranslation();
  const { mode, user } = useAuthSession();
  const canWrite = mode === 'authenticated' && Boolean(user?.handle);
  const [category, setCategory] = useState<CommunityBoardCategory | 'all'>('all');
  const [sort, setSort] = useState<CommunityPostSort>('latest');
  const [posts, setPosts] = useState<CommunityBoardPostView[]>([]);
  const [body, setBody] = useState('');
  const [composerCategory, setComposerCategory] = useState<CommunityBoardCategory>('free');
  const [spoiler, setSpoiler] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  usePageTitle(t('community.social.boards.pageTitle'));
  const categories: Array<{ label: string; value: CommunityBoardCategory }> = [
    { label: t('community.social.boards.categories.free'), value: 'free' },
    { label: t('community.social.boards.categories.recommendation'), value: 'recommendation' },
    { label: t('community.social.boards.categories.question'), value: 'question' },
    { label: t('community.social.boards.categories.information'), value: 'information' },
    { label: t('community.social.boards.categories.spoiler'), value: 'spoiler' },
  ];
  const categoryDescriptions: Record<CommunityBoardCategory | 'all', string> = {
    all: t('community.social.boards.categoryDescriptions.all'),
    free: t('community.social.boards.categoryDescriptions.free'),
    recommendation: t('community.social.boards.categoryDescriptions.recommendation'),
    question: t('community.social.boards.categoryDescriptions.question'),
    information: t('community.social.boards.categoryDescriptions.information'),
    spoiler: t('community.social.boards.categoryDescriptions.spoiler'),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCommunityBoardPosts(sort, category === 'all' ? undefined : category);
      setPosts(result.posts.map((post) => ({ ...post, category: post.category ?? 'free', commentCount: post.commentCount ?? 0 })));
    } catch (loadError) {
      setPosts([]);
      setError(loadError instanceof Error ? loadError.message : t('community.social.boards.loadError'));
    } finally { setLoading(false); }
  }, [category, sort, t]);
  useEffect(() => void load(), [load]);

  async function publish() {
    if (!body.trim()) return;
    setPublishing(true); setFeedback(null);
    try {
      await publishCommunityPost({ body: body.trim(), category: composerCategory, spoiler: spoiler || composerCategory === 'spoiler' });
      setBody(''); setSpoiler(false); setFeedback({ message: t('community.social.boards.publishSuccess'), tone: 'success' }); await load();
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : t('community.social.boards.publishError'), tone: 'error' }); }
    finally { setPublishing(false); }
  }

  return (
    <PageShell size={1100}>
      <PageHeader description={t('community.social.boards.description')} eyebrow="COMMUNITY BOARD" title={t('community.social.boards.title')} titleOrder={1} />
      <Group className={styles.subnav ?? ''} gap="xs"><Link to="/community">{t('community.social.boards.workFeed')}</Link><Link aria-current="page" to="/community/boards">{t('community.social.boards.title')}</Link><Link to="/community/taste">{t('community.social.boards.taste')}</Link></Group>
      {canWrite ? (
        <Paper className={styles.composer ?? ''} p="lg" radius="lg" withBorder>
          <Stack gap="md">
            <Group align="flex-end" justify="space-between"><Select data={categories} label={t('community.social.boards.categoryLabel')} onChange={(value) => value && setComposerCategory(value as CommunityBoardCategory)} value={composerCategory} /><Text c="dimmed" size="sm">{t('community.social.boards.workOptional')}</Text></Group>
            <Textarea autosize maxLength={1000} minRows={3} onChange={(event) => setBody(event.currentTarget.value)} placeholder={t('community.social.boards.bodyPlaceholder')} value={body} />
            <Group justify="space-between"><Switch checked={spoiler} label={t('community.spoilerLabel')} onChange={(event) => setSpoiler(event.currentTarget.checked)} /><AppButton disabled={!body.trim()} loading={publishing} onClick={() => void publish()} tone="primary">{t('community.social.boards.publish')}</AppButton></Group>
          </Stack>
        </Paper>
      ) : (
        <Paper className={styles.participationNote ?? ''} p="md" radius="lg" withBorder>
          <div><Text fw={800}>{t('community.social.boards.readPublicTitle')}</Text><Text c="dimmed" size="sm">{t('community.social.boards.readPublicDescription')}</Text></div>
          {mode === 'authenticated' ? <Link to="/account/settings">{t('community.social.handlePrompt.action')}</Link> : <Link to="/auth/login">{t('community.social.boards.login')}</Link>}
        </Paper>
      )}
      {feedback && <FeedbackMessage tone={feedback.tone}>{feedback.message}</FeedbackMessage>}
      <div className={styles.toolbar}>
        <Tabs onChange={(value) => value && setCategory(value as CommunityBoardCategory | 'all')} value={category}><Tabs.List aria-label={t('community.social.boards.categoryAria')}><Tabs.Tab value="all">{t('community.social.boards.categories.all')}</Tabs.Tab>{categories.map((item) => <Tabs.Tab key={item.value} value={item.value}>{item.label}</Tabs.Tab>)}</Tabs.List></Tabs>
        <Select aria-label={t('community.social.boards.sortAria')} data={[{ label: t('community.social.boards.sortLatest'), value: 'latest' }, { label: t('community.social.boards.sortPopular'), value: 'popular' }]} onChange={(value) => value && setSort(value as CommunityPostSort)} value={sort} />
      </div>
      {loading ? <LoadingState rows={5} title={t('community.social.boards.loading')} /> : error ? (
        <StateMessage actions={<Group gap="xs"><AppButton onClick={() => void load()} tone="primary">{t('community.retry')}</AppButton><AppLinkButton to="/works" tone="secondary">{t('community.social.backToLibrary')}</AppLinkButton></Group>} description={t('community.social.boards.errorDescription', { message: error })} title={t('community.social.boards.errorTitle')} tone="error" />
      ) : posts.length ? (
        <Stack gap="sm">{posts.map((post) => <Link className={styles.postLink} key={post.id} to={`/community/posts/${post.id}`}><Paper p="lg" radius="lg" withBorder><Group justify="space-between" wrap="nowrap"><div><Text c="indigo" fw={750} size="xs">{categories.find((item) => item.value === post.category)?.label ?? t('community.social.boards.categories.free')}</Text><Text fw={800} lineClamp={2}>{post.spoiler ? t('community.social.boards.spoilerPrefix') : ''}{post.body}</Text><Text c="dimmed" mt={6} size="xs">{t('community.social.boards.meta', { author: post.author.displayName, comments: post.commentCount, reactions: post.reactionCount })}</Text></div></Group></Paper></Link>)}</Stack>
      ) : (
        <Paper className={styles.emptyBoard ?? ''} p="xl" radius="lg" withBorder>
          <div><Text c="indigo" fw={800} size="xs">{category === 'all' ? t('community.social.boards.allStories') : categories.find((item) => item.value === category)?.label}</Text><Text fw={850} mt={6} size="lg">{t('community.social.boards.emptyTitle')}</Text><Text c="dimmed" mt="xs" size="sm">{categoryDescriptions[category]}</Text></div>
          <Link to="/community">{t('community.social.boards.browseReviews')}</Link>
        </Paper>
      )}
    </PageShell>
  );
}
