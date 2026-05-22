import { useState } from 'react';
import { Group, Stack, Text, Title } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

import type { WorkRecord } from '@work-archive/shared-types';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  SectionCard,
  SectionIntro,
} from '../../../shared/components/AppPrimitives';
import { PageHero } from '../../../shared/components/PageHero';
import { FlowPageTemplate } from '../../../shared/components/PageTemplates';
import { useAuthSession } from '../../auth';
import { syncQueueRepository } from '../../sync';
import { AddWorkFlow } from '../components/AddWorkFlow';
import { buildWorkFormDraftKey } from '../services/work-form-draft.service';
import { worksService } from '../services/works.service';
import type { UpsertWorkInput } from '../utils/work-form';
import {
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

export function WorkCreatePage() {
  const navigate = useNavigate();
  const { archiveScopeKey, mode } = useAuthSession();
  const [formVersion, setFormVersion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedWork, setSavedWork] = useState<WorkRecord | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const draftKey = buildWorkFormDraftKey({
    archiveScopeKey,
    focusArea: 'general',
    mode: 'create',
  });

  async function handleSubmit(input: UpsertWorkInput) {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const work = await worksService.createWork(input);
      const hasQueuedWork =
        mode === 'authenticated' &&
        (await syncQueueRepository.hasQueuedWork(work.id));

      setSavedWork(work);
      setSaveFeedback(
        hasQueuedWork ? '로컬에 저장됨 · 백업 대기 중' : '로컬에 저장됨',
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : '작품을 추가하지 못했습니다.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FlowPageTemplate>
      <PageHero
        actions={<AppLinkButton to="/works">작품으로 돌아가기</AppLinkButton>}
        description="제목만 입력해도 바로 저장할 수 있습니다. 검색은 필요할 때만 작품 정보를 채우는 보조 도구입니다."
        eyebrow="빠른 기록"
        title="작품 추가"
      />

      {savedWork ? (
        <SectionCard gap="lg" padding="xl" tone="default">
          <SectionIntro
            description="방금 저장한 기록을 바로 확인하거나, 같은 흐름에서 다음 작품을 계속 추가할 수 있습니다."
            eyebrow="저장 완료"
            title={`${savedWork.title}을(를) 등록했습니다`}
          />

          {saveFeedback && (
            <FeedbackMessage tone="success">{saveFeedback}</FeedbackMessage>
          )}

          <Group align="flex-start" gap="md" wrap="nowrap">
            <ArtworkPoster
              thumbnailUrl={savedWork.thumbnailUrl}
              title={savedWork.title}
              typeLabel={getWorkTypeLabel(savedWork.type)}
              variant="row"
            />

            <Stack gap="sm" miw={0}>
              <ActionRow>
                <AppBadge>{getWorkTypeLabel(savedWork.type)}</AppBadge>
                <AppBadge>{getWorkStatusLabel(savedWork.status)}</AppBadge>
                <AppBadge>
                  {savedWork.rating === null ? '미평가' : `${savedWork.rating.toFixed(1)}점`}
                </AppBadge>
              </ActionRow>

              <div>
                <Title order={3}>{savedWork.title}</Title>
                <Text c="var(--mantine-color-dimmed)">
                  {savedWork.author || '작가·제작자 미입력'}
                </Text>
              </div>
            </Stack>
          </Group>

          <ActionRow>
            <AppButton
              onClick={() => {
                setSavedWork(null);
                setSaveFeedback(null);
                setSubmitError(null);
                setFormVersion((currentValue) => currentValue + 1);
              }}
              tone="primary"
              type="button"
            >
              계속 추가
            </AppButton>
            <AppButton onClick={() => navigate(`/works/${savedWork.id}`)} type="button">
              방금 등록한 작품 보기
            </AppButton>
            <AppLinkButton to="/works" tone="quiet">
              작품 목록 보기
            </AppLinkButton>
          </ActionRow>
        </SectionCard>
      ) : (
        <AddWorkFlow
          draftKey={draftKey}
          isSubmitting={isSubmitting}
          key={formVersion}
          onSubmit={handleSubmit}
          submitError={submitError}
        />
      )}
    </FlowPageTemplate>
  );
}
