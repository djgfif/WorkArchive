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
  MetricPill,
  SectionCard,
  SectionIntro,
} from '../../../shared/components/AppPrimitives';
import { PageHero } from '../../../shared/components/PageHero';
import { FlowPageTemplate } from '../../../shared/components/PageTemplates';
import { QuickAddWorkForm } from '../components/QuickAddWorkForm';
import { worksService } from '../services/works.service';
import type { UpsertWorkInput } from '../utils/work-form';
import {
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

export function WorkCreatePage() {
  const navigate = useNavigate();
  const [formVersion, setFormVersion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedWork, setSavedWork] = useState<WorkRecord | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(input: UpsertWorkInput) {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const work = await worksService.createWork(input);

      setSavedWork(work);
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
        description="검색에서 후보를 고른 뒤, 자동 채움 초안을 확인하고 개인 기록만 남기는 흐름입니다."
        eyebrow="작품 추가"
        meta={
          <>
            <MetricPill label="흐름" value="검색 우선" />
            <MetricPill label="최소 입력" value="상태 · 별점 · 한줄평" />
          </>
        }
        title="새 작품 기록"
      />

      {savedWork ? (
        <SectionCard gap="lg" tone="hero">
          <SectionIntro
            description="계속 추가하거나, 방금 등록한 작품 상세로 바로 이동할 수 있습니다."
            eyebrow="저장 완료"
            title={`${savedWork.title}을(를) 등록했습니다`}
          />

          <Group align="flex-start" wrap="nowrap">
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
                <Text c="var(--app-text-muted)">{savedWork.author || '작가·제작자 미입력'}</Text>
              </div>
            </Stack>
          </Group>

          <ActionRow>
            <AppButton
              onClick={() => {
                setSavedWork(null);
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
        <QuickAddWorkForm
          isSubmitting={isSubmitting}
          key={formVersion}
          onSubmit={handleSubmit}
          submitError={submitError}
        />
      )}
    </FlowPageTemplate>
  );
}
