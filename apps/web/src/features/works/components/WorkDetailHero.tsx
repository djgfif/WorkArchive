import type { ReactNode } from 'react';
import { Box, Group, Stack, Text, Title } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';

import { ActionRow, SectionCard } from '@shared/components/AppPrimitives';
import { formatWorkDate, formatWorkUpdatedAt } from '../utils/work-options';
import { ProgressDisplay, WorkPoster } from './ArchiveComponents';
import { SerialStatusBadge } from './SerialStatusBadge';
import styles from './ArchiveComponents.module.css';
import type { WorkDetailTimelineItem } from '../utils/work-detail-timeline';
import { cn } from '@shared/utils/class-names';
import { useAppTranslation } from '@app/i18n';

const css = styles;

interface WorkDetailHeroProps {
  actions?: ReactNode;
  latestTimelineItem: WorkDetailTimelineItem | null;
  personalTags: string[];
  progressLabel: string | null;
  progressPercent: number | null;
  shortReview: string;
  statusLabel: string;
  typeLabel: string;
  work: WorkRecord;
}

export function WorkDetailHero({
  actions,
  latestTimelineItem,
  personalTags,
  progressLabel,
  progressPercent,
  shortReview,
  statusLabel,
  typeLabel,
  work,
}: WorkDetailHeroProps) {
  const { t } = useAppTranslation();

  return (
    <SectionCard
      className={cn(css.detailHero)}
      gap="xl"
      padding="xl"
      tone="hero"
    >
      <Group align="flex-start" gap="xl" wrap="wrap">
        <Box className={cn(css.detailHeroPoster)}>
          <WorkPoster
            thumbnailUrl={work.thumbnailUrl}
            title={work.title}
            typeLabel={typeLabel}
            variant="hero"
          />
        </Box>

        <Stack className={cn(css.detailHeroBody)} flex={1} gap="md" miw={0}>
          <Group className={cn(css.detailHeroMeta)} gap="xs" wrap="wrap">
            <Text fw={800} size="sm">
              {typeLabel}
            </Text>
            <Box
              aria-hidden="true"
              className={cn(css.detailHeroMetaDivider)}
              component="span"
            />
            <Text fw={800} size="sm">
              {statusLabel}
            </Text>
            {work.serialStatus && (
              <>
                <Box
                  aria-hidden="true"
                  className={cn(css.detailHeroMetaDivider)}
                  component="span"
                />
                <SerialStatusBadge serialStatus={work.serialStatus} />
              </>
            )}
            {work.favorite && (
              <>
                <Box
                  aria-hidden="true"
                  className={cn(css.detailHeroMetaDivider)}
                  component="span"
                />
                <Text c="var(--app-accent-warm)" fw={800} size="sm">
                  {t('works.detail.favoriteBadge')}
                </Text>
              </>
            )}
          </Group>

          <Stack gap={4}>
            <Title className={cn(css.detailTitle)} order={1}>
              {work.title}
            </Title>
            <Text c="dimmed" size="sm">
              {work.author || t('works.detail.authorMissing')}
              {' · '}
              <Text c="dimmed" component="span" size="xs">
                {t('works.detail.recentUpdated', {
                  date: formatWorkUpdatedAt(work.updatedAt),
                })}
              </Text>
            </Text>
          </Stack>

          <Text className={cn(css.detailHeroShortReview)} lh={1.65}>
            {shortReview
              ? t('works.detail.shortReviewQuoted', { review: shortReview })
              : t('works.detail.heroShortReviewEmpty')}
          </Text>

          <Group align="flex-end" gap="xl" wrap="wrap">
            {work.rating !== null ? (
              <Stack gap={2}>
                <Text className={cn(css.detailMetaLabel)} c="dimmed" size="xs">
                  {t('works.detail.rating')}
                </Text>
                <Group align="baseline" gap={4}>
                  <Text
                    className={cn(css.detailHeroRatingValue)}
                    component="span"
                  >
                    {work.rating.toFixed(1)}
                  </Text>
                  <Text
                    className={cn(css.detailHeroRatingMax)}
                    component="span"
                  >
                    / 5.0
                  </Text>
                  <Text className={cn(css.detailStars)} component="span">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const filled =
                        work.rating !== null && work.rating >= star;
                      const half =
                        work.rating !== null &&
                        work.rating >= star - 0.5 &&
                        work.rating < star;

                      return (
                        <span
                          className={cn(css.detailStar)}
                          data-active={filled || half ? 'true' : 'false'}
                          data-half={half ? 'true' : 'false'}
                          key={star}
                        >
                          {filled || half ? '★' : '☆'}
                        </span>
                      );
                    })}
                  </Text>
                </Group>
              </Stack>
            ) : (
              <Stack gap={2}>
                <Text className={cn(css.detailMetaLabel)} c="dimmed" size="xs">
                  {t('works.detail.rating')}
                </Text>
                <Text c="dimmed" size="sm">
                  {t('works.detail.ratingMissing')}
                </Text>
              </Stack>
            )}
            {progressLabel && (
              <Stack gap={2}>
                <Text className={cn(css.detailMetaLabel)} c="dimmed" size="xs">
                  {t('works.detail.progress')}
                </Text>
                <Text className={cn(css.numericText)} fw={700} size="lg">
                  {progressLabel}
                </Text>
              </Stack>
            )}
          </Group>

          {progressPercent !== null && <ProgressDisplay work={work} />}

          {actions && <ActionRow>{actions}</ActionRow>}
        </Stack>

        <Box className={cn(css.detailSummary)}>
          <Stack gap="lg">
            <Stack gap={6}>
              <Text c="dimmed" fw={700} size="xs">
                {t('works.detail.personalTags')}
              </Text>
              <Text fw={800} lh={1.5}>
                {personalTags.length > 0
                  ? personalTags.map((tag) => `#${tag}`).join(' ')
                  : t('works.detail.personalTagsHeroEmpty')}
              </Text>
            </Stack>

            <Stack gap={6}>
              <Text c="dimmed" fw={700} size="xs">
                {t('works.detail.latestRecord')}
              </Text>
              <Text fw={800} lh={1.5}>
                {latestTimelineItem
                  ? `${formatWorkDate(latestTimelineItem.value)} · ${latestTimelineItem.label}`
                  : t('works.detail.timelineHeroEmpty')}
              </Text>
            </Stack>
          </Stack>
        </Box>
      </Group>
    </SectionCard>
  );
}
