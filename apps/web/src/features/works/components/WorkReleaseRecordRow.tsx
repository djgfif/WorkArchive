import { useEffect, useState } from 'react';
import { Group, NativeSelect, Stack, Text, TextInput } from '@mantine/core';
import type {
  UserReleaseRecord,
  WorkStatus,
} from '@work-archive/shared-types';

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
      onSuccess('권별 기록을 저장했습니다.');
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '권별 기록을 저장하지 못했습니다.',
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
        onSuccess('권별 기록을 복원했습니다.');
      } else {
        await releaseRecordsService.deleteReleaseRecord(record.id);
        onSuccess('권별 기록을 삭제했습니다.');
      }
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '권별 기록 상태를 바꾸지 못했습니다.',
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
            : release.releaseType || '하위 릴리스'}
          {record?.deletedAt ? ' · 삭제됨' : ''}
        </Text>
      </Stack>
      <Group align="flex-end" grow>
        <NativeSelect
          label="상태"
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
          label="권별 별점"
          onChange={(event) => setRating(event.currentTarget.value)}
          value={rating}
        >
          <option value="">미평가</option>
          {workRecordRatingOptions.map((option) => (
            <option key={option.value} value={option.value.toString()}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </Group>
      <TextInput
        label="권별 짧은 감상"
        maxLength={500}
        onChange={(event) => setShortReview(event.currentTarget.value)}
        placeholder="선택 입력"
        value={shortReview}
      />
      <Group justify="space-between">
        <Text c="var(--mantine-color-dimmed)" size="sm">
          이 기록은 작품 전체 별점/리뷰와 별도로 저장됩니다.
        </Text>
        <Group>
          {record && (
            <AppButton
              disabled={isSaving}
              onClick={() => void handleDeleteOrRestore()}
              tone="ghost"
              type="button"
            >
              {record.deletedAt ? '복원' : '삭제'}
            </AppButton>
          )}
          <AppButton
            disabled={isSaving}
            onClick={() => void handleSave()}
            tone="primary"
            type="button"
          >
            권별 기록 저장
          </AppButton>
        </Group>
      </Group>
    </SectionCard>
  );
}
