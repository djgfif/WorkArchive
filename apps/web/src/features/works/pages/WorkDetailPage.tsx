import { useState } from 'react';
import { NativeSelect, Stack, Text } from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';

import {
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  SectionIntro,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { DetailPageTemplate } from '../../../shared/components/PageTemplates';
import { confirmDialogAdapter } from '../../../shared/runtime/dialog-adapter';
import { WorkDetailPanel } from '../components/WorkDetailPanel';
import { useWorkDetail } from '../hooks/useWorkDetail';
import { worksService } from '../services/works.service';
import { createUpsertWorkInputFromRecord } from '../utils/work-form';
import { workStatusOptions } from '../utils/work-options';

const ratingOptions = Array.from({ length: 10 }, (_, index) => {
  const value = (index + 1) * 0.5;

  return {
    label: `${value.toFixed(1)}점`,
    value,
  };
});

export function WorkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { error, isLoading, work } = useWorkDetail(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isQuickUpdating, setIsQuickUpdating] = useState(false);

  async function handleDelete() {
    if (!work) {
      return;
    }

    const shouldDelete = await confirmDialogAdapter.confirm({
      description: '현재는 목록에서 숨겨집니다.',
      title: `"${work.title}"을 삭제할까요?`,
    });

    if (!shouldDelete) {
      return;
    }

    try {
      setActionError(null);
      await worksService.deleteWork(work.id);
      navigate('/works');
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : '작품을 삭제하지 못했습니다.',
      );
    }
  }

  async function handleQuickUpdate(nextValues: {
    rating?: number | null;
    status?: (typeof workStatusOptions)[number]['value'];
  }) {
    if (!work) {
      return;
    }

    try {
      setActionError(null);
      setIsQuickUpdating(true);

      const latestWork = await worksService.getWorkById(work.id);

      if (!latestWork) {
        throw new Error('작품을 찾을 수 없습니다.');
      }

      await worksService.updateWork(work.id, {
        ...createUpsertWorkInputFromRecord(latestWork),
        ...nextValues,
      });
    } catch (updateError) {
      setActionError(
        updateError instanceof Error
          ? updateError.message
          : '작품 기록을 바로 수정하지 못했습니다.',
      );
    } finally {
      setIsQuickUpdating(false);
    }
  }

  if (error) {
    return (
      <StateMessage
        description={error}
        title="작품 정보를 불러오지 못했습니다."
        tone="error"
      />
    );
  }

  if (isLoading) {
    return (
      <StateMessage
        description="잠시만 기다려주세요."
        title="작품 정보를 불러오는 중입니다."
        tone="loading"
      />
    );
  }

  if (!work) {
    return (
      <StateMessage
        actions={
          <AppLinkButton to="/works" tone="primary">
            작품으로 돌아가기
          </AppLinkButton>
        }
        description="삭제되었거나 주소가 올바르지 않을 수 있습니다."
        eyebrow="찾을 수 없음"
        title="해당 작품을 찾을 수 없습니다."
        tone="info"
      />
    );
  }

  return (
    <DetailPageTemplate>
      {actionError && <FeedbackMessage tone="error">{actionError}</FeedbackMessage>}

      <WorkDetailPanel
        actions={
          <>
            <AppLinkButton to="/works" tone="quiet">
              작품으로 돌아가기
            </AppLinkButton>
            <AppLinkButton to={`/works/${work.id}/edit?focus=review`} tone="primary">
              {work.shortReview.trim() || work.review.trim() ? '리뷰 수정' : '리뷰 쓰기'}
            </AppLinkButton>
            <AppLinkButton to={`/works/${work.id}/edit`} tone="ghost">
              수정
            </AppLinkButton>
            <AppButton onClick={() => void handleDelete()} tone="danger" type="button">
              삭제
            </AppButton>
          </>
        }
        quickEdit={
          <Stack gap="md">
            <SectionIntro
              description="상태와 별점은 여기서 바로 반영하고, 긴 리뷰 수정은 상단 액션에서 이어집니다."
              eyebrow="빠른 수정"
              title="기록 상태 조정"
              titleOrder={3}
            />

            <NativeSelect
              aria-label={`${work.title} 상세 상태`}
              disabled={isQuickUpdating}
              id={`detail-status-${work.id}`}
              label="상태"
              onChange={(event) =>
                void handleQuickUpdate({
                  status: event.currentTarget
                    .value as (typeof workStatusOptions)[number]['value'],
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

            <NativeSelect
              aria-label={`${work.title} 상세 별점`}
              disabled={isQuickUpdating}
              id={`detail-rating-${work.id}`}
              label="별점"
              onChange={(event) => {
                const nextValue =
                  event.currentTarget.value === ''
                    ? null
                    : Number.parseFloat(event.currentTarget.value);

                void handleQuickUpdate({
                  rating: Number.isNaN(nextValue) ? null : nextValue,
                });
              }}
              value={work.rating?.toString() ?? ''}
            >
              <option value="">미평가</option>
              {ratingOptions.map((option) => (
                <option key={option.value} value={option.value.toString()}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>

            <Text c="var(--app-text-muted)" size="sm">
              {isQuickUpdating
                ? '변경 사항을 반영하고 있습니다.'
                : '상태와 별점은 저장 없이 즉시 반영됩니다.'}
            </Text>
          </Stack>
        }
        work={work}
      />
    </DetailPageTemplate>
  );
}
