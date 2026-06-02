import {
  Box,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Link } from 'react-router-dom';
import type {
  WorkRecord,
  WorkStatus,
  WorkType,
} from '@work-archive/shared-types';

import {
  AppBadge,
  AppButton,
  AppLinkButton,
  LoadingState,
  PageHeader,
  PageSection,
  PageShell,
  StateMessage,
} from '@shared/components/AppPrimitives';
import { useAuthSession } from '@features/auth';
import { getWorkStatusLabel, getWorkTypeLabel } from '@features/works';
import { usePersonalInsights } from '../hooks/usePersonalInsights';
import type { PersonalInsights } from '../services/personal-insights.service';
import styles from './PersonalInsightsPage.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

function formatCount(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function formatAverageRating(value: number | null) {
  return value === null ? '미평가' : value.toFixed(1);
}

function formatPercent(count: number, total: number) {
  if (total === 0) {
    return '0%';
  }

  return `${Math.round((count / total) * 100)}%`;
}

function metricLabel(value: string, count: number) {
  return `${value} ${formatCount(count)}개`;
}

function buildTypeHref(type: WorkType) {
  return `/works?type=${encodeURIComponent(type)}`;
}

function buildStatusHref(status: WorkStatus) {
  return `/works?status=${encodeURIComponent(status)}`;
}

function buildRatingHref(rating: number) {
  return `/works?rating=${encodeURIComponent(String(rating))}`;
}

function buildTagHref(tag: string) {
  return `/works?tag=${encodeURIComponent(tag)}`;
}

function buildGenreHref(genre: string) {
  return `/works?genre=${encodeURIComponent(genre)}`;
}

function MetricCard({
  description,
  label,
  to,
  value,
}: {
  description: string;
  label: string;
  to?: string;
  value: string;
}) {
  const content = (
    <Stack className={cn(css.metricCard)} gap="sm" justify="space-between">
      <Stack gap={6}>
        <Text c="dimmed" fw={800} size="xs">
          {label}
        </Text>
        <Title className={cn(css.metricValue)} order={3}>
          {value}
        </Title>
      </Stack>
      <Text c="dimmed" size="sm">
        {description}
      </Text>
    </Stack>
  );

  if (to) {
    return (
      <Paper
        className={cn(css.chartPanel)}
        component={Link}
        p="lg"
        radius="md"
        style={{ color: 'inherit', textDecoration: 'none' }}
        to={to}
        withBorder
      >
        {content}
      </Paper>
    );
  }

  return (
    <Paper className={cn(css.chartPanel)} p="lg" radius="md" withBorder>
      {content}
    </Paper>
  );
}

function CountBarRow({
  count,
  label,
  max,
  to,
}: {
  count: number;
  label: string;
  max: number;
  to?: string;
}) {
  const percent = max > 0 ? (count / max) * 100 : 0;
  const content = (
    <Stack gap={6}>
      <Group justify="space-between" wrap="nowrap">
        <Text fw={700} size="sm">
          {label}
        </Text>
        <Text c="dimmed" fw={700} size="sm">
          {formatCount(count)}
        </Text>
      </Group>
      <Box aria-hidden="true" className={cn(css.barTrack)}>
        <Box className={cn(css.barFill)} style={{ width: `${percent}%` }} />
      </Box>
    </Stack>
  );

  return to ? (
    <Link
      aria-label={metricLabel(label, count)}
      className={cn(css.rowLink)}
      to={to}
    >
      {content}
    </Link>
  ) : (
    <Box aria-label={metricLabel(label, count)}>{content}</Box>
  );
}

function CountPanel({
  emptyLabel,
  items,
  title,
}: {
  emptyLabel: string;
  items: Array<{
    count: number;
    label: string;
    to?: string;
  }>;
  title: string;
}) {
  const visibleItems = items.filter((item) => item.count > 0);
  const max = Math.max(0, ...visibleItems.map((item) => item.count));

  return (
    <Paper className={cn(css.chartPanel)} p="lg" radius="md" withBorder>
      <Stack gap="md">
        <Title order={3}>{title}</Title>
        {visibleItems.length > 0 ? (
          <Stack gap="sm">
            {visibleItems.map((item) => (
              <CountBarRow
                count={item.count}
                key={item.label}
                label={item.label}
                max={max}
                {...(item.to ? { to: item.to } : {})}
              />
            ))}
          </Stack>
        ) : (
          <Text c="dimmed" size="sm">
            {emptyLabel}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function RecentWorksList({
  emptyLabel,
  title,
  works,
}: {
  emptyLabel: string;
  title: string;
  works: WorkRecord[];
}) {
  return (
    <Paper className={cn(css.chartPanel)} p="lg" radius="md" withBorder>
      <Stack gap="md">
        <Title order={3}>{title}</Title>
        {works.length > 0 ? (
          <Stack gap="sm">
            {works.map((work) => (
              <Link
                className={cn(css.workLink)}
                key={work.id}
                to={`/works/${work.id}`}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={2} miw={0}>
                    <Text fw={700} size="sm" truncate>
                      {work.title}
                    </Text>
                    <Text c="dimmed" size="xs" truncate>
                      {[work.author, getWorkTypeLabel(work.type)]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Stack>
                  <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
                </Group>
              </Link>
            ))}
          </Stack>
        ) : (
          <Text c="dimmed" size="sm">
            {emptyLabel}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function InsightsContent({ insights }: { insights: PersonalInsights }) {
  const typeItems = Object.entries(insights.typeCounts).map(
    ([type, count]) => ({
      count,
      label: getWorkTypeLabel(type as WorkType),
      to: buildTypeHref(type as WorkType),
    }),
  );
  const statusItems = Object.entries(insights.statusCounts).map(
    ([status, count]) => ({
      count,
      label: getWorkStatusLabel(status as WorkStatus),
      to: buildStatusHref(status as WorkStatus),
    }),
  );

  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <MetricCard
          description="현재 로컬 아카이브의 활성 작품입니다."
          label="총 작품"
          to="/works"
          value={formatCount(insights.totalWorks)}
        />
        <MetricCard
          description="별점을 남긴 작품만 평균에 포함합니다."
          label="평균 별점"
          value={formatAverageRating(insights.averageRating)}
        />
        <MetricCard
          description="완료일 기준, 오래된 기록은 수정일로 보정합니다."
          label="올해 완료"
          value={formatCount(insights.completedThisYearCount)}
        />
        <MetricCard
          description="즐겨찾기 필터로 바로 확인할 수 있습니다."
          label="즐겨찾기"
          to="/works?smart=favorites"
          value={formatCount(insights.favoriteCount)}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <MetricCard
          description="최근 30일 안에 추가한 작품입니다."
          label="최근 추가"
          value={formatCount(insights.addedRecentlyCount)}
        />
        <MetricCard
          description="최근 30일 안에 수정한 작품입니다."
          label="최근 수정"
          value={formatCount(insights.updatedRecentlyCount)}
        />
        <MetricCard
          description="한줄평과 긴 감상이 모두 비어 있는 작품입니다."
          label="감상 비어 있음"
          value={formatCount(insights.reviewEmptyCount)}
        />
        <MetricCard
          description="현재 상태 모델에는 별도 보류 상태가 없습니다."
          label="보류 상태"
          value={formatCount(insights.onHoldCount)}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <CountPanel
          emptyLabel="아직 매체별 통계를 만들 작품이 없습니다."
          items={typeItems}
          title="매체별 작품"
        />
        <CountPanel
          emptyLabel="아직 상태별 통계를 만들 작품이 없습니다."
          items={statusItems}
          title="상태별 작품"
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        <CountPanel
          emptyLabel="아직 별점을 남긴 작품이 없습니다."
          items={insights.ratingDistribution.map(({ count, rating }) => ({
            count,
            label: `★ ${rating.toFixed(1)}`,
            to: buildRatingHref(rating),
          }))}
          title="별점 분포"
        />
        <CountPanel
          emptyLabel="아직 개인 태그가 없습니다."
          items={insights.tagCounts.map(({ count, tag }) => ({
            count,
            label: tag,
            to: buildTagHref(tag),
          }))}
          title="상위 개인 태그"
        />
        <CountPanel
          emptyLabel="아직 장르가 없습니다."
          items={insights.genreCounts.map(({ count, genre }) => ({
            count,
            label: genre,
            to: buildGenreHref(genre),
          }))}
          title="상위 장르"
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <RecentWorksList
          emptyLabel="최근 30일 안에 추가된 작품이 없습니다."
          title="최근 추가한 작품"
          works={insights.recentlyAddedWorks}
        />
        <RecentWorksList
          emptyLabel="최근 30일 안에 수정된 작품이 없습니다."
          title="최근 수정한 작품"
          works={insights.recentlyUpdatedWorks}
        />
      </SimpleGrid>

      <Paper className={cn(css.chartPanel)} p="lg" radius="md" withBorder>
        <Group gap="sm" wrap="wrap">
          <AppBadge tone="muted">
            하차 {formatCount(insights.droppedCount)}개
          </AppBadge>
          <AppBadge tone="muted">
            볼 예정 {formatCount(insights.plannedCount)}개
          </AppBadge>
          <AppBadge tone="muted">
            감상 공백{' '}
            {formatPercent(insights.reviewEmptyCount, insights.totalWorks)}
          </AppBadge>
        </Group>
      </Paper>
    </>
  );
}

export function PersonalInsightsPage() {
  const { mode } = useAuthSession();
  const { error, insights, isLoading, retry } = usePersonalInsights();
  const archiveModeLabel =
    mode === 'authenticated' ? '인증된 로컬 아카이브' : '게스트 로컬 아카이브';

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState title="개인 인사이트를 계산하는 중입니다" />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <StateMessage
          actions={
            <AppButton onClick={retry} tone="primary" type="button">
              다시 계산
            </AppButton>
          }
          description={error}
          title="인사이트를 불러오지 못했습니다."
          tone="error"
        />
      </PageShell>
    );
  }

  if (!insights || insights.totalWorks === 0) {
    return (
      <PageShell>
        <StateMessage
          actions={
            <>
              <AppLinkButton to="/works/new" tone="primary">
                작품 추가
              </AppLinkButton>
              <AppLinkButton to="/works" tone="secondary">
                작품 목록
              </AppLinkButton>
            </>
          }
          description="작품을 추가하면 이 기기에 저장된 로컬 기록만 사용해 매체, 상태, 별점, 태그 요약을 계산합니다."
          eyebrow="Private Insights"
          title="아직 인사이트를 만들 기록이 없습니다."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        actions={
          <AppLinkButton to="/works" tone="secondary">
            작품 목록으로
          </AppLinkButton>
        }
        description="외부 provider를 호출하지 않고 현재 활성 IndexedDB 아카이브에서만 계산한 개인 통계입니다."
        eyebrow={archiveModeLabel}
        meta={<AppBadge tone="accent">Private local-first</AppBadge>}
        title="개인 인사이트"
        titleOrder={1}
      />

      <PageSection
        description="작품 수, 상태, 별점, 태그 흐름을 한 화면에서 확인합니다."
        divider={false}
        title="로컬 아카이브 요약"
      >
        <InsightsContent insights={insights} />
      </PageSection>
    </PageShell>
  );
}
