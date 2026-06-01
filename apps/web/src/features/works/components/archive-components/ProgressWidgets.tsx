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

import { AppButton } from '@shared/components/AppPrimitives';
import {
  getWorkProgressLabel,
  getWorkProgressPercent,
} from '../archive-display';
import { cn, css } from './styles';

const progressUnitLabels: Record<ProgressUnit, string> = {
  chapter: '화',
  episode: '회',
  volume: '권',
};

const progressCurrentLabels: Record<ProgressUnit, string> = {
  chapter: '읽은 화',
  episode: '본 회차',
  volume: '읽은 권',
};

const progressTotalLabels: Record<ProgressUnit, string> = {
  chapter: '전체 화',
  episode: '전체 회차',
  volume: '전체 권',
};

const lastPositionLabels: Record<ProgressUnit, string> = {
  chapter: '마지막으로 읽은 위치',
  episode: '마지막으로 본 위치',
  volume: '마지막으로 읽은 위치',
};

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
  const progressLabel = getWorkProgressLabel(work);
  const progressPercent = getWorkProgressPercent(work);

  if (!progressLabel) {
    return (
      <Text c="dimmed" size="sm">
        진행 기록 없음
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
          <Text c="dimmed" size="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {progressPercent}%
          </Text>
        )}
      </Group>
      {progressPercent !== null && (
        <Progress
          aria-label={`${work.title} 상세 진행도 ${progressPercent}%`}
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
  }, [work.id, work.lastConsumedLabel, work.progressCurrent, work.progressTotal]);

  if (!defaultUnit) {
    return null;
  }

  const hasChanges =
    current !== (work.progressCurrent ?? null) ||
    total !== (work.progressTotal ?? null) ||
    lastLabel !== (work.lastConsumedLabel ?? '');
  const hasInvalidProgress =
    current !== null && total !== null && current > total;
  const unitLabel = progressUnitLabels[defaultUnit];
  const currentLabel = progressCurrentLabels[defaultUnit];
  const totalLabel = progressTotalLabels[defaultUnit];
  const lastPositionLabel = lastPositionLabels[defaultUnit];

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
            label={currentLabel}
            min={0}
            onChange={(value) => setCurrent(coerceNumberInputValue(value))}
            value={current ?? ''}
            w={120}
          />
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            disabled={disabled || isSaving}
            label={totalLabel}
            min={0}
            onChange={(value) => setTotal(coerceNumberInputValue(value))}
            value={total ?? ''}
            w={120}
          />
          <AppButton
            disabled={disabled || isSaving}
            onClick={() => setCurrent((value) => (value === null ? 1 : value + 1))}
            tone="secondary"
            type="button"
          >
            +1{unitLabel}
          </AppButton>
          <AppButton
            disabled={disabled || isSaving || total === null}
            onClick={() => setCurrent(total)}
            tone="secondary"
            type="button"
          >
            전체 분량까지 기록
          </AppButton>
        </Group>
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            disabled={disabled || isSaving}
            flex={1}
            label={lastPositionLabel}
            miw={220}
            onChange={(event) => setLastLabel(event.currentTarget.value)}
            placeholder={`예: ${current ?? 18}${unitLabel}까지`}
            value={lastLabel}
          />
          <AppButton
            disabled={disabled || isSaving || !hasChanges || hasInvalidProgress}
            loading={isSaving}
            onClick={() => void handleSave()}
            tone="primary"
            type="button"
          >
            기록 저장
          </AppButton>
        </Group>
        {hasInvalidProgress && (
          <Text c="red" size="sm">
            현재 진행량이 전체보다 클 수 없습니다.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
