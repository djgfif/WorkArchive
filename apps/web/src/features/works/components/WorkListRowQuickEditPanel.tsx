import {
  Box,
  Collapse,
  Group,
  NativeSelect,
  NumberInput,
  Stack,
  Text,
} from '@mantine/core';
import type { WorkRecord, WorkStatus } from '@work-archive/shared-types';
import { useEffect, useState } from 'react';

import {
  ActionRow,
  AppButton,
  AppLinkButton,
} from '@shared/components/AppPrimitives';
import type {
  WorkQuickProgressUpdate,
  WorkQuickUpdate,
} from './work-list-row.types';
import { workStatusOptions } from '../utils/work-options';
import {
  coerceNumberInputValue,
  getWorkListProgressUnit,
  progressCurrentLabels,
  progressTotalLabels,
  progressUnitLabels,
  workListRowRatingOptions,
} from '../utils/work-list-row-state';

interface WorkListRowQuickEditPanelProps {
  expanded: boolean;
  isUpdating: boolean;
  onDelete: (work: WorkRecord) => Promise<void>;
  onQuickProgressUpdate: (
    work: WorkRecord,
    update: WorkQuickProgressUpdate,
  ) => Promise<void>;
  onQuickUpdate: (work: WorkRecord, update: WorkQuickUpdate) => Promise<void>;
  work: WorkRecord;
}

export function WorkListRowQuickEditPanel({
  expanded,
  isUpdating,
  onDelete,
  onQuickProgressUpdate,
  onQuickUpdate,
  work,
}: WorkListRowQuickEditPanelProps) {
  const progressUnit = getWorkListProgressUnit(work);
  const [current, setCurrent] = useState<number | null>(
    work.progressCurrent ?? null,
  );
  const [total, setTotal] = useState<number | null>(work.progressTotal ?? null);

  useEffect(() => {
    setCurrent(work.progressCurrent ?? null);
    setTotal(work.progressTotal ?? null);
  }, [work.id, work.progressCurrent, work.progressTotal]);

  const hasProgressChanges =
    current !== (work.progressCurrent ?? null) ||
    total !== (work.progressTotal ?? null);
  const hasInvalidProgress =
    current !== null && total !== null && current > total;
  const nextLastConsumedLabel =
    progressUnit && current !== null
      ? `${current}${progressUnitLabels[progressUnit]}까지`
      : '';

  return (
    <Collapse expanded={expanded}>
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
          <ActionRow justify="flex-end">
            <AppLinkButton size="compact-sm" to={`/works/${work.id}`} tone="quiet">
              보기
            </AppLinkButton>
            <AppLinkButton
              size="compact-sm"
              to={`/works/${work.id}/edit`}
              tone="ghost"
            >
              수정
            </AppLinkButton>
            <AppButton
              aria-label={
                work.favorite
                  ? `${work.title} 즐겨찾기 해제`
                  : `${work.title} 즐겨찾기`
              }
              aria-pressed={work.favorite}
              disabled={isUpdating}
              onClick={() =>
                void onQuickUpdate(work, { favorite: !work.favorite })
              }
              size="compact-sm"
              tone={work.favorite ? 'primary' : 'secondary'}
              type="button"
            >
              {work.favorite ? '★ 즐겨찾기' : '☆ 즐겨찾기'}
            </AppButton>
          </ActionRow>

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
              {workListRowRatingOptions.map((option) => (
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
              <Group align="flex-end" gap="sm" grow wrap="wrap">
                <NumberInput
                  allowDecimal={false}
                  allowNegative={false}
                  aria-label={`${work.title} ${progressCurrentLabels[progressUnit]}`}
                  disabled={isUpdating}
                  label={progressCurrentLabels[progressUnit]}
                  min={0}
                  onChange={(value) =>
                    setCurrent(coerceNumberInputValue(value))
                  }
                  value={current ?? ''}
                />
                <NumberInput
                  allowDecimal={false}
                  allowNegative={false}
                  aria-label={`${work.title} ${progressTotalLabels[progressUnit]}`}
                  disabled={isUpdating}
                  label={progressTotalLabels[progressUnit]}
                  min={0}
                  onChange={(value) => setTotal(coerceNumberInputValue(value))}
                  value={total ?? ''}
                />
              </Group>

              <ActionRow justify="flex-end">
                <AppButton
                  aria-label={`${work.title} 진행도 저장`}
                  disabled={
                    isUpdating || !hasProgressChanges || hasInvalidProgress
                  }
                  onClick={() =>
                    void onQuickProgressUpdate(work, {
                      lastConsumedLabel: nextLastConsumedLabel,
                      progressCurrent: current,
                      progressTotal: total,
                      progressUnit,
                    })
                  }
                  size="compact-sm"
                  tone="primary"
                  type="button"
                >
                  진행 저장
                </AppButton>
              </ActionRow>

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
              휴지통으로 이동
            </AppButton>
          </ActionRow>
        </Stack>
      </Box>
    </Collapse>
  );
}
