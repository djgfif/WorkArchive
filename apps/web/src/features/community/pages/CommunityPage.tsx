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
import styles from './CommunityPage.module.css';

const sortLabels: Record<CommunityPostSort, string> = { latest: '최신', popular: '인기' };

const communityPaths = [
  { description: '작품별 평점과 리뷰를 한 흐름에서 살펴봅니다.', eyebrow: '작품 중심', label: '리뷰 발견', to: '#community-feed' },
  { description: '작품 연결 없이도 추천·질문·정보를 나눕니다.', eyebrow: '자유 토론', label: '게시판', to: '/community/boards' },
  { description: '개인 기록은 보내지 않고 브라우저에서만 비교합니다.', eyebrow: '로컬 분석', label: '취향 찾기', to: '/community/taste' },
] as const;

function WorkCover({ work }: { work: { thumbnailUrl: string; title: string } }) {
  const image = getDisplayImageUrl(work.thumbnailUrl);
  return image ? <img alt="" className={styles.cover} src={image} /> : null;
}

export function CommunityFeedCard({ item, onReaction }: { item: CommunityFeedItem; onReaction?: (item: CommunityFeedItem) => void }) {
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
              <Text c="dimmed" size="xs">{content.author.handle ? `@${content.author.handle}` : '커뮤니티 사용자'}</Text>
            </span>
          </Link>
          <AppBadge>{item.kind === 'review' ? '작품 리뷰' : '게시판'}</AppBadge>
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
          {content.spoiler ? '스포일러가 포함된 감상입니다. 열어서 확인하세요.' : content.body}
        </Link>
        <Group className={styles.cardActions ?? ''} gap="xs">
          <button aria-pressed={content.viewerHasReacted} className={content.viewerHasReacted ? styles.actionActive : styles.action} disabled={!onReaction} onClick={() => onReaction?.(item)} type="button">공감 {content.reactionCount}</button>
          <Link className={styles.actionLink} to={detailPath}>댓글 {content.commentCount ?? 0}</Link>
          <button className={styles.action} onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${detailPath}`)} type="button">공유</button>
        </Group>
      </Stack>
    </Paper>
  );
}

export function CommunityPage() {
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
  const [notice, setNotice] = useState<string | null>(null);

  usePageTitle('커뮤니티');
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [feed, worksResult] = await Promise.all([fetchCommunityFeed(sort, scope), fetchTrendingCommunityWorks()]);
      setItems(feed.items);
      setTrending(worksResult);
    } catch (loadError) {
      setError(describeCommunityLoadFailure(loadError, '커뮤니티를 불러오지 못했습니다.'));
    } finally { setLoading(false); }
  }, [scope, sort]);

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
      setNotice('리뷰를 공개했습니다. 개인 기록은 변경되지 않습니다.');
      await load();
    } catch (publishError) {
      setNotice(publishError instanceof Error ? publishError.message : '리뷰를 공개하지 못했습니다.');
    } finally { setPublishing(false); }
  }
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
          <h1>작품에서 시작하는 이야기</h1>
          <Text c="dimmed">평가와 리뷰를 발견하고, 취향이 닮은 사람을 만나보세요.</Text>
          <Text className={styles.trustLine ?? ''}>개인 기록은 비공개로 유지되고, 직접 공개한 내용만 이곳에 나타납니다.</Text>
        </div>
      </section>

      <nav aria-label="커뮤니티 둘러보기" className={styles.pathNav}>
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
            <Group align="flex-start" justify="space-between"><div><Text fw={800}>기록에서 공개 리뷰 만들기</Text><Text c="dimmed" size="sm">카탈로그와 연결된 작품만 선택할 수 있습니다.</Text></div><AppBadge>직접 공개</AppBadge></Group>
            <div className={styles.composerGrid}>
              <Select clearable data={workOptions} label="작품" nothingFoundMessage="리뷰할 수 있는 연결 작품이 없습니다." onChange={chooseWork} placeholder="작품을 선택하세요" searchable value={workId} />
              <div><Text fw={600} size="sm">공개 평점</Text><Rating color="yellow" fractions={2} onChange={setRating} size="lg" value={rating} /></div>
            </div>
            {selected && <div className={styles.privacyNote}>평점과 감상을 편집 가능한 공개 초안으로 복사했습니다. 로컬 기록 ID·비공개 메모는 전송하지 않으며, 이후 개인 기록과 자동 동기화되지 않습니다.</div>}
            <Textarea autosize maxLength={5000} minRows={2} onChange={(event) => setBody(event.currentTarget.value)} placeholder="이 작품에서 오래 남은 장면이나 생각을 적어보세요." value={body} />
            <Group justify="space-between"><Switch checked={spoiler} label="스포일러 포함" onChange={(event) => setSpoiler(event.currentTarget.checked)} /><AppButton disabled={!selected || (!body.trim() && !rating)} loading={publishing} onClick={() => void publishReview()} tone="primary">리뷰 공개</AppButton></Group>
          </Stack>
        </Paper>
      ) : authenticated ? (
        <Paper className={styles.handlePrompt ?? ''} p="md" radius="lg" withBorder>
          <Group justify="space-between">
            <div><Text fw={800}>감상을 공개할 준비가 거의 끝났어요</Text><Text c="dimmed" size="sm">고유 핸들을 만든 뒤 리뷰와 댓글에 참여할 수 있습니다.</Text></div>
            <Link className={styles.secondaryLink} to="/account/settings">핸들 만들기</Link>
          </Group>
        </Paper>
      ) : null}

      {notice && <FeedbackMessage tone={notice.includes('못') ? 'error' : 'success'}>{notice}</FeedbackMessage>}
      {trending.length > 0 && (
        <section className={styles.trendingSection}>
          <Group justify="space-between"><h2>지금 이야기되는 작품</h2><Text c="dimmed" size="sm">최근 리뷰와 토론 기준</Text></Group>
          <div className={styles.trendingGrid}>{trending.map((entry) => <Paper className={styles.trendingCard ?? ''} key={entry.work.catalogTitleId} p="md" radius="lg" withBorder><WorkCover work={entry.work} /><div><Text fw={800} lineClamp={1}>{entry.work.title}</Text><Text c="dimmed" size="xs">리뷰 {entry.reviewCount} · 토론 {entry.discussionCount}</Text>{entry.averageRating !== null && <Text className={styles.ratingValue ?? ''}>{entry.averageRating.toFixed(1)} / 5</Text>}</div></Paper>)}</div>
        </section>
      )}

      <div className={styles.layout}>
        <main id="community-feed">
          <div className={styles.feedToolbar}>
            <div><h2>새로운 감상</h2><Text c="dimmed" size="sm">공개된 리뷰와 작품 토론만 보여요.</Text></div>
            <div className={styles.feedFilters}>
              {authenticated && <Tabs onChange={(value) => { if (value) setScope(value as CommunityFeedScope); }} value={scope}><Tabs.List aria-label="피드 범위"><Tabs.Tab value="all">전체</Tabs.Tab><Tabs.Tab value="following">팔로잉</Tabs.Tab></Tabs.List></Tabs>}
              <Tabs onChange={(value) => value && setSort(value as CommunityPostSort)} value={sort}><Tabs.List aria-label="피드 정렬">{Object.entries(sortLabels).map(([value, label]) => <Tabs.Tab key={value} value={value}>{label}</Tabs.Tab>)}</Tabs.List></Tabs>
            </div>
          </div>
          {loading ? <LoadingState rows={4} title="감상을 불러오는 중" /> : error ? <StateMessage actions={<Group gap="xs">{error.retryable && <AppButton onClick={() => void load()} tone="primary">다시 시도</AppButton>}<AppLinkButton to="/works" tone="secondary">내 서재로</AppLinkButton></Group>} description={error.description} title={error.title} tone="error" /> : items.length ? <Stack gap="md">{items.map((item) => authenticated ? <CommunityFeedCard item={item} key={item.id} onReaction={(entry) => void react(entry)} /> : <CommunityFeedCard item={item} key={item.id} />)}</Stack> : (
            <Paper className={styles.emptyFeed ?? ''} p="xl" radius="lg" withBorder>
              <div>
                <Text className={styles.emptyEyebrow ?? ''}>첫 번째 이야기</Text>
                <Text fw={850} mt={6} size="lg">아직 공개된 감상이 없습니다</Text>
                <Text c="dimmed" mt="xs" size="sm">카탈로그 작품의 리뷰를 공개하거나, 작품 연결 없이 게시판에서 이야기를 시작할 수 있습니다.</Text>
              </div>
              <Group gap="xs">
                <Link className={styles.secondaryLink} to="/community/boards">게시판 둘러보기</Link>
                {authenticated && !user?.handle && <Link className={styles.primaryLink} to="/account/settings">핸들 만들기</Link>}
              </Group>
            </Paper>
          )}
        </main>
        <aside className={styles.rail}>
          {authors.length ? <Paper p="lg" radius="lg" withBorder><Stack gap="md"><Text fw={800}>활동 중인 아카이버</Text>{authors.map((author) => <Link className={styles.railAuthor} key={author.handle} to={`/u/${author.handle}`}><Avatar radius="xl" size={34} src={getDisplayImageUrl(author.avatarUrl) || null}>{author.displayName.slice(0, 1)}</Avatar><span><Text fw={700} size="sm">{author.displayName}</Text><Text c="dimmed" size="xs">@{author.handle}</Text></span></Link>)}</Stack></Paper> : (
            <Paper className={styles.guideCard ?? ''} p="lg" radius="lg" withBorder>
              <Text fw={800}>어디서 시작할까요?</Text>
              <Stack gap="sm" mt="md">
                <a href="#community-feed"><strong>리뷰 발견</strong><span>작품별 평점과 감상 보기</span></a>
                <Link to="/community/boards"><strong>게시판</strong><span>추천·질문·정보 나누기</span></Link>
                <Link to="/community/taste"><strong>취향 찾기</strong><span>공개 취향과 내 기록 비교하기</span></Link>
              </Stack>
            </Paper>
          )}
          <Paper className={styles.privacyCard ?? ''} p="lg" radius="lg" withBorder><AppBadge>명시적 공개만</AppBadge><Text fw={800} mt="sm">내 기록은 그대로 비공개</Text><Text c="dimmed" mt="xs" size="sm">직접 공개한 리뷰와 글만 커뮤니티에 나타납니다. 서재와 메모는 누구에게도 전송되지 않습니다.</Text></Paper>
        </aside>
      </div>
    </PageShell>
  );
}
