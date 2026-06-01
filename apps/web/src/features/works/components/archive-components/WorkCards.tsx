import { Box, Group, Paper, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import type { WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import {
  AppBadge,
  AppLinkButton,
} from '@shared/components/AppPrimitives';
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
    work.rating === null ? '미평가' : `★ ${work.rating.toFixed(1)}`;

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
  const typeLabel = getWorkTypeLabel(work.type);
  const needsCuration = needsPosterCuration(work);

  return (
    <Link
      aria-label={`${work.title} 상세 보기`}
      className={cn(css.posterCardLink)}
      to={`/works/${work.id}`}
    >
      <Paper className={cn(css.posterCardSurface)} withBorder>
        {work.favorite && (
          <Box
            aria-hidden="true"
            className={cn(css.favoriteMark)}
            component="span"
            title="즐겨찾기"
          >
            ★
          </Box>
        )}
        <WorkPoster
          coverSeed={work.id}
          thumbnailUrl={work.thumbnailUrl}
          title={work.title}
          typeLabel={typeLabel}
          variant="grid"
        />
        <div aria-hidden="true" className={cn(css.posterCardOverlay)}>
          <p className={cn(css.posterCardOverlayTitle)}>{work.title}</p>
          <div className={cn(css.posterCardOverlayMeta)}>
            <span className={cn(css.posterCardOverlayStatus)}>
              {getWorkStatusLabel(work.status)}
            </span>
            {work.rating !== null && (
              <span className={cn(css.posterCardOverlayRating)}>
                ★ {work.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        {needsCuration && (
          <Box
            aria-hidden="true"
            className={cn(css.posterCurationMarker)}
            title="정리 필요"
          />
        )}
        <Stack className={cn(css.posterCardBody)} gap={3}>
          <Title className={cn(css.posterCardTitle)} lineClamp={2} order={3} size="h4">
            {work.title}
          </Title>
          {work.author.trim() && (
            <Text className={cn(css.posterAuthorLine)} lineClamp={1} size="sm">
              {work.author.trim()}
            </Text>
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
              저장 중
            </Text>
          )}
        </Stack>
      </Paper>
    </Link>
  );
}

export function WorkRowCard({ isUpdating = false, work }: WorkRowCardProps) {
  const typeLabel = getWorkTypeLabel(work.type);

  return (
    <Link className={cn(css.rowCard)} to={`/works/${work.id}`}>
      <Paper className={cn(css.rowSurface)} withBorder>
        <Group align="center" gap="md" wrap="nowrap">
          <WorkPoster
            coverSeed={work.id}
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
              {isUpdating && <AppBadge tone="accent">저장 중</AppBadge>}
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
  const starterCovers = [
    { title: '첫 기록', typeLabel: '소설' },
    { title: '이어보기', typeLabel: '애니' },
    { title: '다시 보고 싶은 장면', typeLabel: '영화' },
    { title: '한줄 감상', typeLabel: '만화' },
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
            시작하기
          </Text>
          <Title order={2}>처음 채울 선반</Title>
          <Text c="dimmed" size="sm">
            제목 하나만 남겨도 포스터처럼 정리됩니다.
          </Text>
        </Stack>
        <AppLinkButton to="/works/new" tone="primary">
          첫 작품 기록
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
  return (
    <Text c="dimmed" lineClamp={1} size="sm">
      마지막 감상 {formatWorkDate(work.lastConsumedAt)}
    </Text>
  );
}
