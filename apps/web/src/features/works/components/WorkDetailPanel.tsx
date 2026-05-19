import { useState, type ReactNode } from 'react';
import {
  Accordion,
  Box,
  Group,
  NativeSelect,
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
  getWorkTierLabel,
  getWorkTypeLabel,
} from '../utils/work-options';
import {
  ProgressDisplay,
  RatingDisplay,
  ReviewNoteCard,
  WorkPoster,
} from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';
import {
  getWorkProgressLabel,
  getWorkProgressPercent,
} from './archive-display';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

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

function createTimelineItems(work: WorkRecord) {
  return [
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
  const shortReview = work.shortReview.trim();
  const review = work.review.trim();
  const progressLabel = getWorkProgressLabel(work);
  const progressPercent = getWorkProgressPercent(work);
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
  const latestTimelineItem =
    timelineItems.length > 0
      ? timelineItems[timelineItems.length - 1]
      : null;
  const shouldCollapseTimelineByDefault = timelineItems.length > 3;
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
      <SectionCard gap="xl" padding="xl" tone="hero">
        <Group align="flex-start" gap="xl" wrap="wrap">
          <Box className={cn(css.detailHeroPoster)}>
            <WorkPoster
              thumbnailUrl={work.thumbnailUrl}
              title={work.title}
              typeLabel={typeLabel}
              variant="hero"
            />
          </Box>

          <Stack
            className={cn(css.detailHeroBody)}
            flex={1}
            gap="md"
            miw={0}
          >
            {/* 메타 행 — 유형 · 상태 · 즐겨찾기 */}
            <Group gap={6} wrap="wrap">
              <AppBadge tone="muted">{typeLabel}</AppBadge>
              <Box
                aria-hidden="true"
                className={cn(css.detailHeroMetaDivider)}
                component="span"
              />
              <AppBadge
                tone={
                  work.status === 'completed' ? 'accent'
                  : work.status === 'in_progress' ? 'info'
                  : 'muted'
                }
              >
                {statusLabel}
              </AppBadge>
              {work.favorite && (
                <AppBadge tone="accent">★ 즐겨찾기</AppBadge>
              )}
              {tierLabel !== '미지정' && (
                <AppBadge tone="muted">Tier {tierLabel}</AppBadge>
              )}
            </Group>

            {/* 제목 + 저자 */}
            <Stack gap={4}>
              <Title
                order={1}
                style={{
                  fontSize: 'clamp(1.5rem, 3.5vw, 2.4rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.15,
                }}
              >
                {work.title}
              </Title>
              <Text c="dimmed" size="sm">
                {work.author || '작가·제작자 미입력'}
                {' · '}
                <Text c="dimmed" component="span" size="xs">
                  최근 수정 {formatWorkUpdatedAt(work.updatedAt)}
                </Text>
              </Text>
            </Stack>

            {/* 별점 + 진행도 대형 표시 */}
            <Group align="flex-end" gap="xl" wrap="wrap">
              {work.rating !== null ? (
                <Stack gap={2}>
                  <Text
                    c="dimmed"
                    size="xs"
                    style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >
                    별점
                  </Text>
                  <Group align="baseline" gap={4}>
                    <Text
                      className={cn(css.detailHeroRatingValue)}
                      component="span"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {work.rating.toFixed(1)}
                    </Text>
                    <Text
                      className={cn(css.detailHeroRatingMax)}
                      component="span"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      / 5.0
                    </Text>
                  </Group>
                </Stack>
              ) : (
                <Stack gap={2}>
                  <Text
                    c="dimmed"
                    size="xs"
                    style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >
                    별점
                  </Text>
                  <Text c="dimmed" size="sm">미평가</Text>
                </Stack>
              )}
              {progressLabel && (
                <Stack gap={2}>
                  <Text
                    c="dimmed"
                    size="xs"
                    style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >
                    진행도
                  </Text>
                  <Text
                    fw={700}
                    size="lg"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {progressLabel}
                  </Text>
                </Stack>
              )}
            </Group>

            {/* 진행도 바 */}
            {progressPercent !== null && (
              <ProgressDisplay work={work} />
            )}

            {/* 액션 버튼 */}
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
            <Stack gap="xs">
              <Text c="dimmed" fw={700} size="sm">
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
                <Text c="dimmed">
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

        {recordSections}
      </PageSection>

      <PageSection
        description="시작, 마지막 감상, 완료, 중단 날짜를 시간순으로 모아 개인 감상 흐름을 보여줍니다."
        eyebrow="감상 이력"
        title="타임라인"
      >
        <SectionCard gap="md" padding="lg" tone="subtle">
          <Stack gap="md">
            <SectionCard padding="md" tone="default">
              <Group align="flex-start" justify="space-between" wrap="wrap">
                <Stack gap={4}>
                  <Text fw={700}>
                    {latestTimelineItem
                      ? `최근 흐름: ${latestTimelineItem.label}`
                      : '아직 날짜 기록이 없습니다'}
                  </Text>
                  <Text c="var(--mantine-color-dimmed)" size="sm">
                    {latestTimelineItem
                      ? `${formatWorkDate(latestTimelineItem.value)} · ${latestTimelineItem.description}`
                      : '시작일이나 마지막 감상일을 남기면 이곳에 요약됩니다.'}
                  </Text>
                </Stack>
                <AppBadge tone="accent">{timelineItems.length}개 기록</AppBadge>
              </Group>
            </SectionCard>

            <Accordion
              defaultValue={
                shouldCollapseTimelineByDefault ? null : 'timeline-details'
              }
              variant="separated"
            >
              <Accordion.Item value="timeline-details">
                <Accordion.Control>
                  전체 타임라인과 기록 추가
                </Accordion.Control>
                <Accordion.Panel>
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
                                  event.currentTarget
                                    .value as TimelineEntryType,
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
                          className={
                            index === timelineItems.length - 1
                              ? `${cn(css.timelineItem)} ${cn(css.timelineItemLast)}`
                              : cn(css.timelineItem)
                          }
                          key={`${item.source}-${item.id}`}
                        >
                          <Box
                            aria-hidden="true"
                            className={cn(css.timelineDot)}
                          />
                          <Group align="flex-start" justify="space-between">
                            <Stack gap={2}>
                              <Group gap="xs">
                                <Text fw={700}>{item.label}</Text>
                                <AppBadge
                                  tone={
                                    item.source === 'manual'
                                      ? 'accent'
                                      : 'muted'
                                  }
                                >
                                  {item.source === 'manual'
                                    ? '직접 기록'
                                    : '날짜 기록'}
                                </AppBadge>
                              </Group>
                              <Text c="var(--mantine-color-dimmed)" size="sm">
                                {item.description}
                              </Text>
                            </Stack>
                            <ActionRow>
                              <AppBadge tone="accent">
                                {formatWorkDate(item.value)}
                              </AppBadge>
                              {item.source === 'manual' &&
                                onDeleteTimelineEntry && (
                                  <AppButton
                                    disabled={
                                      deletingTimelineEntryId === item.id
                                    }
                                    loading={
                                      deletingTimelineEntryId === item.id
                                    }
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
                      <Text c="var(--mantine-color-dimmed)" size="sm">
                        아직 날짜 기록이 없습니다. 시작일이나 마지막 감상일을 남기면
                        이곳에 표시됩니다.
                      </Text>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>

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
        description="작품을 다시 찾을 때 필요한 기본 정보만 모았습니다."
        eyebrow="작품 정보"
        title="작품 정보"
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
