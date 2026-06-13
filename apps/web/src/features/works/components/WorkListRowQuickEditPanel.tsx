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

import { useAppTranslation } from '@app/i18n';
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
  const { t } = useAppTranslation();
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
      ? t('works.list.progressConsumedLabel', {
          current,
          unit: progressUnitLabels[progressUnit],
        })
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
            <AppLinkButton
              size="compact-sm"
              to={`/works/${work.id}`}
              tone="quiet"
            >
              {t('works.list.viewDetail')}
            </AppLinkButton>
            <AppLinkButton
              size="compact-sm"
              to={`/works/${work.id}/edit`}
              tone="ghost"
            >
              {t('works.list.edit')}
            </AppLinkButton>
            <AppButton
              aria-label={
                work.favorite
                  ? t('works.list.favoriteRemoveAria', { title: work.title })
                  : t('works.list.favoriteAddAria', { title: work.title })
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
              {work.favorite
                ? t('works.list.favoriteOn')
                : t('works.list.favoriteOff')}
            </AppButton>
          </ActionRow>

          <Group align="flex-end" gap="sm" grow wrap="wrap">
            <NativeSelect
              aria-label={t('works.list.ratingAria', { title: work.title })}
              disabled={isUpdating}
              label={t('works.form.ratingLabel')}
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
              <option value="">{t('works.ratingMissing')}</option>
              {workListRowRatingOptions.map((option) => (
                <option key={option.value} value={option.value.toString()}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>

            <NativeSelect
              aria-label={t('works.list.statusAria', { title: work.title })}
              disabled={isUpdating}
              label={t('works.form.statusLabel')}
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
                  aria-label={t('works.list.progressSaveAria', {
                    title: work.title,
                  })}
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
                  {t('works.list.progressSave')}
                </AppButton>
              </ActionRow>

              {hasInvalidProgress && (
                <Text c="red" size="xs">
                  {t('works.record.progressControl.invalidRange')}
                </Text>
              )}
            </Stack>
          )}

          <ActionRow justify="flex-end">
            <AppButton
              aria-label={t('works.list.deleteAria', { title: work.title })}
              disabled={isUpdating}
              onClick={() => void onDelete(work)}
              size="compact-sm"
              tone="danger"
              type="button"
            >
              {t('works.list.trashMove')}
            </AppButton>
          </ActionRow>
        </Stack>
      </Box>
    </Collapse>
  );
}
