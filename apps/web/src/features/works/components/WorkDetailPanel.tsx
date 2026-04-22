import type { ReactNode } from 'react';
import { Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';

import type { WorkRecord } from '@work-archive/shared-types';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  KeyValueGrid,
  MetricPill,
  SectionCard,
  SectionIntro,
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
  quickEdit?: ReactNode;
  work: WorkRecord;
}

function renderRatingLabel(work: WorkRecord) {
  return work.rating === null ? '미평가' : `${work.rating.toFixed(1)}점`;
}

export function WorkDetailPanel({
  actions,
  quickEdit,
  work,
}: WorkDetailPanelProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const statusLabel = getWorkStatusLabel(work.status);
  const tierLabel = getWorkTierLabel(work.tier);
  const syncLabel = getWorkSyncStatusLabel(work.syncStatus);
  const shortReview = work.shortReview.trim();
  const review = work.review.trim();

  return (
    <Stack gap="xl">
      <SectionCard tone="hero">
        <Group align="flex-start" wrap="nowrap">
          <ArtworkPoster
            thumbnailUrl={work.thumbnailUrl}
            title={work.title}
            typeLabel={typeLabel}
            variant="detail"
          />

          <Stack flex={1} gap="lg" miw={0}>
            <ActionRow>
              <AppBadge>{typeLabel}</AppBadge>
              <AppBadge>{syncLabel}</AppBadge>
              {work.favorite && <AppBadge tone="accent">즐겨찾기</AppBadge>}
            </ActionRow>

            <div>
              <Title order={1}>{work.title}</Title>
              <Text c="var(--app-text-muted)">
                {work.author || '작가·제작자 미입력'} · 최근 수정 {formatWorkUpdatedAt(work.updatedAt)}
              </Text>
            </div>

            <ActionRow>
              <MetricPill label="상태" value={statusLabel} />
              <MetricPill label="내 평점" value={renderRatingLabel(work)} />
              <MetricPill label="티어" value={tierLabel} />
            </ActionRow>

            <SectionCard gap="sm" padding="lg" tone="subtle">
              <SectionIntro
                description={
                  shortReview
                    ? '목록과 최근 기록에서 가장 먼저 보이는 짧은 감상입니다.'
                    : '짧게 남길 감상이 아직 없습니다.'
                }
                eyebrow="한줄평"
                title={shortReview || '아직 남긴 한줄평이 없습니다.'}
                titleOrder={3}
              />
            </SectionCard>

            {actions && <ActionRow>{actions}</ActionRow>}
            {quickEdit}
          </Stack>
        </Group>
      </SectionCard>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <SectionCard>
          <SectionIntro
            description="작품 정보보다 내 감상을 먼저 읽을 수 있게 이 영역을 앞에 둡니다."
            eyebrow="상세 감상"
            title="내 감상"
          />
          <Text c={review ? 'var(--app-text-secondary)' : 'var(--app-text-muted)'}>
            {review || '아직 남긴 상세 감상이 없습니다.'}
          </Text>
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description={work.description || '작품 소개가 아직 없습니다.'}
            eyebrow="작품 소개"
            title="작품 정보"
          />
        </SectionCard>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <SectionCard>
          <SectionIntro eyebrow="기록 정보" title="내 기록과 상태" />
          <KeyValueGrid
            items={[
              { label: '현재 상태', value: statusLabel },
              { label: '별점', value: renderRatingLabel(work) },
              { label: '티어', value: tierLabel },
              { label: '즐겨찾기', value: work.favorite ? '등록함' : '없음' },
            ]}
          />
        </SectionCard>

        <SectionCard>
          <SectionIntro eyebrow="메타데이터" title="작품과 저장 정보" />
          <KeyValueGrid
            items={[
              { label: '작가·제작자', value: work.author || '미입력' },
              {
                label: '장르',
                value: work.genres.length > 0 ? work.genres.join(', ') : '없음',
              },
              { label: '유형', value: typeLabel },
              { label: '동기화 상태', value: syncLabel },
              { label: '추가한 날', value: formatWorkDateTime(work.createdAt) },
              { label: '수정한 날', value: formatWorkDateTime(work.updatedAt) },
            ]}
          />
        </SectionCard>
      </SimpleGrid>
    </Stack>
  );
}
