import { Group, SimpleGrid, Stack, Text, Textarea } from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
import {
  ActionRow,
  AppBadge,
  AppButton,
} from '@shared/components/AppPrimitives';
import { StarRatingInput } from './ArchiveComponents';
import {
  getFieldId,
  type WorkFormInputChangeHandler,
  type WorkFormValuesProps,
} from './add-work-form.types';
import styles from './ArchiveComponents.module.css';
import type { WorkFormValues } from '../utils/work-form';
import { workStatusOptions } from '../utils/work-options';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface StatusButtonGroupProps {
  onChange: (status: WorkFormValues['status']) => void;
  value: WorkFormValues['status'];
}

function StatusButtonGroup({ onChange, value }: StatusButtonGroupProps) {
  const { t } = useAppTranslation();

  return (
    <Stack gap={6}>
      <Text c="var(--mantine-color-dimmed)" fw={600} size="sm">
        {t('works.form.statusLabel')}
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
  const { t } = useAppTranslation();
  const ratingValue =
    values.rating.trim() === '' ? null : Number.parseFloat(values.rating);
  const normalizedRating =
    ratingValue !== null && Number.isFinite(ratingValue) ? ratingValue : null;

  return (
    <Stack gap="md">
      <ActionRow>
        <AppBadge tone="accent">{t('works.form.recordBadge')}</AppBadge>
        <Text c="var(--mantine-color-dimmed)" size="sm">
          {t('works.form.recordDescription')}
        </Text>
      </ActionRow>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <StatusButtonGroup onChange={onStatusChange} value={values.status} />

        <StarRatingInput
          label={t('works.form.ratingLabel')}
          onChange={onRatingChange}
          value={normalizedRating}
        />

        <div className={cn(css.gridSpanFull)}>
          <Textarea
            id={getFieldId(idPrefix, 'shortReview')}
            label={t('works.form.shortReviewLabel')}
            name="shortReview"
            onChange={onInputChange}
            placeholder={t('works.form.shortReviewPlaceholder')}
            rows={2}
            value={values.shortReview}
          />
        </div>

        <Text
          c="var(--mantine-color-dimmed)"
          className={cn(css.gridSpanFull)}
          size="sm"
        >
          {t('works.form.recordLongReviewHelp')}
        </Text>
      </SimpleGrid>
    </Stack>
  );
}
