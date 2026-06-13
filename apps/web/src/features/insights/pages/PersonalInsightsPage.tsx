import {
  Box,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { WorkRecord, WorkStatus } from '@work-archive/shared-types';

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
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { appI18n, formatAppNumber, useAppTranslation } from '@app/i18n';
import { useAuthSession } from '@features/auth';
import { getWorkStatusLabel, getWorkTypeLabel } from '@features/works';
import { usePersonalInsights } from '../hooks/usePersonalInsights';
import type { PersonalInsights } from '../services/personal-insights.service';
import styles from './PersonalInsightsPage.module.css';
import { MediaTypePanel, RatingHistogramPanel } from './InsightsCharts';
import { YearInReviewModal } from './YearInReviewModal';
import { cn } from '@shared/utils/class-names';

const css = styles;

function formatCount(value: number) {
  return formatAppNumber(value);
}

function formatAverageRating(value: number | null) {
  return value === null
    ? appI18n.t('insights.noAverageRating')
    : value.toFixed(1);
}

function formatPercent(count: number, total: number) {
  if (total === 0) {
    return '0%';
  }

  return `${Math.round((count / total) * 100)}%`;
}

function metricLabel(value: string, count: number) {
  return appI18n.t('insights.countLabel', {
    count: formatCount(count),
    value,
  });
}

function buildStatusHref(status: WorkStatus) {
  return `/works?status=${encodeURIComponent(status)}`;
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
  const { t } = useAppTranslation();
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
          description={t('insights.totalWorksDescription')}
          label={t('insights.totalWorksLabel')}
          to="/works"
          value={formatCount(insights.totalWorks)}
        />
        <MetricCard
          description={t('insights.averageRatingDescription')}
          label={t('insights.averageRatingLabel')}
          value={formatAverageRating(insights.averageRating)}
        />
        <MetricCard
          description={t('insights.completedThisYearDescription')}
          label={t('insights.completedThisYearLabel')}
          value={formatCount(insights.completedThisYearCount)}
        />
        <MetricCard
          description={t('insights.favoriteDescription')}
          label={t('insights.favoriteLabel')}
          to="/works?smart=favorites"
          value={formatCount(insights.favoriteCount)}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <MetricCard
          description={t('insights.addedRecentlyDescription')}
          label={t('insights.addedRecentlyLabel')}
          value={formatCount(insights.addedRecentlyCount)}
        />
        <MetricCard
          description={t('insights.updatedRecentlyDescription')}
          label={t('insights.updatedRecentlyLabel')}
          value={formatCount(insights.updatedRecentlyCount)}
        />
        <MetricCard
          description={t('insights.ratingEmptyDescription')}
          label={t('insights.ratingEmptyLabel')}
          value={formatCount(insights.reviewEmptyCount)}
        />
        <MetricCard
          description={t('insights.statusOnHoldDescription')}
          label={t('insights.statusOnHoldLabel')}
          to="/works?status=on_hold"
          value={formatCount(insights.onHoldCount)}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <MediaTypePanel
          total={insights.totalWorks}
          typeCounts={insights.typeCounts}
        />
        <CountPanel
          emptyLabel={t('insights.statusEmpty')}
          items={statusItems}
          title={t('insights.statusTitle')}
        />
      </SimpleGrid>

      <RatingHistogramPanel distribution={insights.ratingDistribution} />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <CountPanel
          emptyLabel={t('insights.tagsEmpty')}
          items={insights.tagCounts.map(({ count, tag }) => ({
            count,
            label: tag,
            to: buildTagHref(tag),
          }))}
          title={t('insights.tagsTitle')}
        />
        <CountPanel
          emptyLabel={t('insights.topGenresEmpty')}
          items={insights.genreCounts.map(({ count, genre }) => ({
            count,
            label: genre,
            to: buildGenreHref(genre),
          }))}
          title={t('insights.topGenresTitle')}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <RecentWorksList
          emptyLabel={t('insights.recentAddedEmpty')}
          title={t('insights.recentAddedTitle')}
          works={insights.recentlyAddedWorks}
        />
        <RecentWorksList
          emptyLabel={t('insights.recentUpdatedEmpty')}
          title={t('insights.recentUpdatedTitle')}
          works={insights.recentlyUpdatedWorks}
        />
      </SimpleGrid>

      <Paper className={cn(css.chartPanel)} p="lg" radius="md" withBorder>
        <Group gap="sm" wrap="wrap">
          <AppBadge tone="muted">
            {t('insights.droppedBadge', {
              count: formatCount(insights.droppedCount),
            })}
          </AppBadge>
          <AppBadge tone="muted">
            {t('insights.statusPlannedBadge', {
              count: formatCount(insights.plannedCount),
            })}
          </AppBadge>
          <AppBadge tone="muted">
            {t('insights.gapBadge', {
              percent: formatPercent(
                insights.reviewEmptyCount,
                insights.totalWorks,
              ),
            })}
          </AppBadge>
        </Group>
      </Paper>
    </>
  );
}

export function PersonalInsightsPage() {
  const { t } = useAppTranslation();
  usePageTitle(t('insights.pageTitle'));
  const { mode } = useAuthSession();
  const { error, insights, isLoading, retry } = usePersonalInsights();
  const [yearOpen, setYearOpen] = useState(false);
  const archiveModeLabel =
    mode === 'authenticated'
      ? t('insights.archiveModeAuthenticated')
      : t('insights.archiveModeGuest');

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState title={t('insights.loadingTitle')} />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <StateMessage
          actions={
            <AppButton onClick={retry} tone="primary" type="button">
              {t('insights.retry')}
            </AppButton>
          }
          description={error}
          title={t('insights.loadErrorTitle')}
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
                {t('insights.addWork')}
              </AppLinkButton>
              <AppLinkButton to="/works" tone="secondary">
                {t('insights.viewWorks')}
              </AppLinkButton>
            </>
          }
          description={t('insights.emptyDescription')}
          eyebrow="Private Insights"
          title={t('insights.emptyTitle')}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        actions={
          <>
            <AppButton
              onClick={() => setYearOpen(true)}
              tone="primary"
              type="button"
            >
              {t('insights.yearInReview')}
            </AppButton>
            <AppLinkButton to="/works" tone="secondary">
              {t('insights.viewWorksBack')}
            </AppLinkButton>
          </>
        }
        description={t('insights.pageDescription')}
        eyebrow={archiveModeLabel}
        meta={<AppBadge tone="accent">{t('insights.metaLocalOnly')}</AppBadge>}
        title={t('insights.pageTitle')}
        titleOrder={1}
      />

      <YearInReviewModal
        onClose={() => setYearOpen(false)}
        opened={yearOpen}
      />

      <PageSection
        description={t('insights.summaryDescription')}
        divider={false}
        title={t('insights.summaryTitle')}
      >
        <InsightsContent insights={insights} />
      </PageSection>
    </PageShell>
  );
}
