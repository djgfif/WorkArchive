import { useState, type ReactNode } from 'react';
import { Badge, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';

import type { WorkRecord } from '@work-archive/shared-types';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppButton,
  KeyValueGrid,
  SectionCard,
  SectionIntro,
  StatCard,
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

interface ReviewSectionProps {
  body: string;
  collapsedLabel: string;
  emptyCopy: string;
  expandedLabel: string;
  eyebrow: string;
  previewMaxLength?: number;
  previewFallback: string;
  title: string;
}

function summarizeText(value: string, maxLength = 92) {
  const normalizedValue = value.trim().replace(/\s+/g, ' ');

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength).trimEnd()}...`;
}

function ReviewSection({
  body,
  collapsedLabel,
  emptyCopy,
  expandedLabel,
  eyebrow,
  previewMaxLength,
  previewFallback,
  title,
}: ReviewSectionProps) {
  const trimmedBody = body.trim();
  const hasContent = trimmedBody !== '';
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <SectionCard tone="subtle">
      <Group align="flex-start" justify="space-between" wrap="wrap">
        <SectionIntro
          description={hasContent ? summarizeText(trimmedBody, previewMaxLength) : previewFallback}
          eyebrow={eyebrow}
          title={title}
          titleOrder={3}
        />

        {hasContent ? (
          <AppButton
            onClick={() => setIsExpanded((currentValue) => !currentValue)}
            tone="ghost"
            type="button"
          >
            {isExpanded ? expandedLabel : collapsedLabel}
          </AppButton>
        ) : null}
      </Group>

      {hasContent ? (
        isExpanded ? (
          <Text c="var(--app-text-secondary)">{trimmedBody}</Text>
        ) : null
      ) : (
        <Text c="var(--app-text-muted)">{emptyCopy}</Text>
      )}
    </SectionCard>
  );
}

function getPrimaryRecord(work: WorkRecord, statusLabel: string) {
  if (work.rating !== null) {
    return {
      description:
        work.status === 'completed'
          ? '완료한 작품으로 기록된 감상입니다.'
          : `${statusLabel} 상태에서 남긴 평점입니다.`,
      label: '내 평점',
      value: `${work.rating.toFixed(1)}점`,
    };
  }

  return {
    description:
      work.status === 'planned'
        ? '아직 보기 전이라 상태를 먼저 보여줍니다.'
        : '평점을 남기기 전이라 상태를 먼저 보여줍니다.',
    label: '현재 상태',
    value: statusLabel,
  };
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
  const primaryRecord = getPrimaryRecord(work, statusLabel);

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
            <Group gap="xs" wrap="wrap">
              <Badge>{typeLabel}</Badge>
              <Badge>{syncLabel}</Badge>
              {work.favorite && <Badge color="archive">즐겨찾기</Badge>}
            </Group>

            <Stack gap={6}>
              <Title order={1}>{work.title}</Title>
              <Text c="var(--app-text-muted)">
                {work.author || '작가·제작자 미입력'} · 최근 수정{' '}
                {formatWorkUpdatedAt(work.updatedAt)}
              </Text>
            </Stack>

            <SectionCard gap={6} padding="lg" tone="subtle">
              <Text c="var(--app-accent)" fw={700} fz="0.78rem" lts="0.12em" tt="uppercase">
                {primaryRecord.label}
              </Text>
              <Title order={2}>{primaryRecord.value}</Title>
              <Text c="var(--app-text-muted)">{primaryRecord.description}</Text>
            </SectionCard>

            <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
              <StatCard label="상태" value={statusLabel} />
              <StatCard label="타입" value={typeLabel} />
              <StatCard label="한줄평" value={work.shortReview.trim() ? '있음' : '없음'} />
              <StatCard label="상세 감상" value={work.review.trim() ? '있음' : '없음'} />
            </SimpleGrid>

            {quickEdit}

            {actions && <ActionRow>{actions}</ActionRow>}
          </Stack>
        </Group>
      </SectionCard>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <ReviewSection
          body={work.shortReview}
          collapsedLabel="한줄평 펼치기"
          emptyCopy="아직 남긴 한줄평이 없습니다."
          expandedLabel="한줄평 접기"
          eyebrow="감상"
          previewMaxLength={72}
          previewFallback="짧게 남기는 감상은 아직 없습니다."
          title="한줄평"
        />
        <ReviewSection
          body={work.review}
          collapsedLabel="상세 감상 펼치기"
          emptyCopy="아직 남긴 상세 감상이 없습니다."
          expandedLabel="상세 감상 접기"
          eyebrow="리뷰"
          previewMaxLength={42}
          previewFallback="상세 감상은 접어두고 필요할 때 펼쳐보는 구조로 준비했습니다."
          title="상세 감상"
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <SectionCard>
          <SectionIntro eyebrow="기록 요약" title="내 기록 정보" />
          <KeyValueGrid
            items={[
              { label: '현재 상태', value: statusLabel },
              {
                label: '별점',
                value: work.rating === null ? '아직 안 매김' : `${work.rating.toFixed(1)}점`,
              },
              { label: '티어', value: tierLabel },
              { label: '즐겨찾기', value: work.favorite ? '등록함' : '없음' },
            ]}
          />
        </SectionCard>

        <SectionCard>
          <SectionIntro
            description={work.description || '작품 소개가 아직 없습니다.'}
            eyebrow="작품 소개"
            title="간단한 소개"
          />
        </SectionCard>

        <SectionCard>
          <SectionIntro eyebrow="작품 정보" title="기본 메타데이터" />
          <KeyValueGrid
            items={[
              { label: '작가·제작자', value: work.author || '미입력' },
              {
                label: '장르',
                value: work.genres.length > 0 ? work.genres.join(', ') : '없음',
              },
              { label: '유형', value: typeLabel },
            ]}
          />
        </SectionCard>

        <SectionCard>
          <SectionIntro eyebrow="저장 정보" title="저장 및 동기화" />
          <KeyValueGrid
            items={[
              { label: '동기화 상태', value: syncLabel },
              { label: '추가한 날', value: formatWorkDateTime(work.createdAt) },
              { label: '수정한 날', value: formatWorkDateTime(work.updatedAt) },
              { label: '서버 버전', value: work.serverVersion },
            ]}
          />
        </SectionCard>
      </SimpleGrid>
    </Stack>
  );
}
