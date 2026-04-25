import type { ReactNode } from 'react';
import { Box, Grid, Group, Paper, Stack, Text, Title } from '@mantine/core';

import type { WorkRecord } from '@work-archive/shared-types';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  KeyValueGrid,
  MetricPill,
  PageSection,
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
  children?: ReactNode;
  quickEdit?: ReactNode;
  work: WorkRecord;
}

function renderRatingLabel(work: WorkRecord) {
  return work.rating === null ? '미평가' : `${work.rating.toFixed(1)}점`;
}

export function WorkDetailPanel({
  actions,
  children,
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
              <AppBadge>{syncLabel}</AppBadge>
              {work.favorite && <AppBadge tone="accent">즐겨찾기</AppBadge>}
            </ActionRow>

            <div>
              <Title order={1}>{work.title}</Title>
              <Text c="var(--app-text-muted)">
                {work.author || '작가·제작자 미입력'} · 최근 수정 {formatWorkUpdatedAt(work.updatedAt)}
              </Text>
            </div>

            <Group align="stretch" gap="xl" wrap="wrap">
              <MetricPill label="상태" value={statusLabel} />
              <MetricPill label="내 평점" value={renderRatingLabel(work)} />
              <MetricPill label="티어" value={tierLabel} />
            </Group>

            <Paper
              p="lg"
              styles={{
                root: {
                  backgroundColor: 'var(--app-surface-1)',
                  borderColor: 'var(--app-border-color)',
                },
              }}
              withBorder
            >
              <SectionIntro
                description={undefined}
                eyebrow="한줄평"
                title={shortReview || '아직 남긴 한줄평이 없습니다.'}
                titleOrder={3}
              />
            </Paper>

            {actions && <ActionRow>{actions}</ActionRow>}
          </Stack>
        </Group>
      </SectionCard>

      <Grid align="start" gutter="xl">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="xl">
          <PageSection
            description={undefined}
            divider={false}
            eyebrow="내 기록"
            title="상세 감상"
          >
            <Text c={review ? 'var(--app-text-secondary)' : 'var(--app-text-muted)'} lh={1.8}>
              {review || '아직 남긴 상세 감상이 없습니다.'}
            </Text>
          </PageSection>

          <PageSection
            description="작품 자체의 소개와 배경은 기록 다음에 확인할 수 있도록 분리했습니다."
            eyebrow="작품 소개"
            title="메모와 소개"
          >
            <Text
              c={work.description.trim() ? 'var(--app-text-secondary)' : 'var(--app-text-muted)'}
              lh={1.8}
            >
              {work.description.trim() || '작품 소개가 아직 없습니다.'}
            </Text>
          </PageSection>

            {children}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="lg">
            {quickEdit && (
              <SectionCard gap="md" padding="lg" tone="default">
                {quickEdit}
              </SectionCard>
            )}

            <SectionCard gap="lg" padding="lg" tone="subtle">
              <PageSection divider={false} eyebrow="기록 정보" title="내 상태" titleOrder={3}>
                <KeyValueGrid
                  columns={1}
                  items={[
                    { label: '현재 상태', value: statusLabel },
                    { label: '별점', value: renderRatingLabel(work) },
                    { label: '티어', value: tierLabel },
                    { label: '즐겨찾기', value: work.favorite ? '등록함' : '없음' },
                  ]}
                />
              </PageSection>

              <PageSection eyebrow="메타데이터" title="작품과 저장 정보" titleOrder={3}>
                <KeyValueGrid
                  columns={1}
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
              </PageSection>
            </SectionCard>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
