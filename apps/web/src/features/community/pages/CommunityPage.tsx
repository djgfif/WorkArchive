import {
  Avatar,
  Group,
  Menu,
  Paper,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
} from '@mantine/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommunityPostSort,
  CommunityPostView,
  CommunityReportReason,
  WorkRecord,
} from '@work-archive/shared-types';

import {
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  LoadingState,
  PageHeader,
  PageShell,
  SectionCard,
  StateMessage,
} from '@shared/components/AppPrimitives';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import {
  formatAppDateTime,
  formatAppNumber,
  useAppTranslation,
} from '@app/i18n';
import { useAuthSession } from '@features/auth';
import { getWorkTypeLabel, worksRepository } from '@features/works';
import {
  deleteCommunityPost,
  fetchCommunityPosts,
  publishCommunityPost,
  reportCommunityPost,
  setCommunityReaction,
} from '../services/community.api';
import { buildCommunityPostInput } from '../services/community-publish';
import styles from './CommunityPage.module.css';
import { cn } from '@shared/utils/class-names';
import { getDisplayImageUrl } from '@shared/utils/image-proxy';

const css = styles;
const REPORT_REASONS: CommunityReportReason[] = [
  'spoiler',
  'harassment',
  'hate',
  'spam',
  'other',
];

interface FeedbackState {
  message: string;
  tone: 'error' | 'success';
}

export function CommunityPage() {
  const { t } = useAppTranslation();
  const { mode } = useAuthSession();
  const authenticated = mode === 'authenticated';
  const [sort, setSort] = useState<CommunityPostSort>('latest');
  const [posts, setPosts] = useState<CommunityPostView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [busyPostIds, setBusyPostIds] = useState<Set<string>>(() => new Set());
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(
    () => new Set(),
  );
  const [reportedPostIds, setReportedPostIds] = useState<Set<string>>(
    () => new Set(),
  );
  const feedRequestId = useRef(0);

  usePageTitle(t('community.pageTitle'));

  const loadFeed = useCallback(async () => {
    const requestId = ++feedRequestId.current;
    setIsLoading(true);
    setFeedError(null);

    try {
      const response = await fetchCommunityPosts(sort);
      if (requestId !== feedRequestId.current) return;
      setPosts(response.posts);
      setNextCursor(response.nextCursor);
    } catch (error) {
      if (requestId !== feedRequestId.current) return;
      setFeedError(
        error instanceof Error ? error.message : t('community.errorLoad'),
      );
    } finally {
      if (requestId === feedRequestId.current) setIsLoading(false);
    }
  }, [sort, t]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!authenticated) {
      setWorks([]);
      setSelectedWorkId(null);
      return;
    }

    let cancelled = false;

    void worksRepository.listActive().then((activeWorks) => {
      if (!cancelled) {
        setWorks(activeWorks);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const selectedWork = useMemo(
    () => works.find((work) => work.id === selectedWorkId) ?? null,
    [selectedWorkId, works],
  );
  const selectedWorkThumbnailUrl = useMemo(
    () => getDisplayImageUrl(selectedWork?.thumbnailUrl),
    [selectedWork],
  );
  const workOptions = useMemo(
    () =>
      works.map((work) => ({
        label: `${work.title} · ${getWorkTypeLabel(work.type)}`,
        value: work.id,
      })),
    [works],
  );

  async function handlePublish() {
    const trimmedBody = body.trim();

    if (!trimmedBody) {
      setFeedback({ message: t('community.errorBodyRequired'), tone: 'error' });
      return;
    }

    setIsPublishing(true);
    setFeedback(null);

    try {
      const published = await publishCommunityPost(
        buildCommunityPostInput(trimmedBody, spoiler, selectedWork),
      );

      feedRequestId.current += 1;
      setPosts((current) => [published, ...current]);
      setBody('');
      setSelectedWorkId(null);
      setSpoiler(false);
      setFeedback({ message: t('community.publishSuccess'), tone: 'success' });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error ? error.message : t('community.errorPublish'),
        tone: 'error',
      });
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleLoadMore() {
    if (!nextCursor) return;

    const requestId = feedRequestId.current;
    setIsLoadingMore(true);
    setFeedback(null);

    try {
      const response = await fetchCommunityPosts(sort, nextCursor);
      if (requestId !== feedRequestId.current) return;
      setPosts((current) => {
        const ids = new Set(current.map((post) => post.id));
        return [
          ...current,
          ...response.posts.filter((post) => !ids.has(post.id)),
        ];
      });
      setNextCursor(response.nextCursor);
    } catch (error) {
      if (requestId !== feedRequestId.current) return;
      setFeedback({
        message:
          error instanceof Error ? error.message : t('community.errorLoadMore'),
        tone: 'error',
      });
    } finally {
      if (requestId === feedRequestId.current) setIsLoadingMore(false);
    }
  }

  function setPostBusy(postId: string, busy: boolean) {
    setBusyPostIds((current) => {
      const next = new Set(current);
      if (busy) next.add(postId);
      else next.delete(postId);
      return next;
    });
  }

  async function handleReaction(post: CommunityPostView) {
    setPostBusy(post.id, true);
    setFeedback(null);

    try {
      await setCommunityReaction(post.id, post.viewerHasReacted);
      setPosts((current) =>
        current.map((entry) =>
          entry.id === post.id
            ? {
                ...entry,
                reactionCount: Math.max(
                  0,
                  entry.reactionCount + (entry.viewerHasReacted ? -1 : 1),
                ),
                viewerHasReacted: !entry.viewerHasReacted,
              }
            : entry,
        ),
      );
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error ? error.message : t('community.errorReaction'),
        tone: 'error',
      });
    } finally {
      setPostBusy(post.id, false);
    }
  }

  async function handleDelete(postId: string) {
    if (!window.confirm(t('community.deleteConfirm'))) return;

    setPostBusy(postId, true);
    setFeedback(null);

    try {
      await deleteCommunityPost(postId);
      setPosts((current) => current.filter((post) => post.id !== postId));
      setFeedback({ message: t('community.deleteSuccess'), tone: 'success' });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error ? error.message : t('community.errorDelete'),
        tone: 'error',
      });
    } finally {
      setPostBusy(postId, false);
    }
  }

  async function handleReport(postId: string, reason: CommunityReportReason) {
    setPostBusy(postId, true);
    setFeedback(null);

    try {
      await reportCommunityPost(postId, reason);
      setReportedPostIds((current) => new Set(current).add(postId));
      setFeedback({ message: t('community.reportSuccess'), tone: 'success' });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error ? error.message : t('community.errorReport'),
        tone: 'error',
      });
    } finally {
      setPostBusy(postId, false);
    }
  }

  function toggleSpoiler(postId: string) {
    setRevealedSpoilers((current) => {
      const next = new Set(current);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  return (
    <PageShell size={1220}>
      <PageHeader
        description={t('community.pageDescription')}
        eyebrow={t('community.eyebrow')}
        meta={
          <Group gap="xs" wrap="wrap">
            <AppBadge>{t('community.accessBadge')}</AppBadge>
            <AppBadge>{t('community.privacyBadge')}</AppBadge>
          </Group>
        }
        title={t('community.pageTitle')}
        titleOrder={1}
      />

      <div className={cn(css.layout)}>
        <Stack gap="lg" miw={0}>
          {authenticated ? (
            <SectionCard className={cn(css.composer)} padding="lg">
              <Stack gap="md">
                <Group align="center" gap="sm" wrap="nowrap">
                  <Stack gap={2} miw={0}>
                    <Text fw={800}>{t('community.composerTitle')}</Text>
                    <Text c="dimmed" size="sm">
                      {t('community.composerDescription')}
                    </Text>
                  </Stack>
                </Group>
                <Select
                  clearable
                  data={workOptions}
                  label={t('community.workSelectorLabel')}
                  nothingFoundMessage={t('community.workSelectorEmpty')}
                  onChange={setSelectedWorkId}
                  placeholder={t('community.workSelectorPlaceholder')}
                  searchable
                  value={selectedWorkId}
                />
                {selectedWork && (
                  <div className={cn(css.publicPreview)}>
                    <Group align="center" gap="sm" wrap="nowrap">
                      {selectedWorkThumbnailUrl && (
                        <img
                          alt=""
                          className={cn(css.workThumbnail)}
                          src={selectedWorkThumbnailUrl}
                        />
                      )}
                      <Stack gap={3} miw={0}>
                        <Text className={cn(css.workLabel)} size="xs">
                          {t('community.publicPreviewEyebrow')}
                        </Text>
                        <Text fw={750} size="sm">
                          {selectedWork.title} ·{' '}
                          {getWorkTypeLabel(selectedWork.type)}
                        </Text>
                        <Text c="dimmed" size="xs">
                          {t('community.publicPreviewDescription')}
                        </Text>
                      </Stack>
                    </Group>
                  </div>
                )}
                <Textarea
                  autosize
                  label={t('community.bodyLabel')}
                  maxLength={1000}
                  minRows={4}
                  onChange={(event) => setBody(event.currentTarget.value)}
                  placeholder={t('community.bodyPlaceholder')}
                  value={body}
                />
                <Group align="center" justify="space-between" wrap="wrap">
                  <Switch
                    checked={spoiler}
                    label={t('community.spoilerLabel')}
                    onChange={(event) =>
                      setSpoiler(event.currentTarget.checked)
                    }
                  />
                  <Group gap="md">
                    <Text c="dimmed" size="xs">
                      {t('community.characterCount', {
                        count: formatAppNumber(body.length),
                      })}
                    </Text>
                    <AppButton
                      disabled={!body.trim()}
                      loading={isPublishing}
                      onClick={() => void handlePublish()}
                      tone="primary"
                      type="button"
                    >
                      {t('community.publish')}
                    </AppButton>
                  </Group>
                </Group>
                <Text c="dimmed" size="xs">
                  {t('community.publishScope')}
                </Text>
              </Stack>
            </SectionCard>
          ) : (
            <SectionCard className={cn(css.guestComposer)} padding="lg">
              <Group align="center" justify="space-between" wrap="wrap">
                <Stack gap={4}>
                  <Text fw={750}>{t('community.guestComposerTitle')}</Text>
                  <Text c="dimmed" size="sm">
                    {t('community.guestComposerDescription')}
                  </Text>
                </Stack>
                <AppLinkButton
                  state={{ returnTo: '/community' }}
                  to="/auth/login"
                  tone="primary"
                >
                  {t('community.loginToPublish')}
                </AppLinkButton>
              </Group>
            </SectionCard>
          )}

          {feedback && (
            <FeedbackMessage tone={feedback.tone}>
              {feedback.message}
            </FeedbackMessage>
          )}

          <div className={cn(css.feedToolbar)}>
            <Stack gap={2}>
              <Text fw={800}>{t('community.feedTitle')}</Text>
              <Text c="dimmed" size="sm">
                {t('community.feedDescription')}
              </Text>
            </Stack>
            <Tabs
              className={cn(css.sortTabs)}
              onChange={(value) => value && setSort(value as CommunityPostSort)}
              value={sort}
            >
              <Tabs.List>
                <Tabs.Tab value="latest">{t('community.sortLatest')}</Tabs.Tab>
                <Tabs.Tab value="popular">
                  {t('community.sortPopular')}
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>
          </div>

          {isLoading ? (
            <LoadingState rows={4} title={t('community.loading')} />
          ) : feedError ? (
            <StateMessage
              actions={
                <AppButton onClick={() => void loadFeed()} tone="primary">
                  {t('community.retry')}
                </AppButton>
              }
              description={feedError}
              title={t('community.errorTitle')}
              tone="error"
            />
          ) : posts.length === 0 ? (
            <StateMessage
              description={t(
                authenticated
                  ? 'community.emptyMemberDescription'
                  : 'community.emptyGuestDescription',
              )}
              title={t('community.emptyTitle')}
            />
          ) : (
            <Stack gap="md">
              {posts.map((post) => {
                const spoilerRevealed = revealedSpoilers.has(post.id);
                const reported = reportedPostIds.has(post.id);
                const avatarUrl = getDisplayImageUrl(post.author.avatarUrl);
                const workThumbnailUrl = getDisplayImageUrl(
                  post.work?.thumbnailUrl,
                );

                return (
                  <Paper
                    className={cn(css.postCard)}
                    key={post.id}
                    p="lg"
                    radius="lg"
                    withBorder
                  >
                    <Stack gap="md">
                      <Group
                        align="flex-start"
                        justify="space-between"
                        wrap="nowrap"
                      >
                        <Group align="center" gap="sm" miw={0} wrap="nowrap">
                          <Avatar radius="xl" size={40} src={avatarUrl || null}>
                            {post.author.displayName.slice(0, 1)}
                          </Avatar>
                          <Stack gap={1} miw={0}>
                            <Group gap="xs" wrap="wrap">
                              <Text fw={750} size="sm">
                                {post.author.displayName}
                              </Text>
                              {post.author.handle && (
                                <Text c="dimmed" size="xs">
                                  @{post.author.handle}
                                </Text>
                              )}
                            </Group>
                            <Text c="dimmed" size="xs">
                              {formatAppDateTime(post.createdAt)}
                            </Text>
                          </Stack>
                        </Group>

                        {authenticated && (
                          <Menu position="bottom-end" shadow="md" width={220}>
                            <Menu.Target>
                              <button
                                aria-label={t('community.postMenu')}
                                className={cn(css.menuButton)}
                                disabled={busyPostIds.has(post.id)}
                                type="button"
                              >
                                {t('community.postMenuShort')}
                              </button>
                            </Menu.Target>
                            <Menu.Dropdown>
                              {post.viewerCanDelete ? (
                                <Menu.Item
                                  color="red"
                                  onClick={() => void handleDelete(post.id)}
                                >
                                  {t('community.deletePost')}
                                </Menu.Item>
                              ) : reported ? (
                                <Menu.Item disabled>
                                  {t('community.reported')}
                                </Menu.Item>
                              ) : (
                                <>
                                  <Menu.Label>
                                    {t('community.reportPost')}
                                  </Menu.Label>
                                  {REPORT_REASONS.map((reason) => (
                                    <Menu.Item
                                      key={reason}
                                      onClick={() =>
                                        void handleReport(post.id, reason)
                                      }
                                    >
                                      {t(`community.reportReason.${reason}`)}
                                    </Menu.Item>
                                  ))}
                                </>
                              )}
                            </Menu.Dropdown>
                          </Menu>
                        )}
                      </Group>

                      {post.work && (
                        <div className={cn(css.workSnapshot)}>
                          {workThumbnailUrl && (
                            <img
                              alt=""
                              className={cn(css.workThumbnail)}
                              src={workThumbnailUrl}
                            />
                          )}
                          <Stack gap={2} miw={0}>
                            <Text className={cn(css.workLabel)} size="xs">
                              {t('community.postWorkEyebrow')}
                            </Text>
                            <Text fw={750} size="sm" truncate>
                              {post.work.title}
                            </Text>
                            <Text c="dimmed" size="xs">
                              {getWorkTypeLabel(post.work.type)}
                            </Text>
                          </Stack>
                        </div>
                      )}

                      {post.spoiler && !spoilerRevealed ? (
                        <button
                          aria-expanded="false"
                          className={cn(css.spoilerButton)}
                          onClick={() => toggleSpoiler(post.id)}
                          type="button"
                        >
                          {t('community.spoilerReveal')}
                        </button>
                      ) : (
                        <Stack gap="xs">
                          <Text className={cn(css.postBody)}>{post.body}</Text>
                          {post.spoiler && (
                            <button
                              aria-expanded="true"
                              className={cn(css.spoilerHideButton)}
                              onClick={() => toggleSpoiler(post.id)}
                              type="button"
                            >
                              {t('community.spoilerHide')}
                            </button>
                          )}
                        </Stack>
                      )}

                      <Group className={cn(css.actionRow)} gap="sm">
                        {authenticated ? (
                          <button
                            aria-label={t('community.reactionAria', {
                              count: formatAppNumber(post.reactionCount),
                            })}
                            aria-pressed={post.viewerHasReacted}
                            className={`${cn(css.reactionButton)} ${post.viewerHasReacted ? cn(css.reactionButtonActive) : ''}`}
                            disabled={busyPostIds.has(post.id)}
                            onClick={() => void handleReaction(post)}
                            type="button"
                          >
                            <span>{t('community.reactionLabel')}</span>
                            {formatAppNumber(post.reactionCount)}
                          </button>
                        ) : (
                          <span className={cn(css.reactionCount)}>
                            <span>{t('community.reactionLabel')}</span>
                            {formatAppNumber(post.reactionCount)}
                          </span>
                        )}
                      </Group>
                    </Stack>
                  </Paper>
                );
              })}

              {nextCursor && (
                <AppButton
                  loading={isLoadingMore}
                  onClick={() => void handleLoadMore()}
                  tone="secondary"
                >
                  {t('community.loadMore')}
                </AppButton>
              )}
            </Stack>
          )}
        </Stack>

        <aside className={cn(css.principles)}>
          <SectionCard className={cn(css.principlesCard)} padding="lg">
            <Stack gap="lg">
              <Stack gap={4}>
                <Text className={cn(css.railEyebrow)} size="xs">
                  {t('community.principlesEyebrow')}
                </Text>
                <Text fw={800}>{t('community.principlesTitle')}</Text>
              </Stack>
              {(['private', 'spoiler', 'respect'] as const).map((rule) => (
                <Stack gap={4} key={rule}>
                  <Text fw={700} size="sm">
                    {t(`community.principles.${rule}.title`)}
                  </Text>
                  <Text c="dimmed" size="sm">
                    {t(`community.principles.${rule}.description`)}
                  </Text>
                </Stack>
              ))}
            </Stack>
          </SectionCard>
        </aside>
      </div>
    </PageShell>
  );
}
