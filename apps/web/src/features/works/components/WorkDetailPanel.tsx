import { useState, type ReactNode } from 'react';
import {
  Box,
  Group,
  NativeSelect,
  Progress,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';

import type {
  TimelineEntryRecord,
  TimelineEntryType,
  WorkRecord,
} from '@work-archive/shared-types';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  KeyValueGrid,
  MetricPill,
  PageSection,
  SectionCard,
} from '../../../shared/components/AppPrimitives';
import {
  formatWorkDateTime,
  formatWorkDate,
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkSyncStatusLabel,
  getWorkTierLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

interface WorkDetailPanelProps {
  actions?: ReactNode;
  onCreateTimelineEntry?: (input: {
    note: string;
    occurredAt: string;
    type: TimelineEntryType;
  }) => Promise<void>;
  onDeleteTimelineEntry?: (id: string) => Promise<void>;
  recordSections?: ReactNode;
  relatedSections?: ReactNode;
  timelineEntries?: TimelineEntryRecord[];
  work: WorkRecord;
}

const timelineTypeOptions: Array<{ label: string; value: TimelineEntryType }> =
  [
    { label: '메모', value: 'note' },
    { label: '감상 시작', value: 'started' },
    { label: '완료', value: 'completed' },
    { label: '중단', value: 'dropped' },
    { label: '재감상', value: 'rewatch' },
    { label: '진행', value: 'progress' },
  ];

const timelineTypeLabels: Record<TimelineEntryType, string> =
  Object.fromEntries(
    timelineTypeOptions.map((option) => [option.value, option.label]),
  ) as Record<TimelineEntryType, string>;

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

function createTimelineItems(work: WorkRecord) {
  return [
    {
      id: 'system-created-at',
      label: '기록 추가',
      value: work.createdAt,
      description: '아카이브에 처음 저장한 날입니다.',
      source: 'system' as const,
    },
    {
      id: 'system-started-at',
      label: '감상 시작',
      value: work.startedAt ?? null,
      description: '작품을 보기 시작한 날입니다.',
      source: 'system' as const,
    },
    {
      id: 'system-last-consumed-at',
      label: '마지막 감상',
      value: work.lastConsumedAt ?? null,
      description: work.lastConsumedLabel
        ? `마지막 위치: ${work.lastConsumedLabel}`
        : '마지막으로 감상한 날입니다.',
      source: 'system' as const,
    },
    {
      id: 'system-completed-at',
      label: '완료',
      value: work.completedAt ?? null,
      description: '끝까지 본 날입니다.',
      source: 'system' as const,
    },
    {
      id: 'system-dropped-at',
      label: '중단',
      value: work.droppedAt ?? null,
      description: '하차하거나 중단한 날입니다.',
      source: 'system' as const,
    },
  ]
    .filter((item) => item.value)
    .sort(
      (left, right) =>
        new Date(left.value!).getTime() - new Date(right.value!).getTime(),
    );
}

export function WorkDetailPanel({
  actions,
  onCreateTimelineEntry,
  onDeleteTimelineEntry,
  recordSections,
  relatedSections,
  timelineEntries = [],
  work,
}: WorkDetailPanelProps) {
  const [timelineDate, setTimelineDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [timelineNote, setTimelineNote] = useState('');
  const [timelineType, setTimelineType] = useState<TimelineEntryType>('note');
  const [isSavingTimelineEntry, setIsSavingTimelineEntry] = useState(false);
  const [deletingTimelineEntryId, setDeletingTimelineEntryId] = useState<
    string | null
  >(null);
  const typeLabel = getWorkTypeLabel(work.type);
  const statusLabel = getWorkStatusLabel(work.status);
  const tierLabel = getWorkTierLabel(work.tier);
  const syncLabel = getWorkSyncStatusLabel(work.syncStatus);
  const shortReview = work.shortReview.trim();
  const review = work.review.trim();
  const progressLabel = getProgressLabel(work);
  const progressPercent = getProgressPercent(work);
  const timelineItems = [
    ...createTimelineItems(work),
    ...timelineEntries.map((entry) => ({
      description: entry.note.trim() || '직접 남긴 타임라인 기록입니다.',
      id: entry.id,
      label: timelineTypeLabels[entry.type],
      source: 'manual' as const,
      value: entry.occurredAt,
    })),
  ].sort(
    (left, right) =>
      new Date(left.value!).getTime() - new Date(right.value!).getTime(),
  );
  const sourceIdentityLabel = work.catalogTitleId
    ? '카탈로그 연결됨'
    : work.importDraft
      ? '외부 검색 초안'
      : '직접 기록';

  async function handleCreateTimelineEntry() {
    if (!onCreateTimelineEntry || !timelineDate) {
      return;
    }

    try {
      setIsSavingTimelineEntry(true);
      await onCreateTimelineEntry({
        note: timelineNote,
        occurredAt: new Date(`${timelineDate}T00:00:00.000Z`).toISOString(),
        type: timelineType,
      });
      setTimelineNote('');
      setTimelineType('note');
    } finally {
      setIsSavingTimelineEntry(false);
    }
  }

  async function handleDeleteTimelineEntry(id: string) {
    if (!onDeleteTimelineEntry) {
      return;
    }

    try {
      setDeletingTimelineEntryId(id);
      await onDeleteTimelineEntry(id);
    } finally {
      setDeletingTimelineEntryId(null);
    }
  }

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

          <Stack
            flex={1}
            gap="lg"
            miw={0}
            style={{ minWidth: 'min(100%, 26rem)' }}
          >
            <ActionRow>
              <AppBadge>{typeLabel}</AppBadge>
              <AppBadge tone="accent">{statusLabel}</AppBadge>
              {work.favorite && <AppBadge tone="accent">즐겨찾기</AppBadge>}
            </ActionRow>

            <div>
              <Title order={1}>{work.title}</Title>
              <Text c="var(--app-text-muted)">
                {work.author || '작가·제작자 미입력'} · 최근 수정{' '}
                {formatWorkUpdatedAt(work.updatedAt)}
              </Text>
            </div>

            <ActionRow>
              <MetricPill label="별점" value={renderRatingLabel(work)} />
              <MetricPill label="상태" value={statusLabel} />
              {progressLabel && (
                <MetricPill label="진행도" value={progressLabel} />
              )}
            </ActionRow>

            {progressPercent !== null && (
              <Stack gap={4}>
                <Text c="var(--app-text-muted)" fw={700} size="sm">
                  진행률 {progressPercent}%
                </Text>
                <Progress
                  aria-label={`${work.title} 상세 진행도 ${progressPercent}%`}
                  color="archive"
                  radius="md"
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
                c={
                  shortReview
                    ? 'var(--app-text-strong)'
                    : 'var(--app-text-muted)'
                }
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
                c={
                  review ? 'var(--app-text-secondary)' : 'var(--app-text-muted)'
                }
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
        </SectionCard>

        {recordSections}
      </PageSection>

      <PageSection
        description="시작, 마지막 감상, 완료, 중단 날짜를 시간순으로 모아 개인 감상 흐름을 보여줍니다."
        eyebrow="감상 이력"
        title="타임라인"
      >
        <SectionCard gap="md" padding="lg" tone="subtle">
          <Stack gap="md">
            {onCreateTimelineEntry && (
              <SectionCard padding="md" tone="default">
                <Stack gap="md">
                  <Group align="flex-end" grow>
                    <NativeSelect
                      aria-label={`${work.title} 타임라인 유형`}
                      label="유형"
                      onChange={(event) =>
                        setTimelineType(
                          event.currentTarget.value as TimelineEntryType,
                        )
                      }
                      value={timelineType}
                    >
                      {timelineTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </NativeSelect>
                    <TextInput
                      aria-label={`${work.title} 타임라인 날짜`}
                      label="날짜"
                      onChange={(event) =>
                        setTimelineDate(event.currentTarget.value)
                      }
                      type="date"
                      value={timelineDate}
                    />
                  </Group>
                  <Textarea
                    aria-label={`${work.title} 타임라인 메모`}
                    autosize
                    label="메모"
                    minRows={2}
                    onChange={(event) =>
                      setTimelineNote(event.currentTarget.value)
                    }
                    placeholder="감상 중 남기고 싶은 변화를 기록하세요."
                    value={timelineNote}
                  />
                  <ActionRow>
                    <AppButton
                      disabled={!timelineDate || isSavingTimelineEntry}
                      loading={isSavingTimelineEntry}
                      onClick={() => void handleCreateTimelineEntry()}
                      tone="primary"
                      type="button"
                    >
                      타임라인 기록 추가
                    </AppButton>
                  </ActionRow>
                </Stack>
              </SectionCard>
            )}
            {timelineItems.length > 0 ? (
              timelineItems.map((item, index) => (
                <Box
                  key={`${item.source}-${item.id}`}
                  style={{
                    borderLeft: '1px solid var(--app-border-strong)',
                    paddingBottom:
                      index === timelineItems.length - 1 ? 0 : '0.85rem',
                    paddingLeft: '1rem',
                    position: 'relative',
                  }}
                >
                  <Box
                    aria-hidden="true"
                    style={{
                      background: 'var(--app-accent)',
                      border: '2px solid var(--app-surface-1)',
                      borderRadius: '999px',
                      height: '0.6rem',
                      left: '-0.35rem',
                      position: 'absolute',
                      top: '0.35rem',
                      width: '0.6rem',
                    }}
                  />
                  <Group align="flex-start" justify="space-between">
                    <Stack gap={2}>
                      <Group gap="xs">
                        <Text fw={700}>{item.label}</Text>
                        <AppBadge
                          tone={item.source === 'manual' ? 'accent' : 'muted'}
                        >
                          {item.source === 'manual' ? '직접 기록' : '날짜 기록'}
                        </AppBadge>
                      </Group>
                      <Text c="var(--app-text-muted)" size="sm">
                        {item.description}
                      </Text>
                    </Stack>
                    <ActionRow>
                      <AppBadge tone="accent">
                        {formatWorkDate(item.value)}
                      </AppBadge>
                      {item.source === 'manual' && onDeleteTimelineEntry && (
                        <AppButton
                          disabled={deletingTimelineEntryId === item.id}
                          loading={deletingTimelineEntryId === item.id}
                          onClick={() =>
                            void handleDeleteTimelineEntry(item.id)
                          }
                          tone="danger"
                          type="button"
                        >
                          삭제
                        </AppButton>
                      )}
                    </ActionRow>
                  </Group>
                </Box>
              ))
            ) : (
              <Text c="var(--app-text-muted)" size="sm">
                아직 날짜 기록이 없습니다. 시작일이나 마지막 감상일을 남기면
                이곳에 표시됩니다.
              </Text>
            )}
            <KeyValueGrid
              columns={2}
              items={[
                {
                  label: '추가한 날',
                  value: formatWorkDateTime(work.createdAt),
                },
                {
                  label: '최근 수정',
                  value: formatWorkDateTime(work.updatedAt),
                },
                { label: '시작일', value: formatWorkDate(work.startedAt) },
                { label: '완료일', value: formatWorkDate(work.completedAt) },
                { label: '중단일', value: formatWorkDate(work.droppedAt) },
                {
                  label: '마지막 감상일',
                  value: formatWorkDate(work.lastConsumedAt),
                },
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
