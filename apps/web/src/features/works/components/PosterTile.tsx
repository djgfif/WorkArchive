import { Box, Stack, Text, Title } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  SurfaceLinkCard,
} from '../../../shared/components/AppPrimitives';
import {
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

interface PosterTileProps {
  work: WorkRecord;
}

function formatRatingLabel(value: number | null) {
  return value === null ? '미평가' : `별점 ${value.toFixed(1)}`;
}

export function PosterTile({ work }: PosterTileProps) {
  const typeLabel = getWorkTypeLabel(work.type);

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
      </Stack>
    </SurfaceLinkCard>
  );
}
