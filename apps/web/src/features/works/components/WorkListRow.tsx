import {
  Box,
  Collapse,
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
import { useDisclosure } from '@mantine/hooks';
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

  return { label: `★ ${value.toFixed(1)}`, value };
});

const progressUnitLabels: Record<ProgressUnit, string> = {
  chapter: '화',
  episode: '회',
  volume: '권',
};

function formatRatingLabel(value: number | null) {
  return value === null ? '미평가' : `★ ${value.toFixed(1)}`;
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
  if (current !== null) return `${current}까지`;

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

  const [editOpen, { toggle: toggleEdit }] = useDisclosure(false);
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
    <Paper
      className={cn(css.listRowSurface)}
      radius="lg"
      style={{
        transition: 'border-color var(--wa-motion-fast, 140ms ease), box-shadow var(--wa-motion-fast, 140ms ease)',
      }}
      withBorder
    >
      {/* ── Main row ─────────────────────────────────────────────────── */}
      <Group align="flex-start" gap="md" justify="space-between" wrap="wrap">
        {/* Left: poster + info */}
        <Group
          align="flex-start"
          className={cn(css.listRowMain)}
          gap="md"
          miw={0}
          wrap="nowrap"
        >
          <Link
            aria-label={`${work.title} 상세 보기`}
            style={{ flexShrink: 0, display: 'block' }}
            to={`/works/${work.id}`}
          >
            <WorkPoster
              thumbnailUrl={work.thumbnailUrl}
              title={work.title}
              typeLabel={typeLabel}
              variant="row"
            />
          </Link>

          <Stack flex={1} gap={5} miw={0} pt={2}>
            {/* Type / Status badges */}
            <Group gap={6} wrap="nowrap">
              <AppBadge tone="muted">{typeLabel}</AppBadge>
              <AppBadge
                tone={
                  work.status === 'completed'
                    ? 'success'
                    : work.status === 'in_progress'
                      ? 'accent'
                      : work.status === 'dropped'
                        ? 'danger'
                        : 'default'
                }
              >
                {getWorkStatusLabel(work.status)}
              </AppBadge>
              {isUpdating && <AppBadge tone="accent">저장 중</AppBadge>}
            </Group>

            {/* Title */}
            <Title lineClamp={1} order={3} size="h4">
              <Link
                style={{ color: 'inherit', textDecoration: 'none' }}
                to={`/works/${work.id}`}
              >
                {work.title}
              </Link>
            </Title>

            {/* Author + updated */}
            <Text c="dimmed" lineClamp={1} size="xs">
              {work.author || '작가·제작자 미입력'}
              {' · '}
              {formatWorkUpdatedAt(work.updatedAt)}
            </Text>

            {/* Short review / description */}
            {(work.shortReview || work.description) && (
              <Text c="var(--app-text-muted)" lineClamp={1} size="sm">
                {work.shortReview || work.description}
              </Text>
            )}

            {/* Progress + rating inline summary */}
            <Group gap="xs" wrap="wrap">
              {progressLabel && (
                <AppBadge tone="muted">진행 {progressLabel}</AppBadge>
              )}
              <AppBadge tone={work.rating !== null ? 'warning' : 'muted'}>
                {formatRatingLabel(work.rating)}
              </AppBadge>
              {work.favorite && <AppBadge tone="accent">★ 즐겨찾기</AppBadge>}
            </Group>

            {/* Progress bar */}
            {progressPercent !== null && (
              <Progress
                aria-label={`${work.title} 진행도 ${progressPercent}%`}
                color="archive.5"
                radius="xl"
                size="xs"
                value={progressPercent}
              />
            )}
          </Stack>
        </Group>

        {/* Right: compact action buttons */}
        <Stack className={cn(css.listRowControls)} gap="xs" style={{ minWidth: 'min(100%, 10rem)' }}>
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

          {/* Quick edit toggle */}
          <ActionRow justify="flex-end">
            <AppButton
              aria-expanded={editOpen}
              aria-label="빠른 수정 패널 열기"
              onClick={toggleEdit}
              size="compact-xs"
              tone="ghost"
              type="button"
            >
              {editOpen ? '빠른 수정 닫기 ↑' : '빠른 수정 ↓'}
            </AppButton>
          </ActionRow>
        </Stack>
      </Group>

      {/* ── Collapsible quick-edit panel ─────────────────────────────── */}
      <Collapse in={editOpen}>
        <Box
          mt="md"
          pt="md"
          style={{
            borderTop: '1px solid var(--app-border-subtle)',
            background: 'var(--app-surface-subtle)',
            borderRadius: '0 0 var(--mantine-radius-lg) var(--mantine-radius-lg)',
            margin: 'calc(var(--mantine-spacing-md) * -1)',
            marginTop: 'var(--mantine-spacing-md)',
            padding: 'var(--mantine-spacing-md)',
          }}
        >
          <Stack gap="md">
            {/* Status + Rating row */}
            <Group align="flex-end" gap="sm" grow wrap="wrap">
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

            {/* Progress inputs */}
            {progressUnit && (
              <Stack gap="xs">
                <Group align="flex-end" gap="sm" grow wrap="wrap">
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

                <Group align="flex-end" gap="sm" wrap="wrap">
                  <TextInput
                    aria-label={`${work.title} 마지막 위치`}
                    disabled={isUpdating}
                    flex={1}
                    label="마지막 위치"
                    maxLength={120}
                    onChange={(event) => setLastLabel(event.currentTarget.value)}
                    placeholder={`예: ${current ?? 18}${progressUnitLabels[progressUnit]}`}
                    style={{ minWidth: 'min(100%, 12rem)' }}
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
                    tone="primary"
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

            {/* Delete */}
            <ActionRow justify="flex-end">
              <AppButton
                aria-label={`${work.title} 삭제`}
                disabled={isUpdating}
                onClick={() => void onDelete(work)}
                size="compact-sm"
                tone="danger"
                type="button"
              >
                휴지통으로 이동
              </AppButton>
            </ActionRow>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}
