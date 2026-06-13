import { Group, Progress, SimpleGrid, Stack, Text } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  AppBadge,
  AppButton,
  AppLinkButton,
  KeyValueGrid,
  LoadingRows,
  MetricPill,
  SectionCard,
  SectionIntro,
  StateMessage,
  SurfaceLinkCard,
} from '@shared/components/AppPrimitives';
import { PageHero } from '@shared/components/PageHero';
import { DetailPageTemplate } from '@shared/components/PageTemplates';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { formatAppNumber, useAppTranslation } from '@app/i18n';
import { useAuthSession } from '@features/auth';
import { useWorksOverview } from '@features/works';
import {
  formatWorkDateTime,
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '@features/works';

type TranslationFn = ReturnType<typeof useAppTranslation>['t'];

function formatAverageRating(
  value: number | null,
  t: TranslationFn,
) {
  return value === null
    ? t('profile.noRating')
    : t('profile.ratingValue', { value: value.toFixed(1) });
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatConsumedSummary(
  work: WorkRecord,
  t: TranslationFn,
) {
  if (work.lastConsumedLabel) return work.lastConsumedLabel;
  if (work.lastConsumedAt) {
    return t('profile.lastConsumedAt', {
      date: formatWorkDateTime(work.lastConsumedAt),
    });
  }
  return t('profile.recentUpdatedAt', {
    date: formatWorkUpdatedAt(work.updatedAt),
  });
}

function RecentRecordLink({ accent = false, work }: { accent?: boolean; work: WorkRecord }) {
  const { t } = useAppTranslation();

  return (
    <SurfaceLinkCard padding="md" to={`/works/${work.id}`} tone={accent ? 'hero' : 'subtle'}>
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <Stack gap={2} miw={0}>
          <Text fw={700} lineClamp={1}>
            {work.title}
          </Text>
          <Text c="var(--mantine-color-dimmed)" lineClamp={1} size="sm">
            {work.author || t('profile.authorMissing')}
          </Text>
        </Stack>
        <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
      </Group>
      <Group gap="xs" wrap="wrap">
        <AppBadge tone="muted">{getWorkTypeLabel(work.type)}</AppBadge>
        <AppBadge tone="muted">
          {work.rating === null
            ? t('profile.noRating')
            : t('profile.ratingValue', { value: work.rating.toFixed(1) })}
        </AppBadge>
        <AppBadge tone="muted">
          {t('profile.recentUpdatedAt', {
            date: formatWorkUpdatedAt(work.updatedAt),
          })}
        </AppBadge>
      </Group>
    </SurfaceLinkCard>
  );
}

export function ProfilePage() {
  const { t } = useAppTranslation();
  usePageTitle(t('profile.pageTitle'));
  const { mode } = useAuthSession();
  const {
    averageRating,
    completedCount,
    contributorCollections,
    error,
    highlyRatedWorks,
    isLoading,
    inProgressCount,
    recentlyConsumedWorks,
    recentWorks,
    retry,
    seriesCollections,
    statusCounts,
    topTags,
    totalCount,
    typeCounts,
    unratedCount,
  } = useWorksOverview();
  const isAuthenticated = mode === 'authenticated';
  const leadRecentWork = recentWorks[0] ?? null;
  const hasRecentWorks = recentWorks.length > 0;
  const favoriteType = typeCounts[0] ?? null;
  const completedRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const inProgressRate = totalCount > 0 ? (inProgressCount / totalCount) * 100 : 0;
  const topRatedWork = highlyRatedWorks[0] ?? null;
  const flowWorks =
    recentlyConsumedWorks.length > 0 ? recentlyConsumedWorks : recentWorks.slice(0, 3);
  const clusterItems = [
    ...topTags.map((tag) => ({
      href: `/works?tag=${encodeURIComponent(tag.label)}`,
      label: tag.label,
      meta: t('profile.recordCount', { count: formatAppNumber(tag.count) }),
    })),
    ...seriesCollections.slice(0, 2).map((collection) => ({
      href: collection.href,
      label: collection.label,
      meta: t('profile.seriesCount', {
        count: formatAppNumber(collection.totalCount),
      }),
    })),
    ...contributorCollections.slice(0, 2).map((collection) => ({
      href: collection.href,
      label: collection.label,
      meta: t('profile.recordCount', {
        count: formatAppNumber(collection.totalCount),
      }),
    })),
  ].slice(0, 6);

  return (
    <DetailPageTemplate>
      <PageHero
        actions={
          <>
            {leadRecentWork && (
              <AppLinkButton to={`/works/${leadRecentWork.id}`} tone="primary">
                {t('profile.actionResume')}
              </AppLinkButton>
            )}
            <AppLinkButton to="/account">
              {t('profile.actionAccountCenter')}
            </AppLinkButton>
            <AppLinkButton to="/works">
              {t('profile.actionViewWorks')}
            </AppLinkButton>
          </>
        }
        description={
          isAuthenticated
            ? t('profile.heroDescriptionAuthenticated')
            : t('profile.heroDescriptionGuest')
        }
        eyebrow={t('profile.heroEyebrow')}
        meta={
          <>
            <MetricPill label={t('profile.metricTotal')} value={totalCount} />
            <MetricPill
              label={t('profile.metricAverageRating')}
              value={formatAverageRating(averageRating, t)}
            />
            <MetricPill
              label={t('profile.metricCompleted')}
              value={completedCount}
            />
            <MetricPill
              label={t('profile.metricInProgress')}
              value={inProgressCount}
            />
          </>
        }
        title={
          isAuthenticated
            ? t('profile.titleAuthenticated')
            : t('profile.titleGuest')
        }
      />

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <SectionCard tone="hero">
          <SectionIntro
            description={
              favoriteType
                ? t('profile.tasteDescription', {
                    count: formatAppNumber(unratedCount),
                    type: getWorkTypeLabel(favoriteType.value),
                  })
                : t('profile.tasteEmptyDescription')
            }
            eyebrow={t('profile.tasteEyebrow')}
            title={t('profile.tasteTitle')}
          />

          <KeyValueGrid
            columns={2}
            items={[
              {
                label: t('profile.metricAverageRating'),
                value: formatAverageRating(averageRating, t),
              },
              {
                label: t('profile.favoriteType'),
                value: favoriteType
                  ? t('profile.typeCount', {
                      count: formatAppNumber(favoriteType.count),
                      type: getWorkTypeLabel(favoriteType.value),
                    })
                  : t('profile.noneYet'),
              },
              {
                label: t('profile.highRating'),
                value: topRatedWork
                  ? t('profile.topRatedWork', {
                      rating: t('profile.ratingValue', {
                        value: topRatedWork.rating?.toFixed(1),
                      }),
                      title: topRatedWork.title,
                    })
                  : t('profile.noneYet'),
              },
              {
                label: t('profile.noRating'),
                value: t('profile.workCount', {
                  count: formatAppNumber(unratedCount),
                }),
              },
            ]}
          />
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description={t('profile.flowDescription')}
            eyebrow={t('profile.flowEyebrow')}
            title={t('profile.flowTitle')}
          />

          {flowWorks.length > 0 ? (
            <Stack gap="sm">
              {flowWorks.map((work, index) => (
                <RecentRecordLink accent={index === 0} key={work.id} work={work} />
              ))}
            </Stack>
          ) : (
            <Text c="var(--mantine-color-dimmed)">
              {t('profile.flowEmpty')}
            </Text>
          )}
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description={t('profile.statusDescription', {
              completedRate: formatPercent(completedRate),
              inProgressRate: formatPercent(inProgressRate),
            })}
            eyebrow={t('profile.statusEyebrow')}
            title={t('profile.statusTitle')}
          />

          <Stack gap="sm">
            <Progress.Root size="lg">
              <Progress.Section color="teal" value={completedRate} />
              <Progress.Section color="archive" value={inProgressRate} />
            </Progress.Root>
            <KeyValueGrid
              columns={2}
              items={[
                { label: getWorkStatusLabel('planned'), value: statusCounts.planned },
                { label: getWorkStatusLabel('in_progress'), value: statusCounts.in_progress },
                { label: getWorkStatusLabel('completed'), value: statusCounts.completed },
                { label: getWorkStatusLabel('dropped'), value: statusCounts.dropped },
              ]}
            />
          </Stack>
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description={t('profile.clusterDescription')}
            eyebrow={t('profile.clusterEyebrow')}
            title={t('profile.clusterTitle')}
          />

          {clusterItems.length > 0 ? (
            <Group gap="xs" wrap="wrap">
              {clusterItems.map((item) => (
                <AppLinkButton
                  key={`${item.href}:${item.label}`}
                  size="compact-xs"
                  to={item.href}
                  tone="quiet"
                >
                  {item.label} · {item.meta}
                </AppLinkButton>
              ))}
            </Group>
          ) : (
            <Text c="var(--mantine-color-dimmed)">
              {t('profile.clusterEmpty')}
            </Text>
          )}
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description={t('profile.nextDescription')}
            eyebrow={t('profile.nextEyebrow')}
            title={t('profile.nextTitle')}
          />

          {error && (
            <StateMessage
              actions={
                <>
                  <AppButton onClick={retry} tone="primary" type="button">
                    {t('profile.retry')}
                  </AppButton>
                  <AppLinkButton to="/works" tone="secondary">
                    {t('profile.openWorks')}
                  </AppLinkButton>
                  <AppLinkButton
                    aria-label={t('profile.addWorkFromErrorAria')}
                    to="/works/new"
                    tone="quiet"
                  >
                    {t('profile.addWork')}
                  </AppLinkButton>
                </>
              }
              description={error}
              title={t('profile.loadError')}
              tone="error"
            />
          )}

          {!error && isLoading && <LoadingRows rows={2} />}

          {!error && !isLoading && !hasRecentWorks && (
            <Stack gap="sm">
              <AppBadge tone="accent">{t('profile.firstRecordPending')}</AppBadge>
              <Text c="var(--mantine-color-dimmed)">
                {t('profile.firstRecordDescription')}
              </Text>
            </Stack>
          )}

          {!error && !isLoading && hasRecentWorks && (
            <Stack gap="sm">
              {recentWorks.slice(0, 3).map((work, index) => (
                <SurfaceLinkCard
                  key={work.id}
                  padding="md"
                  to={`/works/${work.id}`}
                  tone={index === 0 ? 'hero' : 'subtle'}
                >
                  <Group align="flex-start" justify="space-between" wrap="nowrap">
                    <Stack gap={2} miw={0}>
                      <Text fw={700} lineClamp={1}>
                        {work.title}
                      </Text>
                      <Text c="var(--mantine-color-dimmed)" lineClamp={1} size="sm">
                        {formatConsumedSummary(work, t)}
                      </Text>
                    </Stack>
                    <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
                  </Group>
                </SurfaceLinkCard>
              ))}
            </Stack>
          )}

          <Group gap="sm" wrap="wrap">
            <AppLinkButton to="/works/new">{t('profile.addWork')}</AppLinkButton>
            <AppLinkButton to="/works">{t('profile.actionViewWorks')}</AppLinkButton>
            <AppLinkButton to="/account" tone="quiet">
              {t('profile.actionAccountCenter')}
            </AppLinkButton>
          </Group>
        </SectionCard>
      </SimpleGrid>
    </DetailPageTemplate>
  );
}
