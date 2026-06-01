import { useEffect, useState } from 'react';
import { Group, NativeSelect, TextInput } from '@mantine/core';
import type { WorkRecord, WorkStatus } from '@work-archive/shared-types';

import {
  AppButton,
  PageSection,
  SectionCard,
} from '@shared/components/AppPrimitives';
import { worksService } from '../services/works.service';
import { workStatusOptions } from '../utils/work-options';
import { createUpsertWorkInputFromRecord } from '../utils/work-form';
import { workRecordRatingOptions } from '../utils/work-record-rating-options';

interface WorkQuickRecordSectionProps {
  onError(message: string | null): void;
  onSuccess(message: string): void;
  work: WorkRecord;
}

export function WorkQuickRecordSection({
  onError,
  onSuccess,
  work,
}: WorkQuickRecordSectionProps) {
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
      onSuccess('빠른 기록을 저장했습니다.');
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '빠른 기록을 저장하지 못했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageSection
      description="상태, 별점, 즐겨찾기, 한줄평만 바로 저장합니다. 줄거리와 제작 정보는 전체 정보 수정에서 다룹니다."
      eyebrow="바로 수정"
      title="빠른 기록"
    >
      <SectionCard gap="md" padding="lg" tone="default">
        <Group align="flex-end" grow>
          <NativeSelect
            aria-label={`${work.title} 빠른 상태`}
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
            aria-label={`${work.title} 빠른 별점`}
            label="별점"
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
          aria-label={`${work.title} 빠른 한줄평`}
          label="한줄평"
          maxLength={500}
          onChange={(event) => setShortReview(event.currentTarget.value)}
          placeholder="짧게 남겨두기"
          value={shortReview}
        />
        <Group justify="space-between">
          <AppButton
            aria-pressed={favorite}
            onClick={() => setFavorite((current) => !current)}
            tone={favorite ? 'primary' : 'secondary'}
            type="button"
          >
            {favorite ? '즐겨찾기 해제' : '즐겨찾기'}
          </AppButton>
          <AppButton
            disabled={!hasChanges || isSaving}
            onClick={() => void handleSave()}
            tone="primary"
            type="button"
          >
            빠른 기록 저장
          </AppButton>
        </Group>
      </SectionCard>
    </PageSection>
  );
}
