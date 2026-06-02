import { useState, type ReactNode } from 'react';
import { Group, Stack, Tabs, Text } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  ActionRow,
  AppBadge,
  AppLinkButton,
  KeyValueGrid,
  SectionCard,
} from '@shared/components/AppPrimitives';
import { formatWorkDate, formatWorkDateTime } from '../utils/work-options';
import { ReviewNoteCard } from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';
import type { WorkDetailTimelineItem } from '../utils/work-detail-timeline';
import { cn } from '@shared/utils/class-names';

const css = styles;

export interface WorkDetailContributorEntry {
  key: string;
  label: string;
  value: string;
}

interface WorkDetailTabsProps {
  contributorEntries: WorkDetailContributorEntry[];
  contributorValues: string[];
  latestTimelineItem: WorkDetailTimelineItem | null;
  overviewSections?: ReactNode;
  personalTags: string[];
  progressLabel: string | null;
  progressSections?: ReactNode;
  relatedSections?: ReactNode;
  review: string;
  seriesTags: string[];
  shortReview: string;
  sourceIdentityLabel: string;
  statusLabel: string;
  timelinePanel: ReactNode;
  typeLabel: string;
  work: WorkRecord;
}

export function WorkDetailTabs({
  contributorEntries,
  contributorValues,
  latestTimelineItem,
  overviewSections,
  personalTags,
  progressLabel,
  progressSections,
  relatedSections,
  review,
  seriesTags,
  shortReview,
  sourceIdentityLabel,
  statusLabel,
  timelinePanel,
  typeLabel,
  work,
}: WorkDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<string | null>('overview');

  return (
    <Tabs
      classNames={{
        root: cn(css.detailTabs),
        list: cn(css.detailTabsList),
        tab: cn(css.detailTab),
      }}
      keepMounted={false}
      onChange={setActiveTab}
      value={activeTab}
    >
      <Tabs.List>
        <Tabs.Tab value="overview">내 기록</Tabs.Tab>
        <Tabs.Tab value="review">감상</Tabs.Tab>
        <Tabs.Tab value="progress">진행도</Tabs.Tab>
        <Tabs.Tab value="related">연결된 작품</Tabs.Tab>
        <Tabs.Tab value="timeline">타임라인</Tabs.Tab>
        <Tabs.Tab value="metadata">메타데이터</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="overview">
        <Stack gap="md">
          <SectionCard padding="md" tone="default">
            <KeyValueGrid
              columns={2}
              items={[
                { label: '유형', value: typeLabel },
                { label: '상태', value: statusLabel },
                {
                  label: '별점',
                  value:
                    work.rating !== null
                      ? `${work.rating.toFixed(1)} / 5.0`
                      : '미평가',
                },
                { label: '진행도', value: progressLabel ?? '아직 없음' },
                {
                  label: '최근 기록',
                  value: latestTimelineItem
                    ? `${formatWorkDate(latestTimelineItem.value)} · ${latestTimelineItem.label}`
                    : '아직 남긴 진행 기록이 없습니다.',
                },
                {
                  label: '한줄평',
                  value: shortReview || '아직 남긴 한줄평이 없습니다.',
                },
              ]}
            />
          </SectionCard>

          {overviewSections}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="review">
        <Stack gap="md">
          <ReviewNoteCard
            emptyLabel="아직 남긴 한줄평이 없습니다."
            label="한줄평"
            value={shortReview}
          />
          <ReviewNoteCard
            emptyLabel="아직 남긴 상세 감상이 없습니다."
            label="상세 감상"
            value={review}
          />

          <SectionCard gap="sm" padding="md" tone="subtle">
            <Text c="dimmed" fw={700} mb={6} size="sm">
              개인 태그
            </Text>
            {personalTags.length > 0 ? (
              <Group gap={6} wrap="wrap">
                {personalTags.map((tag) => (
                  <AppBadge key={tag} tone="success">
                    {tag}
                  </AppBadge>
                ))}
              </Group>
            ) : (
              <Text c="dimmed" size="sm">
                아직 개인 태그를 남기지 않았습니다.
              </Text>
            )}
          </SectionCard>

          <ActionRow>
            <AppLinkButton
              to={`/works/${work.id}/edit?focus=review`}
              tone="primary"
            >
              {shortReview || review ? '리뷰 수정' : '리뷰 쓰기'}
            </AppLinkButton>
            <AppLinkButton to={`/works/${work.id}/edit`} tone="quiet">
              기록 수정
            </AppLinkButton>
          </ActionRow>
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="progress">
        <Stack gap="md">
          <SectionCard gap="md" padding="md" tone="subtle">
            <KeyValueGrid
              columns={2}
              items={[
                { label: '현재 상태', value: statusLabel },
                { label: '진행도', value: progressLabel ?? '아직 없음' },
                { label: '시작일', value: formatWorkDate(work.startedAt) },
                { label: '완료일', value: formatWorkDate(work.completedAt) },
                { label: '하차일', value: formatWorkDate(work.droppedAt) },
                {
                  label: '최근 기록일',
                  value: formatWorkDate(work.lastConsumedAt),
                },
              ]}
            />
          </SectionCard>
          {progressSections}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="related">
        <Stack gap="md">
          <SectionCard padding="md" tone="subtle">
            <Text c="dimmed" size="sm">
              같은 시리즈, 제작진, 카탈로그 관계로 이어지는 작품을 나눠서
              확인합니다.
            </Text>
          </SectionCard>
          {relatedSections}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="timeline">{timelinePanel}</Tabs.Panel>

      <Tabs.Panel value="metadata">
        <Stack gap="md">
          {(seriesTags.length > 0 || contributorValues.length > 0) && (
            <Group gap={6} wrap="wrap">
              {seriesTags.slice(0, 12).map((series) => (
                <AppBadge key={`series-chip-${series}`} tone="accent">
                  {series}
                </AppBadge>
              ))}
              {contributorValues.slice(0, 12).map((contributor) => (
                <AppBadge
                  key={`contributor-chip-${contributor}`}
                  tone="success"
                >
                  {contributor}
                </AppBadge>
              ))}
            </Group>
          )}

          {work.genres.length > 0 && (
            <Group gap={6} wrap="wrap">
              {work.genres.map((genre) => (
                <AppBadge key={genre} tone="accent">
                  {genre}
                </AppBadge>
              ))}
            </Group>
          )}

          <SectionCard gap="lg" padding="lg" tone="subtle">
            <KeyValueGrid
              columns={2}
              items={[
                { label: '작가·제작자', value: work.author || '미입력' },
                {
                  label: '장르',
                  value:
                    work.genres.length > 0 ? work.genres.join(', ') : '없음',
                },
                {
                  label: '작품 소개',
                  value:
                    work.description.trim() || '작품 소개가 아직 없습니다.',
                },
                { label: '식별 방식', value: sourceIdentityLabel },
                {
                  label: '추가한 날',
                  value: formatWorkDateTime(work.createdAt),
                },
                {
                  label: '수정한 날',
                  value: formatWorkDateTime(work.updatedAt),
                },
              ]}
            />
          </SectionCard>

          {(seriesTags.length > 0 ||
            contributorEntries.length > 0 ||
            work.author.trim()) && (
            <SectionCard gap="md" padding="lg" tone="subtle">
              <Stack gap="sm">
                <Text c="dimmed" fw={800} size="sm">
                  제작 정보
                </Text>
                {seriesTags.length > 0 && (
                  <Group gap={6} wrap="wrap">
                    {seriesTags.map((series) => (
                      <AppBadge key={`info-series-${series}`} tone="accent">
                        시리즈: {series}
                      </AppBadge>
                    ))}
                  </Group>
                )}
                {contributorEntries.length > 0 ? (
                  <Stack gap={6}>
                    {contributorEntries.map((entry) => (
                      <Text key={entry.key} size="sm">
                        <Text c="dimmed" component="span" fw={700}>
                          {entry.label}
                        </Text>
                        {': '}
                        {entry.value}
                      </Text>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm">
                    <Text c="dimmed" component="span" fw={700}>
                      제작진
                    </Text>
                    {': '}
                    {work.author.trim() || '미입력'}
                  </Text>
                )}
              </Stack>
            </SectionCard>
          )}

          <ActionRow>
            <AppLinkButton to={`/works/${work.id}/edit`} tone="quiet">
              작품 정보 수정
            </AppLinkButton>
          </ActionRow>
        </Stack>
      </Tabs.Panel>
    </Tabs>
  );
}
