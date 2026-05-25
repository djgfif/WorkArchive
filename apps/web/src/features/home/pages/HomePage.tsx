import { useState, type FormEvent } from 'react';
import {
  Accordion,
  Box,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  AppBadge,
  AppButton,
  AppLinkButton,
  LoadingRows,
  StateMessage,
} from '@shared/components/AppPrimitives';
import { JsonBackupReminderCard } from '@features/archive';
import { useJsonArchiveExport } from '@features/archive';
import { useJsonBackupReminder } from '@features/archive';
import { HomeHubPageTemplate } from '@shared/components/PageTemplates';
import { useAuthSession } from '@features/auth';
import {
  ArchiveSearchBar,
  ArchiveStarterShelf,
  WorkPoster,
  WorkShelf,
} from '@features/works';
import { useWorksOverview } from '@features/works';
import { getWorkStatusLabel, getWorkTypeLabel } from '@features/works';
import styles from './HomePage.module.css';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

function formatAverageRating(value: number | null) {
  return value === null ? '미평가' : `★ ${value.toFixed(1)}`;
}

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
  return `${Math.floor(diffDays / 365)}년 전`;
}

function groupWorksByDate(works: WorkRecord[]): Array<{ label: string; works: WorkRecord[] }> {
  const groups = new Map<string, WorkRecord[]>();
  for (const work of works) {
    const label = formatRelativeDate(work.updatedAt);
    const existing = groups.get(label);
    if (existing) {
      existing.push(work);
    } else {
      groups.set(label, [work]);
    }
  }
  return Array.from(groups.entries()).map(([label, ws]) => ({ label, works: ws }));
}

function getWorkSupportLine(work: WorkRecord) {
  return [work.author, getWorkTypeLabel(work.type)].filter(Boolean).join(' · ');
}

function getContinueLine(work: WorkRecord) {
  if (work.lastConsumedLabel) {
    return `최근 위치 ${work.lastConsumedLabel}`;
  }

  if (work.lastConsumedAt) {
    return `최근 감상 ${formatRelativeDate(work.lastConsumedAt)}`;
  }

  return `수정 ${formatRelativeDate(work.updatedAt)}`;
}

function pickContinueWorks(
  recentlyConsumedWorks: WorkRecord[],
  activeWorks: WorkRecord[],
) {
  const seen = new Set<string>();
  const works: WorkRecord[] = [];

  for (const work of [...recentlyConsumedWorks, ...activeWorks]) {
    if (seen.has(work.id)) {
      continue;
    }

    seen.add(work.id);
    works.push(work);
  }

  return works.slice(0, 3);
}

function getStatusTone(status: string): 'success' | 'info' | 'warning' | 'error' | 'muted' | 'accent' {
  switch (status) {
    case 'completed': return 'success';
    case 'in_progress': return 'info';
    case 'dropped': return 'error';
    default: return 'muted';
  }
}

function ActivityTimelineItem({ work }: { work: WorkRecord }) {
  const navigate = useNavigate();
  return (
    <Box
      className={cn(css.activityItem)}
      component="button"
      onClick={() => navigate(`/works/${work.id}`)}
      type="button"
    >
      <Box className={cn(css.activityDot)} />
      <Stack className={cn(css.activityBody)} gap={2} miw={0}>
        <Group className={cn(css.activityHeader)} gap="xs" wrap="nowrap">
          <Text className={cn(css.activityTitle)} fw={600} size="sm" truncate>
            {work.title}
          </Text>
          <AppBadge tone={getStatusTone(work.status)}>
            {getWorkStatusLabel(work.status)}
          </AppBadge>
        </Group>
        {work.author && (
          <Text className={cn(css.activityMeta)} size="xs" truncate>
            {work.author}
          </Text>
        )}
      </Stack>
      {work.rating !== null && (
        <Text className={cn(css.activityRating)} fw={700} size="xs">
          ★ {work.rating.toFixed(1)}
        </Text>
      )}
    </Box>
  );
}

function HeroSummary({
  averageRating,
  inProgressCount,
  totalCount,
}: {
  averageRating: number | null;
  inProgressCount: number;
  totalCount: number;
}) {
  return (
    <SimpleGrid className={cn(css.heroStats)} cols={{ base: 1, sm: 3 }} spacing="sm">
      <HeroStat label="작품" value={`${totalCount}개`} />
      <HeroStat label="진행 중" value={`${inProgressCount}개`} />
      <HeroStat label="평균 별점" value={formatAverageRating(averageRating)} />
    </SimpleGrid>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <Paper className={cn(css.heroStat)} p="sm" radius="md" withBorder>
      <Text className={cn(css.heroStatLabel)} fw={700} size="xs">
        {label}
      </Text>
      <Text className={cn(css.heroStatValue)} fw={900}>
        {value}
      </Text>
    </Paper>
  );
}

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <Group className={cn(css.sectionHeader)} align="flex-start" justify="space-between" wrap="wrap" gap="sm">
      <Stack gap={4}>
        <Text className={cn(css.sectionEyebrow)} fw={700} size="xs" tt="uppercase">
          {eyebrow}
        </Text>
        <Title className={cn(css.sectionTitle)} order={2}>
          {title}
        </Title>
        <Text className={cn(css.sectionDescription)} size="sm">
          {description}
        </Text>
      </Stack>
      {action && <Box className={cn(css.sectionAction)}>{action}</Box>}
    </Group>
  );
}

function ContinueWorkCard({ work }: { work: WorkRecord }) {
  return (
    <Link
      aria-label={`${work.title} 이어서 열기`}
      className={cn(css.continueCard)}
      to={`/works/${work.id}`}
    >
      <Paper className={cn(css.continueCardSurface)} p="md" radius="md" withBorder>
        <Group align="flex-start" gap="md" wrap="nowrap">
          <WorkPoster
            className={cn(css.continuePoster)}
            coverSeed={work.id}
            thumbnailUrl={work.thumbnailUrl}
            title={work.title}
            typeLabel={getWorkTypeLabel(work.type)}
            variant="row"
          />
          <Stack flex={1} gap="xs" miw={0}>
            <Group gap="xs" justify="space-between" wrap="nowrap">
              <Text className={cn(css.continueMeta)} lineClamp={1} size="xs">
                {getWorkStatusLabel(work.status)}
              </Text>
              {work.rating !== null && (
                <Text className={cn(css.continueRating)} fw={800} size="xs">
                  ★ {work.rating.toFixed(1)}
                </Text>
              )}
            </Group>
            <Stack gap={3}>
              <Title className={cn(css.continueTitle)} lineClamp={2} order={3}>
                {work.title}
              </Title>
              <Text className={cn(css.continueMeta)} lineClamp={1} size="xs">
                {getWorkSupportLine(work)}
              </Text>
            </Stack>
            {work.shortReview.trim() && (
              <Text className={cn(css.continueReview)} lineClamp={2} size="sm">
                {work.shortReview.trim()}
              </Text>
            )}
            <Text className={cn(css.continueCue)} fw={700} size="sm">
              {getContinueLine(work)}
            </Text>
          </Stack>
        </Group>
      </Paper>
    </Link>
  );
}

function TodayPanel({
  backupReminder,
  continueWorks,
  jsonArchiveExport,
  totalCount,
  unratedCount,
}: {
  backupReminder: ReturnType<typeof useJsonBackupReminder>;
  continueWorks: WorkRecord[];
  jsonArchiveExport: ReturnType<typeof useJsonArchiveExport>;
  totalCount: number;
  unratedCount: number;
}) {
  if (totalCount === 0) {
    return null;
  }

  return (
    <Stack className={cn(css.todayPanel)} gap="lg">
      <SectionHeader
        action={
          unratedCount > 0 ? (
            <AppLinkButton to="/works?sort=rating&dir=asc" tone="secondary">
              평가 안 한 작품 {unratedCount}개
            </AppLinkButton>
          ) : undefined
        }
        description="최근 감상 위치와 진행 중인 기록을 먼저 모아 오늘 바로 이어갈 수 있게 했습니다."
        eyebrow="이어보기"
        title="이어볼 작품"
      />
      {continueWorks.length > 0 ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {continueWorks.map((work) => (
            <ContinueWorkCard key={work.id} work={work} />
          ))}
        </SimpleGrid>
      ) : (
        <Paper className={cn(css.todayEmpty)} p="md" radius="md" withBorder>
          <Group justify="space-between" wrap="wrap">
            <Stack gap={4}>
              <Text fw={800}>오늘 이어갈 작품을 고르세요</Text>
              <Text c="dimmed" size="sm">
                진행 상태나 최근 감상 위치가 남으면 이 선반에 먼저 올라옵니다.
              </Text>
            </Stack>
            <AppLinkButton to="/works" tone="secondary">
              작품 목록 열기
            </AppLinkButton>
          </Group>
        </Paper>
      )}
      <Box className={cn(css.todayBackupSlot)}>
        <JsonBackupReminderCard
          feedback={jsonArchiveExport.feedback}
          isExporting={jsonArchiveExport.isExporting}
          onExportJson={jsonArchiveExport.exportJson}
          reminder={backupReminder}
        />
      </Box>
    </Stack>
  );
}

interface InsightItem {
  description: string;
  label: string;
  to: string;
  value: string;
}

function buildInsightItems({
  contributorCollections,
  seriesCollections,
  topTags,
  typeCounts,
}: Pick<
  ReturnType<typeof useWorksOverview>,
  'contributorCollections' | 'seriesCollections' | 'topTags' | 'typeCounts'
>): InsightItem[] {
  const items: InsightItem[] = [];

  const topType = typeCounts[0];
  if (topType) {
    items.push({
      description: '가장 많이 쌓인 유형',
      label: getWorkTypeLabel(topType.value),
      to: `/works?type=${encodeURIComponent(topType.value)}`,
      value: `${topType.count}개`,
    });
  }

  for (const tag of topTags.slice(0, 2)) {
    items.push({
      description: '자주 붙인 태그',
      label: `#${tag.label}`,
      to: `/works?tag=${encodeURIComponent(tag.value)}`,
      value: `${tag.count}개`,
    });
  }

  const topSeries = seriesCollections[0];
  if (topSeries) {
    items.push({
      description: '가장 큰 시리즈 묶음',
      label: topSeries.label,
      to: topSeries.href,
      value: `${topSeries.totalCount}개`,
    });
  }

  const topContributor = contributorCollections[0];
  if (topContributor) {
    items.push({
      description: '자주 만나는 제작진',
      label: topContributor.label,
      to: topContributor.href,
      value: `${topContributor.totalCount}개`,
    });
  }

  return items.slice(0, 6);
}

function ArchiveInsights({ items }: { items: InsightItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Stack gap="lg">
      <SectionHeader
        description="자주 고른 매체와 태그만 작게 남깁니다."
        eyebrow="취향 단서"
        title="작은 취향 단서"
      />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
        {items.map((item) => (
          <Link className={cn(css.insightCard)} key={`${item.description}:${item.label}`} to={item.to}>
            <Paper className={cn(css.insightSurface)} p="md" radius="md" withBorder>
              <Stack gap={4}>
                <Text className={cn(css.insightDescription)} fw={700} size="xs">
                  {item.description}
                </Text>
                <Group justify="space-between" wrap="nowrap">
                  <Text className={cn(css.insightLabel)} fw={800} lineClamp={1}>
                    {item.label}
                  </Text>
                  <Text className={cn(css.insightCount)} fw={800} size="xs">
                    {item.value}
                  </Text>
                </Group>
              </Stack>
            </Paper>
          </Link>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

function EmptyArchiveGuide() {
  const actions = [
    {
      description: '제목 하나와 짧은 감상으로 첫 선반을 채웁니다.',
      label: '첫 작품 추가',
      to: '/works/new',
    },
    {
      description: '외부 검색 후보에서 표지와 기본 정보를 가져옵니다.',
      label: '검색으로 추가',
      to: '/works/new',
    },
    {
      description: '이전에 내보낸 JSON 기록을 다시 불러옵니다.',
      label: '백업 가져오기',
      to: '/account/settings#data-backup',
    },
  ];

  return (
    <Stack gap="lg">
      <SectionHeader
        description="새 작품을 직접 남기거나 검색으로 표지를 채우고, 기존 백업도 이어받을 수 있습니다."
        eyebrow="첫 선반"
        title="첫 작품을 놓는 방법"
      />
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        {actions.map((action) => (
          <Link className={cn(css.emptyActionCard)} key={action.label} to={action.to}>
            <Paper className={cn(css.emptyActionSurface)} p="lg" radius="md" withBorder>
              <Stack gap="xs">
                <Text fw={900}>{action.label}</Text>
                <Text c="dimmed" size="sm">
                  {action.description}
                </Text>
              </Stack>
            </Paper>
          </Link>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { archiveScopeKey, mode, user } = useAuthSession();
  const {
    averageRating,
    contributorCollections,
    error,
    highlyRatedWorks,
    inProgressCount,
    isLoading,
    recentlyConsumedWorks,
    recentWorks,
    retry,
    seriesCollections,
    topTags,
    totalCount,
    typeCounts,
    unratedCount,
  } = useWorksOverview();
  const [searchTerm, setSearchTerm] = useState('');
  const isAuthenticated = mode === 'authenticated';
  const jsonArchiveExport = useJsonArchiveExport();
  const backupReminder = useJsonBackupReminder(totalCount, archiveScopeKey);
  const activeWorks = recentWorks
    .filter((work) => work.status === 'in_progress')
    .slice(0, 8);
  const continueWorks = pickContinueWorks(recentlyConsumedWorks, activeWorks);
  const insightItems = buildInsightItems({
    contributorCollections,
    seriesCollections,
    topTags,
    typeCounts,
  });

  function handleSearchSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const normalizedSearchTerm = searchTerm.trim();
    navigate(
      normalizedSearchTerm
        ? `/works?q=${encodeURIComponent(normalizedSearchTerm)}`
        : '/works',
    );
  }

  return (
    <HomeHubPageTemplate>
      <Paper className={cn(css.homeHeader)} p="lg" radius="lg" withBorder>
        <Stack gap="md">
          <Group align="flex-start" justify="space-between" wrap="wrap">
            <Stack gap={4}>
              <Text className={cn(css.headerEyebrow)} fw={800} size="xs">
                오늘 펼쳐볼 감상 선반
              </Text>
              <Title order={1}>내 개인 서재</Title>
              <Text c="dimmed" size="sm">
                {isAuthenticated
                  ? `${user?.email ?? '내 계정'} · 이어볼 작품과 남겨둔 감상을 조용히 모았습니다.`
                  : '이 기기에 저장된 작품과 감상을 조용히 모았습니다.'}
              </Text>
            </Stack>
            <Group gap="xs" wrap="wrap">
              {continueWorks[0] && (
                <AppLinkButton to={`/works/${continueWorks[0].id}`} tone="primary">
                  이어보기
                </AppLinkButton>
              )}
              <AppLinkButton to="/works/new" tone="primary">
                작품 추가
              </AppLinkButton>
              <AppLinkButton to="/works" tone="secondary">
                작품 목록
              </AppLinkButton>
            </Group>
          </Group>
          <form onSubmit={handleSearchSubmit}>
            <Group align="center" gap="sm" wrap="wrap">
              <ArchiveSearchBar
                aria-label="아카이브 검색"
                onChange={setSearchTerm}
                onSubmit={() => handleSearchSubmit()}
                placeholder="작품, 작가를 검색"
                value={searchTerm}
              />
              <AppButton tone="primary" type="submit">
                검색
              </AppButton>
            </Group>
          </form>
          <HeroSummary
            averageRating={averageRating}
            inProgressCount={inProgressCount}
            totalCount={totalCount}
          />
        </Stack>
      </Paper>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <StateMessage
          actions={
            <>
              <AppButton onClick={retry} tone="primary" type="button">
                다시 불러오기
              </AppButton>
              <AppLinkButton to="/works" tone="secondary">
                작품 목록 열기
              </AppLinkButton>
              <AppLinkButton to="/works/new" tone="quiet">
                작품 추가
              </AppLinkButton>
            </>
          }
          description={error}
          title="최근 기록을 불러오지 못했습니다."
          tone="error"
        />
      )}

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {!error && isLoading && <LoadingRows rows={4} />}

      {/* ── Content ────────────────────────────────────────────────────── */}
      {!error && !isLoading && (
        <Stack gap={40}>
          <TodayPanel
            backupReminder={backupReminder}
            continueWorks={continueWorks}
            jsonArchiveExport={jsonArchiveExport}
            totalCount={totalCount}
            unratedCount={unratedCount}
          />

          {totalCount === 0 && <EmptyArchiveGuide />}

          {highlyRatedWorks.length > 0 && (
            <Stack gap="lg">
              <SectionHeader
                action={
                  <AppLinkButton to="/works?sort=rating&dir=desc" tone="quiet">
                    별점순 보기
                  </AppLinkButton>
                }
                description="높게 평가한 작품을 다시 꺼내기 쉽게 따로 모았습니다."
                eyebrow="추천 선반"
                title="높게 평가한 작품"
              />
              <WorkShelf works={highlyRatedWorks} />
            </Stack>
          )}

          {recentlyConsumedWorks.length > 0 && (
            <Stack gap="lg">
              <SectionHeader
                action={
                  <AppLinkButton to="/works" tone="quiet">
                    서재 전체
                  </AppLinkButton>
                }
                description="최근 감상 위치가 남은 작품을 다시 꺼내기 쉽게 모았습니다."
                eyebrow="최근 감상"
                title="최근 감상한 작품"
              />
              <WorkShelf
                empty={<ArchiveStarterShelf />}
                works={recentlyConsumedWorks.slice(0, 8)}
              />
            </Stack>
          )}

          <ArchiveInsights items={insightItems} />

          {recentWorks.length > 0 && (
            <Stack gap="lg">
              <SectionHeader
                description="최근 바뀐 기록 3개만 먼저 보여주고, 전체 변경 흐름은 아래에서 펼쳐봅니다."
                eyebrow="정리 기록"
                title="최근 정리한 감상"
              />
              <Paper className={cn(css.activityPreviewPanel)} p="md" radius="md" withBorder>
                <Stack gap={2}>
                  {recentWorks.slice(0, 3).map((work) => (
                    <ActivityTimelineItem key={work.id} work={work} />
                  ))}
                </Stack>
              </Paper>
            </Stack>
          )}

          {/* 활동 타임라인 */}
          {recentWorks.length > 0 && (
            <Accordion defaultValue={null} variant="separated">
              <Accordion.Item value="recent-changes">
                <Accordion.Control>최근 변경 기록</Accordion.Control>
                <Accordion.Panel>
                  <Paper
                    className={cn(css.activityPanel)}
                    p="md"
                    radius="md"
                    withBorder
                  >
                    <Stack gap={0}>
                      {groupWorksByDate(recentWorks.slice(0, 20)).map((group, groupIndex) => (
                        <Box key={group.label}>
                          {groupIndex > 0 && (
                            <Divider
                              color="var(--app-border-subtle)"
                              my="xs"
                            />
                          )}
                          <Group gap="sm" mb="xs" pl="xs">
                            <Box className={cn(css.timelineGroupDot)} />
                            <Text className={cn(css.timelineGroupLabel)} fw={700} size="xs" tt="uppercase">
                              {group.label}
                            </Text>
                          </Group>
                          <Stack gap={2}>
                            {group.works.map((work) => (
                              <ActivityTimelineItem key={work.id} work={work} />
                            ))}
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          )}
        </Stack>
      )}
    </HomeHubPageTemplate>
  );
}
