import type { ReactNode } from 'react';
import { Box, Group, Progress, Stack, Text, Title } from '@mantine/core';

import type { WorkRecord } from '@work-archive/shared-types';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppLinkButton,
  KeyValueGrid,
  MetricPill,
  PageSection,
  SectionCard,
} from '../../../shared/components/AppPrimitives';
import {
  formatWorkDateTime,
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkSyncStatusLabel,
  getWorkTierLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

interface WorkDetailPanelProps {
  actions?: ReactNode;
  recordSections?: ReactNode;
  relatedSections?: ReactNode;
  work: WorkRecord;
}

function renderRatingLabel(work: WorkRecord) {
  return work.rating === null ? '미평가' : `${work.rating.toFixed(1)}점`;
}

function getProgressPercent(work: WorkRecord) {
  const current = work.progressCurrent ?? null;
  const total = work.progressTotal ?? null;

  if (current === null || total === null || total <= 0) {
    return null;
  }

  return Math.min(100, Math.round((current / total) * 100));
}

function getProgressLabel(work: WorkRecord) {
  if (work.lastConsumedLabel) {
    return work.lastConsumedLabel;
  }

  const current = work.progressCurrent ?? null;
  const total = work.progressTotal ?? null;

  if (current !== null && total !== null) {
    return `${current}/${total}`;
  }

  if (current !== null) {
    return `${current}까지 기록`;
  }

  return null;
}

export function WorkDetailPanel({
  actions,
  recordSections,
  relatedSections,
  work,
}: WorkDetailPanelProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const statusLabel = getWorkStatusLabel(work.status);
  const tierLabel = getWorkTierLabel(work.tier);
  const syncLabel = getWorkSyncStatusLabel(work.syncStatus);
  const shortReview = work.shortReview.trim();
  const review = work.review.trim();
  const progressLabel = getProgressLabel(work);
  const progressPercent = getProgressPercent(work);
  const sourceIdentityLabel = work.catalogTitleId
    ? '카탈로그 연결됨'
    : work.importDraft
      ? '외부 검색 초안'
      : '직접 기록';

  return (
    <Stack gap="xl">
      <SectionCard gap="lg" padding="xl" tone="hero">
        <Group align="flex-start" gap="xl" wrap="wrap">
          <Box
            style={{
              flex: '0 0 clamp(11rem, 22vw, 15rem)',
              maxWidth: '100%',
            }}
          >
            <ArtworkPoster
              thumbnailUrl={work.thumbnailUrl}
              title={work.title}
              typeLabel={typeLabel}
              variant="detail"
            />
          </Box>

          <Stack flex={1} gap="lg" miw={0} style={{ minWidth: 'min(100%, 26rem)' }}>
            <ActionRow>
              <AppBadge>{typeLabel}</AppBadge>
              <AppBadge tone="accent">{statusLabel}</AppBadge>
              {work.favorite && <AppBadge tone="accent">즐겨찾기</AppBadge>}
            </ActionRow>

            <div>
              <Title order={1}>{work.title}</Title>
              <Text c="var(--app-text-muted)">
                {work.author || '작가·제작자 미입력'} · 최근 수정 {formatWorkUpdatedAt(work.updatedAt)}
              </Text>
            </div>

            <ActionRow>
              <MetricPill label="별점" value={renderRatingLabel(work)} />
              <MetricPill label="상태" value={statusLabel} />
              {progressLabel && <MetricPill label="진행도" value={progressLabel} />}
            </ActionRow>

            {progressPercent !== null && (
              <Stack gap={4}>
                <Text c="var(--app-text-muted)" fw={700} size="sm">
                  진행률 {progressPercent}%
                </Text>
                <Progress
                  aria-label={`${work.title} 상세 진행도 ${progressPercent}%`}
                  color="archive"
                  radius="xl"
                  size="sm"
                  value={progressPercent}
                />
              </Stack>
            )}

            {actions && <ActionRow>{actions}</ActionRow>}
          </Stack>
        </Group>
      </SectionCard>

      <PageSection
        description="작품 소개보다 내가 남긴 기록을 먼저 읽는 화면입니다."
        divider={false}
        eyebrow="내 기록"
        title="감상 기록"
      >
        <SectionCard gap="lg" padding="lg" tone="default">
          <Stack gap="lg">
            <Stack gap="xs">
              <Text c="var(--app-text-muted)" fw={700} size="sm">
                한줄평
              </Text>
              <Title
                c={shortReview ? 'var(--app-text-strong)' : 'var(--app-text-muted)'}
                order={3}
              >
                {shortReview || '아직 남긴 한줄평이 없습니다.'}
              </Title>
            </Stack>

            <Stack gap="xs">
              <Text c="var(--app-text-muted)" fw={700} size="sm">
                상세 감상
              </Text>
              <Text
                c={review ? 'var(--app-text-secondary)' : 'var(--app-text-muted)'}
                lh={1.8}
              >
                {review || '아직 남긴 상세 감상이 없습니다.'}
              </Text>
            </Stack>

            <Stack gap="xs">
              <Text c="var(--app-text-muted)" fw={700} size="sm">
                개인 태그
              </Text>
              {work.personalTags.length > 0 ? (
                <ActionRow>
                  {work.personalTags.map((tag) => (
                    <AppBadge key={tag} tone="muted">
                      {tag}
                    </AppBadge>
                  ))}
                </ActionRow>
              ) : (
                <Text c="var(--app-text-muted)">
                  아직 개인 태그를 남기지 않았습니다.
                </Text>
              )}
            </Stack>

            <ActionRow>
              <AppLinkButton to={`/works/${work.id}/edit?focus=review`} tone="primary">
                {shortReview || review ? '리뷰 수정' : '리뷰 쓰기'}
              </AppLinkButton>
              <AppLinkButton to={`/works/${work.id}/edit`} tone="quiet">
                기록 수정
              </AppLinkButton>
            </ActionRow>
          </Stack>
        </SectionCard>

        {recordSections}
      </PageSection>

      <PageSection
        description="날짜 필드와 자동 이벤트 저장 모델이 들어오면 시작, 진행, 완료, 리뷰 수정 흐름을 이곳에서 시간순으로 보여줍니다."
        eyebrow="감상 이력"
        title="타임라인"
      >
        <SectionCard gap="md" padding="lg" tone="subtle">
          <Stack gap="sm">
            <ActionRow>
              <AppBadge tone="muted">준비 중</AppBadge>
              <Text c="var(--app-text-muted)" size="sm">
                지금은 최근 수정일과 진행도 기록을 기준으로만 확인할 수 있습니다.
              </Text>
            </ActionRow>
            <KeyValueGrid
              columns={2}
              items={[
                { label: '추가한 날', value: formatWorkDateTime(work.createdAt) },
                { label: '최근 수정', value: formatWorkDateTime(work.updatedAt) },
                { label: '진행도', value: progressLabel ?? '아직 없음' },
                { label: '현재 상태', value: statusLabel },
              ]}
            />
          </Stack>
        </SectionCard>
      </PageSection>

      <PageSection
        description="작품의 기본 메타데이터와 저장 정보를 차분하게 정리합니다."
        eyebrow="작품 정보"
        title="작품과 저장 정보"
      >
        <SectionCard gap="lg" padding="lg" tone="subtle">
          <KeyValueGrid
            columns={2}
            items={[
              { label: '작가·제작자', value: work.author || '미입력' },
              {
                label: '장르',
                value: work.genres.length > 0 ? work.genres.join(', ') : '없음',
              },
              {
                label: '설명',
                value: work.description.trim() || '작품 소개가 아직 없습니다.',
              },
              { label: '식별 방식', value: sourceIdentityLabel },
              { label: '티어', value: tierLabel },
              { label: '동기화 상태', value: syncLabel },
              { label: '추가한 날', value: formatWorkDateTime(work.createdAt) },
              { label: '수정한 날', value: formatWorkDateTime(work.updatedAt) },
            ]}
          />
        </SectionCard>
      </PageSection>

      {relatedSections}
    </Stack>
  );
}
