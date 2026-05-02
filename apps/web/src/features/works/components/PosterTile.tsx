import { Box, Stack, Text, Title } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  SurfaceLinkCard,
} from '../../../shared/components/AppPrimitives';
import {
  formatWorkDate,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

interface PosterTileProps {
  work: WorkRecord;
}

function formatRatingLabel(value: number | null) {
  return value === null ? '미평가' : `별점 ${value.toFixed(1)}`;
}

function getProgressLabel(work: WorkRecord) {
  if (work.lastConsumedLabel) {
    return work.lastConsumedLabel;
  }

  const current = work.progressCurrent ?? null;
  const total = work.progressTotal ?? null;

  if (current !== null && total !== null) {
    return `${current}/${total}`;
  }

  if (current !== null) {
    return `${current}까지`;
  }

  return null;
}

export function PosterTile({ work }: PosterTileProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const progressLabel = getProgressLabel(work);
  const lastConsumedAtLabel = work.lastConsumedAt
    ? formatWorkDate(work.lastConsumedAt)
    : null;

  return (
    <SurfaceLinkCard gap="sm" padding="sm" to={`/works/${work.id}`} tone="subtle">
      <Box pos="relative">
        <ArtworkPoster
          thumbnailUrl={work.thumbnailUrl}
          title={work.title}
          typeLabel={typeLabel}
          variant="grid"
        />
        {work.favorite && (
          <Box
            pos="absolute"
            style={{
              right: '0.6rem',
              top: '0.6rem',
            }}
          >
            <Text
              aria-label={`${work.title} 즐겨찾기`}
              c="var(--app-text-strong)"
              fw={700}
              size="lg"
            >
              ★
            </Text>
          </Box>
        )}
      </Box>

      <Stack gap={6}>
        <Title c="var(--app-text-strong)" lineClamp={2} order={3} size="h4">
          {work.title}
        </Title>

        <ActionRow justify="space-between">
          <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
          <AppBadge tone={work.rating === null ? 'muted' : 'accent'}>
            {formatRatingLabel(work.rating)}
          </AppBadge>
        </ActionRow>

        {(progressLabel || lastConsumedAtLabel) && (
          <Stack gap={2}>
            {progressLabel && (
              <Text c="var(--app-text-secondary)" fw={700} size="sm" lineClamp={1}>
                진행 {progressLabel}
              </Text>
            )}
            {lastConsumedAtLabel && (
              <Text c="var(--app-text-muted)" size="xs" lineClamp={1}>
                마지막 감상 {lastConsumedAtLabel}
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </SurfaceLinkCard>
  );
}
