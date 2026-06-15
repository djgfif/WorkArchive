import { Box, Group, Paper, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import type { WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import { appI18n, useAppTranslation } from '@app/i18n';
import { AppBadge, AppLinkButton } from '@shared/components/AppPrimitives';
import {
  formatWorkDate,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../../utils/work-options';
import { getPersonalTags } from '../../utils/graph-tags';
import { ProgressDisplay } from './ProgressWidgets';
import { RatingDisplay } from './RatingControls';
import { cn, css } from './styles';
import { WorkPoster } from './WorkPoster';
import { SerialStatusBadge } from '../SerialStatusBadge';

interface WorkPosterCardProps {
  isUpdating?: boolean;
  work: WorkRecord;
}

interface WorkRowCardProps {
  isUpdating?: boolean;
  work: WorkRecord;
}

interface WorkShelfProps {
  empty?: ReactNode;
  title?: ReactNode;
  works: WorkRecord[];
}

type AppBadgeToneValue =
  | 'accent'
  | 'danger'
  | 'default'
  | 'error'
  | 'info'
  | 'muted'
  | 'success'
  | 'warning';

function getPrimaryMetaLine(work: WorkRecord) {
  const ratingLabel =
    work.rating === null
      ? appI18n.t('works.ratingMissing')
      : `★ ${work.rating.toFixed(1)}`;

  return [ratingLabel, getWorkStatusLabel(work.status)]
    .filter(Boolean)
    .join(' · ');
}

function needsPosterCuration(work: WorkRecord) {
  return (
    work.rating === null ||
    work.shortReview.trim() === '' ||
    work.genres.length === 0 ||
    work.thumbnailUrl.trim() === '' ||
    getPersonalTags(work.personalTags).length === 0
  );
}

function getStatusBadgeTone(status: string): AppBadgeToneValue {
  switch (status) {
    case 'in_progress':
      return 'info';
    case 'on_hold':
      return 'warning';
    case 'completed':
      return 'success';
    case 'planned':
      return 'muted';
    case 'dropped':
      return 'danger';
    default:
      return 'default';
  }
}

export function WorkPosterCard({
  isUpdating = false,
  work,
}: WorkPosterCardProps) {
  const { t } = useAppTranslation();
  const typeLabel = getWorkTypeLabel(work.type);
  const needsCuration = needsPosterCuration(work);

  return (
    <Link
      aria-label={t('works.list.trashDetailAria', { title: work.title })}
      className={cn(css.posterCardLink)}
      to={`/works/${work.id}`}
    >
      <Paper className={cn(css.posterCardSurface)} withBorder>
        {work.favorite && (
          <Box
            aria-hidden="true"
            className={cn(css.favoriteMark)}
            component="span"
            title={t('works.list.favorite')}
          >
            ★
          </Box>
        )}
        {/* 표지 폴백 제목은 끈다 — 아래 캡션 제목이 단일 출처. */}
        <WorkPoster
          coverSeed={work.id}
          showFallbackTitle={false}
          thumbnailUrl={work.thumbnailUrl}
          title={work.title}
          typeLabel={typeLabel}
          variant="grid"
        />
        {needsCuration && (
          <Box
            aria-hidden="true"
            className={cn(css.posterCurationMarker)}
            title={t('works.list.needsCuration')}
          />
        )}
        <Stack className={cn(css.posterCardBody)} gap={3}>
          <Title
            className={cn(css.posterCardTitle)}
            lineClamp={2}
            order={3}
            size="h4"
          >
            {work.title}
          </Title>
          {work.author.trim() && (
            <Text className={cn(css.posterAuthorLine)} lineClamp={1} size="sm">
              {work.author.trim()}
            </Text>
          )}
          {work.serialStatus && (
            <Group gap={6}>
              <SerialStatusBadge serialStatus={work.serialStatus} />
            </Group>
          )}
          {(work.rating !== null || work.status !== 'planned') && (
            <Text
              c="dimmed"
              className={cn(css.posterMetaLine)}
              lineClamp={1}
              size="sm"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {getPrimaryMetaLine(work)}
            </Text>
          )}
          {isUpdating && (
            <Text c="var(--app-accent-primary)" fw={800} size="xs">
              {t('works.list.saving')}
            </Text>
          )}
        </Stack>
      </Paper>
    </Link>
  );
}

export function WorkRowCard({ isUpdating = false, work }: WorkRowCardProps) {
  const { t } = useAppTranslation();
  const typeLabel = getWorkTypeLabel(work.type);

  return (
    <Link className={cn(css.rowCard)} to={`/works/${work.id}`}>
      <Paper className={cn(css.rowSurface)} withBorder>
        <Group align="center" gap="md" wrap="nowrap">
          <WorkPoster
            coverSeed={work.id}
            showFallbackTitle={false}
            thumbnailUrl={work.thumbnailUrl}
            title={work.title}
            typeLabel={typeLabel}
            variant="row"
          />
          <Stack flex={1} gap={6} miw={0}>
            <Group gap={6} wrap="nowrap">
              <AppBadge tone="muted">{typeLabel}</AppBadge>
              <AppBadge tone={getStatusBadgeTone(work.status)}>
                {getWorkStatusLabel(work.status)}
              </AppBadge>
              <SerialStatusBadge serialStatus={work.serialStatus} />
              {isUpdating && (
                <AppBadge tone="accent">{t('works.list.saving')}</AppBadge>
              )}
            </Group>
            <Title lineClamp={1} order={3} size="h4">
              {work.title}
            </Title>
            <Group align="center" gap="md" wrap="nowrap">
              <Box flex={1} miw={0}>
                <ProgressDisplay work={work} />
              </Box>
              <RatingDisplay compact value={work.rating} />
            </Group>
          </Stack>
        </Group>
      </Paper>
    </Link>
  );
}

export function WorkShelf({ empty, title, works }: WorkShelfProps) {
  if (works.length === 0) {
    return empty ?? null;
  }

  return (
    <Stack gap="md">
      {title}
      <Box className={cn(css.shelf)}>
        {works.map((work) => (
          <WorkPosterCard key={work.id} work={work} />
        ))}
      </Box>
    </Stack>
  );
}

export function ArchiveStarterShelf() {
  const { t } = useAppTranslation();
  const starterCovers = [
    {
      title: t('works.list.starterCoverFirst'),
      typeLabel: getWorkTypeLabel('novel'),
    },
    {
      title: t('works.list.starterCoverContinue'),
      typeLabel: getWorkTypeLabel('anime'),
    },
    {
      title: t('works.list.starterCoverScene'),
      typeLabel: getWorkTypeLabel('movie'),
    },
    {
      title: t('works.list.starterCoverReview'),
      typeLabel: getWorkTypeLabel('manga'),
    },
  ];

  return (
    <Stack className={cn(css.starterShelf)} gap="md">
      <Group justify="space-between" wrap="wrap">
        <Stack gap={4}>
          <Text
            c="var(--app-accent-primary)"
            fw={800}
            size="xs"
            tt="uppercase"
            style={{ letterSpacing: '0.06em' }}
          >
            {t('works.list.starterEyebrow')}
          </Text>
          <Title order={2}>{t('works.list.starterTitle')}</Title>
          <Text c="dimmed" size="sm">
            {t('works.list.starterDescription')}
          </Text>
        </Stack>
        <AppLinkButton to="/works/new" tone="primary">
          {t('works.list.starterAction')}
        </AppLinkButton>
      </Group>
      <Box aria-hidden="true" className={cn(css.starterCovers)}>
        {starterCovers.map((cover, index) => (
          <WorkPoster
            coverSeed={`starter:${index}`}
            key={cover.title}
            title={cover.title}
            typeLabel={cover.typeLabel}
            variant="grid"
          />
        ))}
      </Box>
    </Stack>
  );
}

export function WorkUpdatedMeta({ work }: { work: WorkRecord }) {
  const { t } = useAppTranslation();

  return (
    <Text c="dimmed" lineClamp={1} size="sm">
      {t('works.list.updatedMeta', {
        date: formatWorkDate(work.lastConsumedAt),
      })}
    </Text>
  );
}
