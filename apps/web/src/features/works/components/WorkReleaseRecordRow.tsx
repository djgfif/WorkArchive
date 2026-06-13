import { useEffect, useState } from 'react';
import { Group, NativeSelect, Stack, Text, TextInput } from '@mantine/core';
import type { UserReleaseRecord, WorkStatus } from '@work-archive/shared-types';

import { useAppTranslation } from '@app/i18n';
import { AppButton, SectionCard } from '@shared/components/AppPrimitives';
import { releaseRecordsService } from '../services/release-records.service';
import type { UserRecordReleasesResponse } from '../services/user-records.api';
import { workStatusOptions } from '../utils/work-options';
import { workRecordRatingOptions } from '../utils/work-record-rating-options';

interface WorkReleaseRecordRowProps {
  record: UserReleaseRecord | null;
  release: UserRecordReleasesResponse['releases'][number];
  workId: string;
  onError(message: string | null): void;
  onSuccess(message: string): void;
}

export function WorkReleaseRecordRow({
  record,
  release,
  workId,
  onError,
  onSuccess,
}: WorkReleaseRecordRowProps) {
  const { t } = useAppTranslation();
  const [status, setStatus] = useState<WorkStatus>(record?.status ?? 'planned');
  const [rating, setRating] = useState(record?.rating?.toString() ?? '');
  const [shortReview, setShortReview] = useState(record?.shortReview ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStatus(record?.status ?? 'planned');
    setRating(record?.rating?.toString() ?? '');
    setShortReview(record?.shortReview ?? '');
  }, [record?.id, record?.rating, record?.shortReview, record?.status]);

  async function handleSave() {
    const parsedRating = rating === '' ? null : Number.parseFloat(rating);

    try {
      setIsSaving(true);
      onError(null);
      await releaseRecordsService.upsertReleaseRecord({
        catalogReleaseId: release.id,
        rating: Number.isNaN(parsedRating) ? null : parsedRating,
        shortReview,
        status,
        userWorkRecordId: workId,
      });
      onSuccess(t('works.record.release.saved'));
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('works.record.release.saveError'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteOrRestore() {
    if (!record) {
      return;
    }

    try {
      setIsSaving(true);
      onError(null);

      if (record.deletedAt) {
        await releaseRecordsService.restoreReleaseRecord(record.id);
        onSuccess(t('works.record.release.restored'));
      } else {
        await releaseRecordsService.deleteReleaseRecord(record.id);
        onSuccess(t('works.record.release.deleted'));
      }
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('works.record.release.statusChangeError'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const label =
    release.displayLabel ||
    release.title ||
    `#${release.sequence ?? release.id}`;

  return (
    <SectionCard gap="md" padding="lg" tone="subtle">
      <Stack gap="xs">
        <Text fw={700}>{label}</Text>
        <Text c="var(--mantine-color-dimmed)" size="sm">
          {release.isbn
            ? `ISBN ${release.isbn}`
            : release.releaseType || t('works.record.release.fallbackRelease')}
          {record?.deletedAt ? t('works.record.release.deletedSuffix') : ''}
        </Text>
      </Stack>
      <Group align="flex-end" grow>
        <NativeSelect
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
          label={t('works.record.release.ratingLabel')}
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
        label={t('works.record.release.shortReviewLabel')}
        maxLength={500}
        onChange={(event) => setShortReview(event.currentTarget.value)}
        placeholder={t('works.record.release.optionalPlaceholder')}
        value={shortReview}
      />
      <Group justify="space-between">
        <Text c="var(--mantine-color-dimmed)" size="sm">
          {t('works.record.release.separateDescription')}
        </Text>
        <Group>
          {record && (
            <AppButton
              disabled={isSaving}
              onClick={() => void handleDeleteOrRestore()}
              tone="ghost"
              type="button"
            >
              {record.deletedAt
                ? t('works.record.release.restore')
                : t('works.record.release.delete')}
            </AppButton>
          )}
          <AppButton
            disabled={isSaving}
            onClick={() => void handleSave()}
            tone="primary"
            type="button"
          >
            {t('works.record.release.save')}
          </AppButton>
        </Group>
      </Group>
    </SectionCard>
  );
}
