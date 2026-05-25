import { Group, SimpleGrid, Stack, Text, Textarea } from '@mantine/core';

import { ActionRow, AppBadge, AppButton } from '@shared/components/AppPrimitives';
import { StarRatingInput } from './ArchiveComponents';
import {
  getFieldId,
  type WorkFormInputChangeHandler,
  type WorkFormValuesProps,
} from './add-work-form.types';
import styles from './ArchiveComponents.module.css';
import type { WorkFormValues } from '../utils/work-form';
import { workStatusOptions } from '../utils/work-options';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

interface StatusButtonGroupProps {
  onChange: (status: WorkFormValues['status']) => void;
  value: WorkFormValues['status'];
}

function StatusButtonGroup({ onChange, value }: StatusButtonGroupProps) {
  return (
    <Stack gap={6}>
      <Text c="var(--mantine-color-dimmed)" fw={600} size="sm">
        상태
      </Text>
      <Group gap="xs" wrap="wrap">
        {workStatusOptions.map((option) => (
          <AppButton
            aria-pressed={value === option.value}
            key={option.value}
            onClick={() => onChange(option.value)}
            size="compact-sm"
            tone={value === option.value ? 'primary' : 'secondary'}
            type="button"
          >
            {option.label}
          </AppButton>
        ))}
      </Group>
    </Stack>
  );
}

interface PersonalRecordFieldsProps extends WorkFormValuesProps {
  idPrefix?: string;
  onInputChange: WorkFormInputChangeHandler;
  onRatingChange: (rating: number | null) => void;
  onStatusChange: (status: WorkFormValues['status']) => void;
}

export function PersonalRecordFields({
  idPrefix = '',
  onInputChange,
  onRatingChange,
  onStatusChange,
  values,
}: PersonalRecordFieldsProps) {
  const ratingValue =
    values.rating.trim() === '' ? null : Number.parseFloat(values.rating);
  const normalizedRating =
    ratingValue !== null && Number.isFinite(ratingValue) ? ratingValue : null;

  return (
    <Stack gap="md">
      <ActionRow>
        <AppBadge tone="accent">내 기록</AppBadge>
        <Text c="var(--mantine-color-dimmed)" size="sm">
          상태, 별점, 한줄평만 먼저 남겨도 충분합니다.
        </Text>
      </ActionRow>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <StatusButtonGroup onChange={onStatusChange} value={values.status} />

        <StarRatingInput
          label="별점"
          onChange={onRatingChange}
          value={normalizedRating}
        />

        <div className={cn(css.gridSpanFull)}>
          <Textarea
            id={getFieldId(idPrefix, 'shortReview')}
            label="한줄평"
            name="shortReview"
            onChange={onInputChange}
            placeholder="짧게 남길 감상을 적어보세요"
            rows={2}
            value={values.shortReview}
          />
        </div>

        <Text
          c="var(--mantine-color-dimmed)"
          className={cn(css.gridSpanFull)}
          size="sm"
        >
          긴 상세 감상과 감상 이력은 저장 후 상세 화면에서 이어서 정리할 수
          있습니다.
        </Text>
      </SimpleGrid>
    </Stack>
  );
}
