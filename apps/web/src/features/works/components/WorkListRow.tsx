import {
  Group,
  NativeSelect,
  NumberInput,
  Paper,
  Progress,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  getDefaultProgressUnitForWorkType,
  type ProgressUnit,
  type WorkRecord,
  type WorkStatus,
} from '@work-archive/shared-types';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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
import { WorkPoster } from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

export interface WorkQuickUpdate {
  favorite?: boolean;
  rating?: number | null;
  status?: WorkStatus;
}

export interface WorkQuickProgressUpdate {
  lastConsumedLabel: string;
  progressCurrent: number | null;
  progressTotal: number | null;
  progressUnit: ProgressUnit;
}

interface WorkListRowProps {
  isLast?: boolean;
  isUpdating: boolean;
  onDelete: (work: WorkRecord) => Promise<void>;
  onQuickProgressUpdate: (
    work: WorkRecord,
    update: WorkQuickProgressUpdate,
  ) => Promise<void>;
  onQuickUpdate: (work: WorkRecord, update: WorkQuickUpdate) => Promise<void>;
  work: WorkRecord;
}

const ratingOptions = Array.from({ length: 10 }, (_, index) => {
  const value = (index + 1) * 0.5;

  return { label: `${value.toFixed(1)}점`, value };
});

const progressUnitLabels: Record<ProgressUnit, string> = {
  chapter: '화',
  episode: '회',
  volume: '권',
};

function formatRatingLabel(value: number | null) {
  return value === null ? '미평가' : `${value.toFixed(1)}점`;
}

function coerceNumberInputValue(value: number | string) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? null : parsed;
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
  if (work.lastConsumedLabel) return work.lastConsumedLabel;

  const current = work.progressCurrent ?? null;
  const total = work.progressTotal ?? null;

  if (current !== null && total !== null) return `${current}/${total}`;
  if (current !== null) return `${current}까지 기록`;

  return null;
}

export function WorkListRow({
  isUpdating,
  onDelete,
  onQuickProgressUpdate,
  onQuickUpdate,
  work,
}: WorkListRowProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const progressLabel = getProgressLabel(work);
  const progressPercent = getProgressPercent(work);
  const progressUnit =
    work.progressUnit ?? getDefaultProgressUnitForWorkType(work.type);
  const [current, setCurrent] = useState<number | null>(
    work.progressCurrent ?? null,
  );
  const [total, setTotal] = useState<number | null>(work.progressTotal ?? null);
  const [lastLabel, setLastLabel] = useState(work.lastConsumedLabel ?? '');

  useEffect(() => {
    setCurrent(work.progressCurrent ?? null);
    setTotal(work.progressTotal ?? null);
    setLastLabel(work.lastConsumedLabel ?? '');
  }, [work.id, work.lastConsumedLabel, work.progressCurrent, work.progressTotal]);

  const hasProgressChanges =
    current !== (work.progressCurrent ?? null) ||
    total !== (work.progressTotal ?? null) ||
    lastLabel !== (work.lastConsumedLabel ?? '');
  const hasInvalidProgress =
    current !== null && total !== null && current > total;

  return (
    <Paper className={cn(css.listRowSurface)} radius="lg" withBorder>
      <Group align="center" gap="md" justify="space-between" wrap="wrap">
        <Group align="center" className={cn(css.listRowMain)} gap="md" miw={0} wrap="nowrap">
          <WorkPoster
            thumbnailUrl={work.thumbnailUrl}
            title={work.title}
            typeLabel={typeLabel}
            variant="row"
          />

          <Stack flex={1} gap={6} miw={0}>
            <Group gap="xs" wrap="nowrap">
              <Text c="dimmed" lineClamp={1} size="xs">
                {typeLabel}
              </Text>
              <Text c="dimmed" size="xs">/</Text>
              <Text c="dimmed" lineClamp={1} size="xs">
                {getWorkStatusLabel(work.status)}
              </Text>
              {isUpdating && <AppBadge tone="accent">저장 중</AppBadge>}
            </Group>

            <Title lineClamp={1} order={3} size="h4">
              <Link to={`/works/${work.id}`}>{work.title}</Link>
            </Title>
            <Text c="dimmed" lineClamp={1} size="sm">
              {work.author || '작가·제작자 미입력'} · 최근 수정 {formatWorkUpdatedAt(work.updatedAt)}
            </Text>
            <Text c="var(--app-text-secondary)" lineClamp={2} size="sm">
              {work.shortReview || work.description || '남겨둔 메모가 없습니다.'}
            </Text>
            {progressLabel && (
              <Stack gap={4}>
                <Group gap="xs" wrap="wrap">
                  <AppBadge tone="muted">진행 {progressLabel}</AppBadge>
                  <AppBadge tone="muted">{formatRatingLabel(work.rating)}</AppBadge>
                </Group>
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

        <Stack className={cn(css.listRowControls)} gap="xs">
          <ActionRow justify="flex-end">
            <AppLinkButton size="compact-sm" to={`/works/${work.id}`} tone="quiet">
              보기
            </AppLinkButton>
            <AppLinkButton size="compact-sm" to={`/works/${work.id}/edit`} tone="ghost">
              수정
            </AppLinkButton>
            <AppButton
              aria-label={work.favorite ? `${work.title} 즐겨찾기 해제` : `${work.title} 즐겨찾기`}
              aria-pressed={work.favorite}
              disabled={isUpdating}
              onClick={() => void onQuickUpdate(work, { favorite: !work.favorite })}
              size="compact-sm"
              tone={work.favorite ? 'primary' : 'secondary'}
              type="button"
            >
              {work.favorite ? '★' : '☆'}
            </AppButton>
          </ActionRow>

          <Group align="flex-end" grow gap="xs">
            <NativeSelect
              aria-label={`${work.title} 별점`}
              disabled={isUpdating}
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

          {progressUnit && (
            <Stack gap="xs">
              <Group align="flex-end" grow gap="xs">
                <NumberInput
                  allowDecimal={false}
                  allowNegative={false}
                  aria-label={`${work.title} 현재 ${progressUnitLabels[progressUnit]}`}
                  disabled={isUpdating}
                  label={`현재 ${progressUnitLabels[progressUnit]}`}
                  min={0}
                  onChange={(value) => setCurrent(coerceNumberInputValue(value))}
                  value={current ?? ''}
                />
                <NumberInput
                  allowDecimal={false}
                  allowNegative={false}
                  aria-label={`${work.title} 전체 ${progressUnitLabels[progressUnit]}`}
                  disabled={isUpdating}
                  label={`전체 ${progressUnitLabels[progressUnit]}`}
                  min={0}
                  onChange={(value) => setTotal(coerceNumberInputValue(value))}
                  value={total ?? ''}
                />
              </Group>

              <Group align="flex-end" gap="xs" wrap="wrap">
                <TextInput
                  aria-label={`${work.title} 마지막 위치`}
                  className={cn(css.lastLocationInput)}
                  disabled={isUpdating}
                  label="마지막 위치"
                  maxLength={120}
                  onChange={(event) => setLastLabel(event.currentTarget.value)}
                  placeholder={`예: ${current ?? 18}${progressUnitLabels[progressUnit]}`}
                  value={lastLabel}
                />
                <AppButton
                  aria-label={`${work.title} 진행도 저장`}
                  disabled={isUpdating || !hasProgressChanges || hasInvalidProgress}
                  onClick={() =>
                    void onQuickProgressUpdate(work, {
                      lastConsumedLabel: lastLabel,
                      progressCurrent: current,
                      progressTotal: total,
                      progressUnit,
                    })
                  }
                  size="compact-sm"
                  tone="secondary"
                  type="button"
                >
                  저장
                </AppButton>
              </Group>
              {hasInvalidProgress && (
                <Text c="red" size="xs">
                  현재 진행량이 전체보다 클 수 없습니다.
                </Text>
              )}
            </Stack>
          )}

          <ActionRow justify="flex-end">
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
        </Stack>
      </Group>
    </Paper>
  );
}
