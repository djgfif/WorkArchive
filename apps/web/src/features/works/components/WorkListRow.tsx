import { Box, Group, NativeSelect, Stack, Text, Title } from '@mantine/core';
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

export function WorkListRow({
  isLast = false,
  isUpdating,
  onDelete,
  onQuickUpdate,
  work,
}: WorkListRowProps) {
  const typeLabel = getWorkTypeLabel(work.type);

  return (
    <Box
      px="lg"
      py="lg"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--app-border-color)' }}
    >
      <Group align="flex-start" gap="lg" justify="space-between" wrap="wrap">
        <Group align="flex-start" gap="md" miw={0} wrap="nowrap">
          <ArtworkPoster
            thumbnailUrl={work.thumbnailUrl}
            title={work.title}
            typeLabel={typeLabel}
            variant="row"
          />

          <Stack flex={1} gap="sm" miw={0}>
            <ActionRow>
              <AppBadge>{typeLabel}</AppBadge>
              <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
              <AppBadge>{formatRatingLabel(work.rating)}</AppBadge>
              {work.favorite && <AppBadge tone="accent">즐겨찾기</AppBadge>}
              {isUpdating && <AppBadge tone="accent">반영 중</AppBadge>}
            </ActionRow>

            <div>
              <Title order={3}>
                <Link style={{ color: 'inherit', textDecoration: 'none' }} to={`/works/${work.id}`}>
                  {work.title}
                </Link>
              </Title>
              <Text c="var(--app-text-muted)">
                {work.author || '작가·제작자 미입력'} · 최근 수정 {formatWorkUpdatedAt(work.updatedAt)}
              </Text>
            </div>

            <Text c="var(--app-text-secondary)">
              {work.shortReview || work.description || '남겨둔 메모가 없습니다.'}
            </Text>
          </Stack>
        </Group>

        <Stack gap="sm" maw={360} style={{ flex: '1 1 18rem', minWidth: 'min(100%, 18rem)' }}>
          <ActionRow justify="flex-end">
            <AppLinkButton to={`/works/${work.id}`} tone="quiet">
              보기
            </AppLinkButton>
            <AppLinkButton to={`/works/${work.id}/edit`} tone="ghost">
              수정
            </AppLinkButton>
            <AppButton
              aria-label={`${work.title} 삭제`}
              disabled={isUpdating}
              onClick={() => void onDelete(work)}
              tone="danger"
              type="button"
            >
              삭제
            </AppButton>
          </ActionRow>

          <Group align="flex-end" grow>
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
