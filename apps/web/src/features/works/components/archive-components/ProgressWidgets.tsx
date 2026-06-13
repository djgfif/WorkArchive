import {
  Group,
  NumberInput,
  Paper,
  Progress,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import {
  getDefaultProgressUnitForWorkType,
  type ProgressUnit,
  type WorkRecord,
} from '@work-archive/shared-types';

import { useAppTranslation } from '@app/i18n';
import { AppButton } from '@shared/components/AppPrimitives';
import {
  getWorkProgressLabel,
  getWorkProgressPercent,
} from '../archive-display';
import { cn, css } from './styles';

interface ProgressDisplayProps {
  work: WorkRecord;
}

interface QuickProgressControlProps {
  disabled?: boolean;
  onSave: (update: {
    lastConsumedLabel: string;
    progressCurrent: number | null;
    progressTotal: number | null;
    progressUnit: ProgressUnit;
  }) => Promise<void>;
  work: WorkRecord;
}

function coerceNumberInputValue(value: number | string) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? null : parsed;
}

export function ProgressDisplay({ work }: ProgressDisplayProps) {
  const { t } = useAppTranslation();
  const progressLabel = getWorkProgressLabel(work);
  const progressPercent = getWorkProgressPercent(work);

  if (!progressLabel) {
    return (
      <Text c="dimmed" size="sm">
        {t('works.record.progressControl.noProgress')}
      </Text>
    );
  }

  return (
    <Stack className={cn(css.progressTrack)} gap={5}>
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Text c="dimmed" lineClamp={1} size="sm">
          {progressLabel}
        </Text>
        {progressPercent !== null && (
          <Text
            c="dimmed"
            size="xs"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {progressPercent}%
          </Text>
        )}
      </Group>
      {progressPercent !== null && (
        <Progress
          aria-label={t('works.record.progressControl.aria', {
            percent: progressPercent,
            title: work.title,
          })}
          color="archive"
          radius="xl"
          size={5}
          value={progressPercent}
        />
      )}
    </Stack>
  );
}

export function QuickProgressControl({
  disabled = false,
  onSave,
  work,
}: QuickProgressControlProps) {
  const { t } = useAppTranslation();
  const defaultUnit =
    work.progressUnit ?? getDefaultProgressUnitForWorkType(work.type);
  const [current, setCurrent] = useState<number | null>(
    work.progressCurrent ?? null,
  );
  const [total, setTotal] = useState<number | null>(work.progressTotal ?? null);
  const [lastLabel, setLastLabel] = useState(work.lastConsumedLabel ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCurrent(work.progressCurrent ?? null);
    setTotal(work.progressTotal ?? null);
    setLastLabel(work.lastConsumedLabel ?? '');
  }, [
    work.id,
    work.lastConsumedLabel,
    work.progressCurrent,
    work.progressTotal,
  ]);

  if (!defaultUnit) {
    return null;
  }

  const hasChanges =
    current !== (work.progressCurrent ?? null) ||
    total !== (work.progressTotal ?? null) ||
    lastLabel !== (work.lastConsumedLabel ?? '');
  const hasInvalidProgress =
    current !== null && total !== null && current > total;
  const unitLabel = {
    chapter: t('works.record.progressControl.unitChapter'),
    episode: t('works.record.progressControl.unitEpisode'),
    volume: t('works.record.progressControl.unitVolume'),
  } satisfies Record<ProgressUnit, string>;
  const currentLabel = {
    chapter: t('works.record.progressControl.currentChapter'),
    episode: t('works.record.progressControl.currentEpisode'),
    volume: t('works.record.progressControl.currentVolume'),
  } satisfies Record<ProgressUnit, string>;
  const totalLabel = {
    chapter: t('works.record.progressControl.totalChapter'),
    episode: t('works.record.progressControl.totalEpisode'),
    volume: t('works.record.progressControl.totalVolume'),
  } satisfies Record<ProgressUnit, string>;
  const lastPositionLabel = {
    chapter: t('works.record.progressControl.lastChapter'),
    episode: t('works.record.progressControl.lastEpisode'),
    volume: t('works.record.progressControl.lastVolume'),
  } satisfies Record<ProgressUnit, string>;

  async function handleSave() {
    if (!defaultUnit) return;

    try {
      setIsSaving(true);
      await onSave({
        lastConsumedLabel: lastLabel,
        progressCurrent: current,
        progressTotal: total,
        progressUnit: defaultUnit,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Paper className={cn(css.quickPanel)} radius="lg" withBorder>
      <Stack gap="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            disabled={disabled || isSaving}
            label={currentLabel[defaultUnit]}
            min={0}
            onChange={(value) => setCurrent(coerceNumberInputValue(value))}
            value={current ?? ''}
            w={120}
          />
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            disabled={disabled || isSaving}
            label={totalLabel[defaultUnit]}
            min={0}
            onChange={(value) => setTotal(coerceNumberInputValue(value))}
            value={total ?? ''}
            w={120}
          />
          <AppButton
            disabled={disabled || isSaving}
            onClick={() =>
              setCurrent((value) => (value === null ? 1 : value + 1))
            }
            tone="secondary"
            type="button"
          >
            +1{unitLabel[defaultUnit]}
          </AppButton>
          <AppButton
            disabled={disabled || isSaving || total === null}
            onClick={() => setCurrent(total)}
            tone="secondary"
            type="button"
          >
            {t('works.record.progressControl.fullProgress')}
          </AppButton>
        </Group>
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            disabled={disabled || isSaving}
            flex={1}
            label={lastPositionLabel[defaultUnit]}
            miw={220}
            onChange={(event) => setLastLabel(event.currentTarget.value)}
            placeholder={t('works.record.progressControl.placeholder', {
              current: current ?? 18,
              unit: unitLabel[defaultUnit],
            })}
            value={lastLabel}
          />
          <AppButton
            disabled={disabled || isSaving || !hasChanges || hasInvalidProgress}
            loading={isSaving}
            onClick={() => void handleSave()}
            tone="primary"
            type="button"
          >
            {t('works.record.progressControl.save')}
          </AppButton>
        </Group>
        {hasInvalidProgress && (
          <Text c="red" size="sm">
            {t('works.record.progressControl.invalidRange')}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
