import { Box, Progress, Stack, Text, Title } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  SectionCard,
} from '../../../shared/components/AppPrimitives';
import {
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

interface WorkCardProps {
  onDelete: (work: WorkRecord) => Promise<void>;
  work: WorkRecord;
}

function getProgressPercent(work: WorkRecord) {
  const current = work.progressCurrent ?? null;
  const total = work.progressTotal ?? null;

  if (current === null || total === null || total <= 0) {
    return null;
  }

  return Math.min(100, Math.round((current / total) * 100));
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
    return `${current}까지 기록`;
  }

  return null;
}

export function WorkCard({ onDelete, work }: WorkCardProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const statusLabel = getWorkStatusLabel(work.status);
  const visibleGenres = work.genres.slice(0, 3);
  const ratingLabel = work.rating === null ? '별점 미평가' : `별점 ${work.rating.toFixed(1)}`;
  const progressLabel = getProgressLabel(work);
  const progressPercent = getProgressPercent(work);

  return (
    <SectionCard gap="sm" padding="sm" tone="subtle">
      <Box pos="relative" w="100%">
        <Box w="100%">
          <ArtworkPoster
            thumbnailUrl={work.thumbnailUrl}
            title={work.title}
            typeLabel={typeLabel}
            variant="grid"
          />
        </Box>
        <Box
          pos="absolute"
          style={{
            left: '0.45rem',
            top: '0.45rem',
          }}
        >
          <AppBadge tone="accent">{statusLabel}</AppBadge>
        </Box>
        {work.favorite && (
          <Box
            pos="absolute"
            style={{
              right: '0.45rem',
              top: '0.45rem',
            }}
          >
            <AppBadge tone="accent">즐겨찾기</AppBadge>
          </Box>
        )}
      </Box>

      <Stack gap="sm">
        <ActionRow justify="space-between">
          <AppBadge>{ratingLabel}</AppBadge>
          <AppBadge>{typeLabel}</AppBadge>
        </ActionRow>

        <div>
          <Title order={3} lineClamp={2} size="h4">
            <Link style={{ color: 'inherit', textDecoration: 'none' }} to={`/works/${work.id}`}>
              {work.title}
            </Link>
          </Title>
          <Text c="var(--app-text-muted)" size="sm">
            {work.author || '작가·제작자 미입력'} · 최근 수정 {formatWorkUpdatedAt(work.updatedAt)}
          </Text>
        </div>

        <Text c="var(--app-text-secondary)" lineClamp={2} size="sm">
          {work.shortReview || work.description || '남겨둔 메모가 없습니다.'}
        </Text>

        <ActionRow>
          {visibleGenres.length > 0 ? (
            visibleGenres.map((genre) => <AppBadge key={genre}>{genre}</AppBadge>)
          ) : (
            <AppBadge tone="muted">장르 없음</AppBadge>
          )}
          {work.genres.length > visibleGenres.length && (
            <AppBadge>+{work.genres.length - visibleGenres.length}</AppBadge>
          )}
        </ActionRow>

        {progressLabel && (
          <Stack gap={4}>
            <ActionRow justify="space-between">
              <Text c="var(--app-text-muted)" fw={700} size="xs">
                진행도
              </Text>
              <Text c="var(--app-text-secondary)" size="xs">
                {progressLabel}
              </Text>
            </ActionRow>
            {progressPercent !== null && (
              <Progress
                aria-label={`${work.title} 진행도 ${progressPercent}%`}
                color="archive"
                radius="xl"
                size="xs"
                value={progressPercent}
              />
            )}
          </Stack>
        )}

        <ActionRow justify="space-between">
          <AppLinkButton size="compact-sm" to={`/works/${work.id}`} tone="quiet">
            상세
          </AppLinkButton>
          <AppLinkButton size="compact-sm" to={`/works/${work.id}/edit`} tone="ghost">
            수정
          </AppLinkButton>
          <AppButton
            aria-label={`${work.title} 삭제`}
            onClick={() => void onDelete(work)}
            size="compact-sm"
            tone="danger"
            type="button"
          >
            삭제
          </AppButton>
        </ActionRow>
      </Stack>
    </SectionCard>
  );
}
