import { Box, Group, NativeSelect, Progress, Stack, Text, Title } from '@mantine/core';
import type { WorkStatus, WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
} from '../../../shared/components/AppPrimitives';
import {
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkTypeLabel,
  workStatusOptions,
} from '../utils/work-options';

export interface WorkQuickUpdate {
  rating?: number | null;
  status?: WorkStatus;
}

interface WorkListRowProps {
  isLast?: boolean;
  isUpdating: boolean;
  onDelete: (work: WorkRecord) => Promise<void>;
  onQuickUpdate: (work: WorkRecord, update: WorkQuickUpdate) => Promise<void>;
  work: WorkRecord;
}

const ratingOptions = Array.from({ length: 10 }, (_, index) => {
  const value = (index + 1) * 0.5;

  return {
    label: `${value.toFixed(1)}점`,
    value,
  };
});

function formatRatingLabel(value: number | null) {
  return value === null ? '미평가' : `${value.toFixed(1)}점`;
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

export function WorkListRow({
  isLast = false,
  isUpdating,
  onDelete,
  onQuickUpdate,
  work,
}: WorkListRowProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const progressLabel = getProgressLabel(work);
  const progressPercent = getProgressPercent(work);

  return (
    <Box
      px="md"
      py="md"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--app-border-color)' }}
    >
      <Group align="center" gap="md" justify="space-between" wrap="wrap">
        <Group align="center" gap="md" miw={0} style={{ flex: '1 1 32rem' }} wrap="nowrap">
          <ArtworkPoster
            thumbnailUrl={work.thumbnailUrl}
            title={work.title}
            typeLabel={typeLabel}
            variant="row"
          />

          <Stack flex={1} gap={6} miw={0}>
            <ActionRow>
              <AppBadge>{typeLabel}</AppBadge>
              <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
              <AppBadge>{formatRatingLabel(work.rating)}</AppBadge>
              {work.favorite && <AppBadge tone="accent">즐겨찾기</AppBadge>}
              {isUpdating && <AppBadge tone="accent">반영 중</AppBadge>}
            </ActionRow>

            <div>
              <Title order={3} size="h4">
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

            {progressLabel && (
              <Stack gap={4}>
                <ActionRow>
                  <AppBadge tone="muted">진행도 {progressLabel}</AppBadge>
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
          </Stack>
        </Group>

        <Stack gap="xs" maw={330} style={{ flex: '1 1 18rem', minWidth: 'min(100%, 18rem)' }}>
          <ActionRow justify="flex-end">
            <AppLinkButton size="compact-sm" to={`/works/${work.id}`} tone="quiet">
              보기
            </AppLinkButton>
            <AppLinkButton size="compact-sm" to={`/works/${work.id}/edit`} tone="ghost">
              수정
            </AppLinkButton>
            <AppButton
              aria-label={`${work.title} 삭제`}
              disabled={isUpdating}
              onClick={() => void onDelete(work)}
              size="compact-sm"
              tone="danger"
              type="button"
            >
              삭제
            </AppButton>
          </ActionRow>

          <Group align="flex-end" grow gap="xs">
            <NativeSelect
              aria-label={`${work.title} 별점`}
              disabled={isUpdating}
              id={`rating-${work.id}`}
              label="별점"
              onChange={(event) => {
                const nextValue =
                  event.currentTarget.value === ''
                    ? null
                    : Number.parseFloat(event.currentTarget.value);

                void onQuickUpdate(work, {
                  rating: Number.isNaN(nextValue) ? null : nextValue,
                });
              }}
              value={work.rating?.toString() ?? ''}
            >
              <option value="">미평가</option>
              {ratingOptions.map((option) => (
                <option key={option.value} value={option.value.toString()}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>

            <NativeSelect
              aria-label={`${work.title} 상태`}
              disabled={isUpdating}
              id={`status-${work.id}`}
              label="상태"
              onChange={(event) =>
                void onQuickUpdate(work, {
                  status: event.currentTarget.value as WorkStatus,
                })
              }
              value={work.status}
            >
              {workStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Group>
        </Stack>
      </Group>
    </Box>
  );
}
