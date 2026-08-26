import { Avatar, Group, Paper, Rating, Select, Stack, Switch, Tabs, Text, Textarea } from '@mantine/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CommunityFeedItem, CommunityFeedScope, CommunityPostSort, CommunityTrendingWorkView, WorkRecord } from '@work-archive/shared-types';

import { AppBadge, AppButton, AppLinkButton, FeedbackMessage, LoadingState, PageShell, StateMessage } from '@shared/components/AppPrimitives';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { useAuthSession } from '@features/auth';
import { getWorkTypeLabel, worksRepository } from '@features/works';
import { getDisplayImageUrl } from '@shared/utils/image-proxy';
import { describeCommunityLoadFailure, fetchCommunityFeed, fetchTrendingCommunityWorks, setCommunityReaction, setCommunityTargetReaction, upsertCommunityReview, type CommunityLoadFailure } from '../services/community.api';
import { buildCommunityReviewRequest, createCommunityReviewDraft } from '../services/community-review-share';
import { useAppTranslation } from '@app/i18n';
import styles from './CommunityPage.module.css';

type FeedbackState = { message: string; tone: 'error' | 'success' };

function WorkCover({ work }: { work: { thumbnailUrl: string; title: string } }) {
  const image = getDisplayImageUrl(work.thumbnailUrl);
  return image ? <img alt="" className={styles.cover} src={image} /> : null;
}

export function CommunityFeedCard({ item, onReaction }: { item: CommunityFeedItem; onReaction?: (item: CommunityFeedItem) => void }) {
  const { t } = useAppTranslation();
  const content = item.kind === 'review' ? item.review : item.post;
  if (!content) return null;
  const detailPath = item.kind === 'review' ? `/community/reviews/${content.id}` : `/community/posts/${content.id}`;
  const profilePath = content.author.handle ? `/u/${content.author.handle}` : detailPath;
  const avatar = getDisplayImageUrl(content.author.avatarUrl);
  const rating = item.review?.rating ?? null;

  return (
    <Paper className={styles.feedCard ?? ''} p="lg" radius="lg" withBorder>
      <Stack gap="md">
        <Group align="center" justify="space-between" wrap="nowrap">
          <Link className={styles.authorLink} to={profilePath}>
            <Avatar radius="xl" size={38} src={avatar || null}>{content.author.displayName.slice(0, 1)}</Avatar>
            <span>
              <Text fw={750} size="sm">{content.author.displayName}</Text>
              <Text c="dimmed" size="xs">{content.author.handle ? `@${content.author.handle}` : t('community.social.anonymousUser')}</Text>
            </span>
          </Link>
          <AppBadge>{item.kind === 'review' ? t('community.social.reviewType') : t('community.social.boardType')}</AppBadge>
        </Group>
        {content.work && (
          <Link className={styles.workLine} to={detailPath}>
            <WorkCover work={content.work} />
            <span>
              <Text c="dimmed" size="xs">{getWorkTypeLabel(content.work.type)}</Text>
              <Text fw={800}>{content.work.title}</Text>
              {rating !== null && <Group gap="xs"><Rating color="yellow" fractions={2} readOnly size="sm" value={rating} /><Text className={styles.ratingValue ?? ''} size="sm">{rating.toFixed(1)}</Text></Group>}
            </span>
          </Link>
        )}
        <Link className={styles.bodyLink} to={detailPath}>
          {content.spoiler ? t('community.social.spoilerBody') : content.body}
        </Link>
        <Group className={styles.cardActions ?? ''} gap="xs">
          <button aria-pressed={content.viewerHasReacted} className={content.viewerHasReacted ? styles.actionActive : styles.action} disabled={!onReaction} onClick={() => onReaction?.(item)} type="button">{t('community.social.reactionCount', { count: content.reactionCount })}</button>
          <Link className={styles.actionLink} to={detailPath}>{t('community.social.commentCount', { count: content.commentCount ?? 0 })}</Link>
          <button className={styles.action} onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${detailPath}`)} type="button">{t('community.social.share')}</button>
        </Group>
      </Stack>
    </Paper>
  );
}

export function CommunityPage() {
  const { t } = useAppTranslation();
  const { mode, user } = useAuthSession();
  const authenticated = mode === 'authenticated';
  const [sort, setSort] = useState<CommunityPostSort>('latest');
  const [scope, setScope] = useState<CommunityFeedScope>('all');
  const [items, setItems] = useState<CommunityFeedItem[]>([]);
  const [trending, setTrending] = useState<CommunityTrendingWorkView[]>([]);
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [workId, setWorkId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(0);
  const [spoiler, setSpoiler] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<CommunityLoadFailure | null>(null);
  const [notice, setNotice] = useState<FeedbackState | null>(null);

  usePageTitle(t('community.pageTitle'));
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [feed, worksResult] = await Promise.all([fetchCommunityFeed(sort, scope), fetchTrendingCommunityWorks()]);
      setItems(feed.items);
      setTrending(worksResult);
    } catch (loadError) {
      setError(describeCommunityLoadFailure(loadError, t('community.errorLoad')));
    } finally { setLoading(false); }
  }, [scope, sort, t]);

  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (!authenticated) return;
    void worksRepository.listActive().then((records) => setWorks(records.filter((record) => Boolean(record.catalogTitleId))));
  }, [authenticated]);

  const selected = useMemo(() => works.find((work) => work.id === workId) ?? null, [workId, works]);
  const workOptions = works.map((work) => ({ label: work.title, value: work.id }));
  function chooseWork(value: string | null) {
    setWorkId(value);
    const work = works.find((entry) => entry.id === value);
    if (!work) return;
    const draft = createCommunityReviewDraft(work);
    setBody(draft.body);
    setRating(draft.rating);
  }
  async function publishReview() {
    if (!selected?.catalogTitleId || (!body.trim() && !rating)) return;
    setPublishing(true); setNotice(null);
    try {
      await upsertCommunityReview(selected.catalogTitleId, buildCommunityReviewRequest({ body, rating, spoiler }));
      setBody(''); setRating(0); setWorkId(null); setSpoiler(false);
      setNotice({ message: t('community.social.reviewComposer.success'), tone: 'success' });
      await load();
    } catch (publishError) {
      setNotice({ message: publishError instanceof Error ? publishError.message : t('community.social.reviewComposer.error'), tone: 'error' });
    } finally { setPublishing(false); }
  }
  const sortLabels: Record<CommunityPostSort, string> = { latest: t('community.sortLatest'), popular: t('community.sortPopular') };
  const communityPaths = [
    { description: t('community.social.paths.reviews.description'), eyebrow: t('community.social.paths.reviews.eyebrow'), label: t('community.social.paths.reviews.label'), to: '#community-feed' },
    { description: t('community.social.paths.boards.description'), eyebrow: t('community.social.paths.boards.eyebrow'), label: t('community.social.paths.boards.label'), to: '/community/boards' },
    { description: t('community.social.paths.taste.description'), eyebrow: t('community.social.paths.taste.eyebrow'), label: t('community.social.paths.taste.label'), to: '/community/taste' },
  ];
  async function react(item: CommunityFeedItem) {
    const content = item.kind === 'review' ? item.review : item.post;
    if (!content) return;
    if (item.kind === 'review') {
      await setCommunityTargetReaction('review', content.id, content.viewerHasReacted);
      setItems((current) => current.map((entry) => entry.id === item.id && entry.review ? { ...entry, review: { ...entry.review, reactionCount: Math.max(0, entry.review.reactionCount + (entry.review.viewerHasReacted ? -1 : 1)), viewerHasReacted: !entry.review.viewerHasReacted } } : entry));
      return;
    }

    await setCommunityReaction(content.id, content.viewerHasReacted);
    setItems((current) => current.map((entry) => entry.id === item.id && entry.post ? { ...entry, post: { ...entry.post, reactionCount: Math.max(0, entry.post.reactionCount + (entry.post.viewerHasReacted ? -1 : 1)), viewerHasReacted: !entry.post.viewerHasReacted } } : entry));
  }
  const authors = Array.from(new Map(items.map((item) => item.review?.author ?? item.post?.author).filter((author) => author?.handle).map((author) => [author!.handle, author!])).values()).slice(0, 5);

  return (
    <PageShell size={1360}>
      <section className={styles.hero}>
        <div>
          <Text className={styles.eyebrow ?? ''}>COMMUNITY</Text>
          <h1>{t('community.social.heroTitle')}</h1>
          <Text c="dimmed">{t('community.social.heroDescription')}</Text>
          <Text className={styles.trustLine ?? ''}>{t('community.social.heroTrust')}</Text>
        </div>
      </section>

      <nav aria-label={t('community.social.pathNav')} className={styles.pathNav}>
        {communityPaths.map((path) => {
          const content = <><span className={styles.pathEyebrow}>{path.eyebrow}</span><strong>{path.label}</strong><span>{path.description}</span></>;
          return path.to.startsWith('#')
            ? <a className={styles.pathLink} href={path.to} key={path.label}>{content}</a>
            : <Link className={styles.pathLink} key={path.label} to={path.to}>{content}</Link>;
        })}
      </nav>

      {authenticated && user?.handle ? (
        <Paper className={styles.composer ?? ''} p="lg" radius="lg" withBorder>
          <Stack gap="md">
            <Group align="flex-start" justify="space-between"><div><Text fw={800}>{t('community.social.reviewComposer.title')}</Text><Text c="dimmed" size="sm">{t('community.social.reviewComposer.description')}</Text></div><AppBadge>{t('community.social.reviewComposer.badge')}</AppBadge></Group>
            <div className={styles.composerGrid}>
              <Select clearable data={workOptions} label={t('community.social.reviewComposer.workLabel')} nothingFoundMessage={t('community.social.reviewComposer.workEmpty')} onChange={chooseWork} placeholder={t('community.social.reviewComposer.workPlaceholder')} searchable value={workId} />
              <div><Text fw={600} size="sm">{t('community.social.reviewComposer.ratingLabel')}</Text><Rating color="yellow" fractions={2} onChange={setRating} size="lg" value={rating} /></div>
            </div>
            {selected && <div className={styles.privacyNote}>{t('community.social.reviewComposer.privacy')}</div>}
            <Textarea autosize maxLength={5000} minRows={2} onChange={(event) => setBody(event.currentTarget.value)} placeholder={t('community.social.reviewComposer.bodyPlaceholder')} value={body} />
            <Group justify="space-between"><Switch checked={spoiler} label={t('community.spoilerLabel')} onChange={(event) => setSpoiler(event.currentTarget.checked)} /><AppButton disabled={!selected || (!body.trim() && !rating)} loading={publishing} onClick={() => void publishReview()} tone="primary">{t('community.social.reviewComposer.publish')}</AppButton></Group>
          </Stack>
        </Paper>
      ) : authenticated ? (
        <Paper className={styles.handlePrompt ?? ''} p="md" radius="lg" withBorder>
          <Group justify="space-between">
            <div><Text fw={800}>{t('community.social.handlePrompt.title')}</Text><Text c="dimmed" size="sm">{t('community.social.handlePrompt.description')}</Text></div>
            <Link className={styles.secondaryLink} to="/account/settings">{t('community.social.handlePrompt.action')}</Link>
          </Group>
        </Paper>
      ) : null}

      {notice && <FeedbackMessage tone={notice.tone}>{notice.message}</FeedbackMessage>}
      {trending.length > 0 && (
        <section className={styles.trendingSection}>
          <Group justify="space-between"><h2>{t('community.social.trending.title')}</h2><Text c="dimmed" size="sm">{t('community.social.trending.description')}</Text></Group>
          <div className={styles.trendingGrid}>{trending.map((entry) => <Paper className={styles.trendingCard ?? ''} key={entry.work.catalogTitleId} p="md" radius="lg" withBorder><WorkCover work={entry.work} /><div><Text fw={800} lineClamp={1}>{entry.work.title}</Text><Text c="dimmed" size="xs">{t('community.social.trending.counts', { discussions: entry.discussionCount, reviews: entry.reviewCount })}</Text>{entry.averageRating !== null && <Text className={styles.ratingValue ?? ''}>{entry.averageRating.toFixed(1)} / 5</Text>}</div></Paper>)}</div>
        </section>
      )}

      <div className={styles.layout}>
        <main id="community-feed">
          <div className={styles.feedToolbar}>
            <div><h2>{t('community.social.feed.title')}</h2><Text c="dimmed" size="sm">{t('community.social.feed.description')}</Text></div>
            <div className={styles.feedFilters}>
              {authenticated && <Tabs onChange={(value) => { if (value) setScope(value as CommunityFeedScope); }} value={scope}><Tabs.List aria-label={t('community.social.feed.scopeAria')}><Tabs.Tab value="all">{t('community.social.feed.all')}</Tabs.Tab><Tabs.Tab value="following">{t('community.social.feed.following')}</Tabs.Tab></Tabs.List></Tabs>}
              <Tabs onChange={(value) => value && setSort(value as CommunityPostSort)} value={sort}><Tabs.List aria-label={t('community.social.feed.sortAria')}>{Object.entries(sortLabels).map(([value, label]) => <Tabs.Tab key={value} value={value}>{label}</Tabs.Tab>)}</Tabs.List></Tabs>
            </div>
          </div>
          {loading ? <LoadingState rows={4} title={t('community.social.feed.loading')} /> : error ? <StateMessage actions={<Group gap="xs">{error.retryable && <AppButton onClick={() => void load()} tone="primary">{t('community.retry')}</AppButton>}<AppLinkButton to="/works" tone="secondary">{t('community.social.backToLibrary')}</AppLinkButton></Group>} description={error.description} title={error.title} tone="error" /> : items.length ? <Stack gap="md">{items.map((item) => authenticated ? <CommunityFeedCard item={item} key={item.id} onReaction={(entry) => void react(entry)} /> : <CommunityFeedCard item={item} key={item.id} />)}</Stack> : (
            <Paper className={styles.emptyFeed ?? ''} p="xl" radius="lg" withBorder>
              <div>
                <Text className={styles.emptyEyebrow ?? ''}>{t('community.social.feed.firstEyebrow')}</Text>
                <Text fw={850} mt={6} size="lg">{t('community.emptyTitle')}</Text>
                <Text c="dimmed" mt="xs" size="sm">{t('community.social.feed.emptyDescription')}</Text>
              </div>
              <Group gap="xs">
                <Link className={styles.secondaryLink} to="/community/boards">{t('community.social.feed.browseBoards')}</Link>
                {authenticated && !user?.handle && <Link className={styles.primaryLink} to="/account/settings">{t('community.social.handlePrompt.action')}</Link>}
              </Group>
            </Paper>
          )}
        </main>
        <aside className={styles.rail}>
          {authors.length ? <Paper p="lg" radius="lg" withBorder><Stack gap="md"><Text fw={800}>{t('community.social.activeArchivists')}</Text>{authors.map((author) => <Link className={styles.railAuthor} key={author.handle} to={`/u/${author.handle}`}><Avatar radius="xl" size={34} src={getDisplayImageUrl(author.avatarUrl) || null}>{author.displayName.slice(0, 1)}</Avatar><span><Text fw={700} size="sm">{author.displayName}</Text><Text c="dimmed" size="xs">@{author.handle}</Text></span></Link>)}</Stack></Paper> : (
            <Paper className={styles.guideCard ?? ''} p="lg" radius="lg" withBorder>
              <Text fw={800}>{t('community.social.guide.title')}</Text>
              <Stack gap="sm" mt="md">
                <a href="#community-feed"><strong>{t('community.social.paths.reviews.label')}</strong><span>{t('community.social.guide.reviews')}</span></a>
                <Link to="/community/boards"><strong>{t('community.social.paths.boards.label')}</strong><span>{t('community.social.guide.boards')}</span></Link>
                <Link to="/community/taste"><strong>{t('community.social.paths.taste.label')}</strong><span>{t('community.social.guide.taste')}</span></Link>
              </Stack>
            </Paper>
          )}
          <Paper className={styles.privacyCard ?? ''} p="lg" radius="lg" withBorder><AppBadge>{t('community.social.privacy.badge')}</AppBadge><Text fw={800} mt="sm">{t('community.social.privacy.title')}</Text><Text c="dimmed" mt="xs" size="sm">{t('community.social.privacy.description')}</Text></Paper>
        </aside>
      </div>
    </PageShell>
  );
}
