import { Badge, Group, NativeSelect, Stack, Text, Title } from '@mantine/core';
import type { WorkStatus, WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppButton,
  AppLinkButton,
  SectionCard,
} from '../../../shared/components/AppPrimitives';
import {
  formatWorkUpdatedAt,
  getWorkTypeLabel,
  workStatusOptions,
} from '../utils/work-options';

export interface WorkQuickUpdate {
  rating?: number | null;
  status?: WorkStatus;
}

interface WorkListRowProps {
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
  isUpdating,
  onDelete,
  onQuickUpdate,
  work,
}: WorkListRowProps) {
  const typeLabel = getWorkTypeLabel(work.type);

  return (
    <SectionCard tone={isUpdating ? 'hero' : 'default'}>
      <Stack gap="lg">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <Group align="flex-start" wrap="nowrap">
            <ArtworkPoster
              thumbnailUrl={work.thumbnailUrl}
              title={work.title}
              typeLabel={typeLabel}
              variant="row"
            />

            <Stack gap="sm" miw={0}>
              <Group gap="xs" wrap="wrap">
                {work.favorite && <Badge color="archive">즐겨찾기</Badge>}
                {isUpdating && <Badge color="blue">반영 중</Badge>}
                <Badge>{typeLabel}</Badge>
              </Group>

              <Stack gap={4}>
                <Title order={3}>
                  <Link style={{ color: 'inherit', textDecoration: 'none' }} to={`/works/${work.id}`}>
                    {work.title}
                  </Link>
                </Title>
                <Text c="var(--app-text-muted)">
                  {work.author || '작가·제작자 미입력'} · 최근 수정{' '}
                  {formatWorkUpdatedAt(work.updatedAt)}
                </Text>
              </Stack>

              <Text c="var(--app-text-secondary)">
                {work.shortReview || work.description || '남겨둔 메모가 없습니다.'}
              </Text>
            </Stack>
          </Group>

          <ActionRow justify="flex-end">
            <AppLinkButton to={`/works/${work.id}`}>보기</AppLinkButton>
            <AppLinkButton to={`/works/${work.id}/edit`}>수정</AppLinkButton>
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
        </Group>

        <Group align="stretch" grow>
          <SectionCard gap={6} padding="lg" tone="subtle">
            <Text c="var(--app-text-muted)" fw={600} fz="sm">
              타입
            </Text>
            <Text c="var(--app-text-strong)" fw={700}>
              {typeLabel}
            </Text>
          </SectionCard>

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

        <Text c="var(--app-text-muted)" fz="sm">
          별점 {formatRatingLabel(work.rating)} · 삭제하면 지금은 목록에서 숨겨집니다.
        </Text>
      </Stack>
    </SectionCard>
  );
}
