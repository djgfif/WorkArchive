import { useEffect, useState } from 'react';
import {
  Group,
  NativeSelect,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import type { WorkRecord, WorkStatus } from '@work-archive/shared-types';

import { useAppTranslation } from '@app/i18n';
import {
  AppButton,
  PageSection,
  SectionCard,
} from '@shared/components/AppPrimitives';
import { worksService } from '../services/works.service';
import { workStatusOptions } from '../utils/work-options';
import { createUpsertWorkInputFromRecord } from '../utils/work-form';
import { workRecordRatingOptions } from '../utils/work-record-rating-options';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface WorkQuickRecordSectionProps {
  onError(message: string | null): void;
  onSuccess(message: string): void;
  variant?: 'default' | 'hero';
  work: WorkRecord;
}

export function WorkQuickRecordSection({
  onError,
  onSuccess,
  variant = 'default',
  work,
}: WorkQuickRecordSectionProps) {
  const { t } = useAppTranslation();
  const [status, setStatus] = useState<WorkStatus>(work.status);
  const [rating, setRating] = useState(work.rating?.toString() ?? '');
  const [favorite, setFavorite] = useState(work.favorite);
  const [shortReview, setShortReview] = useState(work.shortReview);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStatus(work.status);
    setRating(work.rating?.toString() ?? '');
    setFavorite(work.favorite);
    setShortReview(work.shortReview);
  }, [work.favorite, work.id, work.rating, work.shortReview, work.status]);

  const parsedRating = rating === '' ? null : Number.parseFloat(rating);
  const nextRating = Number.isNaN(parsedRating) ? null : parsedRating;
  const hasChanges =
    status !== work.status ||
    nextRating !== work.rating ||
    favorite !== work.favorite ||
    shortReview !== work.shortReview;

  async function handleSave() {
    try {
      setIsSaving(true);
      onError(null);
      await worksService.updateWork(work.id, {
        ...createUpsertWorkInputFromRecord(work),
        favorite,
        rating: nextRating,
        shortReview,
        status,
      });
      onSuccess(t('works.record.quick.saved'));
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('works.record.quick.saveError'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const controls = (
    <>
      <Group align="flex-end" className={cn(css.detailQuickRecordFields)} grow>
        <NativeSelect
          aria-label={t('works.record.quick.statusAria', {
            title: work.title,
          })}
          label={t('works.form.statusLabel')}
          onChange={(event) =>
            setStatus(event.currentTarget.value as WorkStatus)
          }
          value={status}
        >
          {workStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t('works.record.quick.ratingAria', {
            title: work.title,
          })}
          label={t('works.form.ratingLabel')}
          onChange={(event) => setRating(event.currentTarget.value)}
          value={rating}
        >
          <option value="">{t('works.ratingMissing')}</option>
          {workRecordRatingOptions.map((option) => (
            <option key={option.value} value={option.value.toString()}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </Group>
      <TextInput
        aria-label={t('works.record.quick.shortReviewAria', {
          title: work.title,
        })}
        label={t('works.form.shortReviewLabel')}
        maxLength={500}
        onChange={(event) => setShortReview(event.currentTarget.value)}
        placeholder={t('works.record.quick.shortReviewPlaceholder')}
        value={shortReview}
      />
      <Group justify="space-between">
        <AppButton
          aria-pressed={favorite}
          onClick={() => setFavorite((current) => !current)}
          tone={favorite ? 'primary' : 'secondary'}
          type="button"
        >
          {favorite
            ? t('works.record.quick.favoriteRemove')
            : t('works.record.quick.favoriteAdd')}
        </AppButton>
        <AppButton
          disabled={!hasChanges || isSaving}
          onClick={() => void handleSave()}
          tone="primary"
          type="button"
        >
          {t('works.record.quick.save')}
        </AppButton>
      </Group>
    </>
  );

  if (variant === 'hero') {
    const titleId = `work-quick-record-${work.id}`;

    return (
      <Stack
        aria-labelledby={titleId}
        className={cn(css.detailQuickRecord)}
        component="section"
        gap="md"
      >
        <Stack gap={4}>
          <Title
            className={cn(css.detailQuickRecordTitle)}
            id={titleId}
            order={2}
          >
            {t('works.record.quick.title')}
          </Title>
          <Text c="dimmed" className={cn(css.detailQuickRecordDescription)}>
            {t('works.record.quick.description')}
          </Text>
        </Stack>
        {controls}
      </Stack>
    );
  }

  return (
    <PageSection
      description={t('works.record.quick.description')}
      eyebrow={t('works.record.quick.eyebrow')}
      title={t('works.record.quick.title')}
    >
      <SectionCard gap="md" padding="lg" tone="default">
        {controls}
      </SectionCard>
    </PageSection>
  );
}
