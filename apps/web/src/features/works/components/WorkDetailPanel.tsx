import { useState, type ReactNode } from 'react';
import {
  Accordion,
  Box,
  Group,
  NativeSelect,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';

import type {
  TimelineEntryRecord,
  TimelineEntryType,
  WorkContributorRole,
  WorkRecord,
} from '@work-archive/shared-types';

import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  KeyValueGrid,
  SectionCard,
} from '../../../shared/components/AppPrimitives';
import {
  formatWorkDateTime,
  formatWorkDate,
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';
import {
  ProgressDisplay,
  ReviewNoteCard,
  WorkPoster,
} from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';
import {
  getWorkProgressLabel,
  getWorkProgressPercent,
} from './archive-display';
import {
  getContributorEntries,
  getGraphTagKindLabel,
  getPersonalTags,
  getSeriesTagValues,
  workContributorValues,
} from '../utils/graph-tags';
import type { WorkGraphSnapshot } from '../services/graph.repository';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

const WORK_CONTRIBUTOR_ROLE_LABELS: Partial<
  Record<WorkContributorRole, string>
> = {
  artist: '아티스트',
  author: '작가',
  director: '감독',
  illustrator: '일러스트',
  original_creator: '원작',
  platform: '플랫폼',
  production_company: '제작사',
  publisher: '출판사',
  screenwriter: '각본',
  studio: '스튜디오',
  translator: '번역',
};

function getWorkContributorRoleLabel(role: WorkContributorRole) {
  return WORK_CONTRIBUTOR_ROLE_LABELS[role] ?? role;
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values.map((entry) => entry.trim()).filter(Boolean)) {
    const key = value.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

interface WorkDetailPanelProps {
  actions?: ReactNode;
  onCreateTimelineEntry?: (input: {
    note: string;
    occurredAt: string;
    type: TimelineEntryType;
  }) => Promise<void>;
  onDeleteTimelineEntry?: (id: string) => Promise<void>;
  overviewSections?: ReactNode;
  progressSections?: ReactNode;
  relatedSections?: ReactNode;
  timelineEntries?: TimelineEntryRecord[];
  work: WorkRecord;
  graph?: WorkGraphSnapshot | null;
}

const timelineTypeOptions: Array<{ label: string; value: TimelineEntryType }> =
  [
    { label: '메모', value: 'note' },
    { label: '감상 시작', value: 'started' },
    { label: '완료', value: 'completed' },
    { label: '하차', value: 'dropped' },
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
      label: '최근 기록',
      value: work.lastConsumedAt ?? null,
      description: work.lastConsumedLabel
        ? `마지막으로 남긴 위치: ${work.lastConsumedLabel}`
        : '마지막으로 진행을 기록한 날입니다.',
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
      label: '하차',
      value: work.droppedAt ?? null,
      description: '하차한 날입니다.',
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
  graph,
  onCreateTimelineEntry,
  onDeleteTimelineEntry,
  overviewSections,
  progressSections,
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
  const [activeTab, setActiveTab] = useState<string | null>('overview');

  const typeLabel = getWorkTypeLabel(work.type);
  const statusLabel = getWorkStatusLabel(work.status);
  const shortReview = work.shortReview.trim();
  const review = work.review.trim();
  const personalTags = getPersonalTags(work.personalTags);
  const graphSeriesById = new Map(
    graph?.series.map((series) => [series.id, series]) ?? [],
  );
  const graphContributorsById = new Map(
    graph?.contributors.map((contributor) => [contributor.id, contributor]) ?? [],
  );
  const graphSeriesTags = uniqueValues(
    graph?.workSeriesLinks
      .map((link) => graphSeriesById.get(link.seriesId)?.title ?? '')
      .filter(Boolean) ?? [],
  );
  const seriesTags =
    graphSeriesTags.length > 0
      ? graphSeriesTags
      : getSeriesTagValues(work.personalTags);
  const graphContributorEntries =
    graph?.workContributors
      .map((link) => {
        const contributor = graphContributorsById.get(link.contributorId);

        return contributor
          ? {
              key: `${link.role}-${contributor.id}`,
              label: getWorkContributorRoleLabel(link.role),
              value: contributor.name,
            }
          : null;
      })
      .filter(
        (entry): entry is { key: string; label: string; value: string } =>
          entry !== null,
      ) ?? [];
  const contributorEntries =
    graphContributorEntries.length > 0
      ? graphContributorEntries
      : getContributorEntries(work.personalTags).map((entry) => ({
          key: `${entry.kind}-${entry.value}`,
          label: getGraphTagKindLabel(entry.kind),
          value: entry.value,
        }));
  const contributorValues =
    contributorEntries.length > 0
      ? uniqueValues(contributorEntries.map((entry) => entry.value))
      : workContributorValues(work);
  const progressLabel = getWorkProgressLabel(work);
  const progressPercent = getWorkProgressPercent(work);
  const timelineItems = [
    ...createTimelineItems(work),
    ...timelineEntries.map((entry) => ({
      description: entry.note.trim() || '직접 남긴 기록입니다.',
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
      {/* ── 히어로 카드 ── */}
      <SectionCard className={cn(css.detailHero)} gap="xl" padding="xl" tone="hero">
        <Group align="flex-start" gap="xl" wrap="wrap">
          <Box className={cn(css.detailHeroPoster)}>
            <WorkPoster
              thumbnailUrl={work.thumbnailUrl}
              title={work.title}
              typeLabel={typeLabel}
              variant="hero"
            />
          </Box>

          <Stack className={cn(css.detailHeroBody)} flex={1} gap="md" miw={0}>
            {/* 메타 행 */}
            <Group gap={6} wrap="wrap">
              <AppBadge tone="muted">{typeLabel}</AppBadge>
              {seriesTags.slice(0, 2).map((series) => (
                <AppBadge key={`series-${series}`} tone="accent">
                  {series}
                </AppBadge>
              ))}
              {contributorValues.slice(0, 2).map((contributor) => (
                <AppBadge key={`contributor-${contributor}`} tone="muted">
                  {contributor}
                </AppBadge>
              ))}
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
            </Group>

            {/* 제목 + 저자 */}
            <Stack gap={4}>
              <Title
                className={cn(css.detailTitle)}
                order={1}
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

            {/* 별점 + 진행도 */}
            <Group align="flex-end" gap="xl" wrap="wrap">
              {work.rating !== null ? (
                <Stack gap={2}>
                  <Text
                    className={cn(css.detailMetaLabel)}
                    c="dimmed"
                    size="xs"
                  >
                    별점
                  </Text>
                  <Group align="baseline" gap={4}>
                    <Text
                      className={cn(css.detailHeroRatingValue)}
                      component="span"
                    >
                      {work.rating.toFixed(1)}
                    </Text>
                    <Text
                      className={cn(css.detailHeroRatingMax)}
                      component="span"
                    >
                      / 5.0
                    </Text>
                    <Text className={cn(css.detailStars)} component="span">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const filled = work.rating !== null && work.rating >= star;
                        const half = work.rating !== null && work.rating >= star - 0.5 && work.rating < star;
                        return (
                          <span
                            className={cn(css.detailStar)}
                            data-active={(filled || half) ? 'true' : 'false'}
                            data-half={half ? 'true' : 'false'}
                            key={star}
                          >
                            {(filled || half) ? '★' : '☆'}
                          </span>
                        );
                      })}
                    </Text>
                  </Group>
                </Stack>
              ) : (
                <Stack gap={2}>
                  <Text
                    className={cn(css.detailMetaLabel)}
                    c="dimmed"
                    size="xs"
                  >
                    별점
                  </Text>
                  <Text c="dimmed" size="sm">미평가</Text>
                </Stack>
              )}
              {progressLabel && (
                <Stack gap={2}>
                  <Text
                    className={cn(css.detailMetaLabel)}
                    c="dimmed"
                    size="xs"
                  >
                    진행도
                  </Text>
                  <Text
                    className={cn(css.numericText)}
                    fw={700}
                    size="lg"
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

          <Box className={cn(css.detailSummary)}>
            <Stack gap="lg">
              <Stack gap={4}>
                <Text c="var(--app-accent-primary)" fw={800} size="sm">
                  개인 기록 요약
                </Text>
                <Text c="dimmed" fw={700} size="xs">
                  한줄평
                </Text>
                <Text fw={800} lh={1.5}>
                  {shortReview ? `“${shortReview}”` : '아직 한줄평이 없습니다.'}
                </Text>
              </Stack>

              <Stack gap={6}>
                <Text c="dimmed" fw={700} size="xs">
                  개인 태그
                </Text>
                <Text fw={800} lh={1.5}>
                  {personalTags.length > 0
                    ? personalTags.map((tag) => `#${tag}`).join(' ')
                    : '아직 개인 태그가 없습니다.'}
                </Text>
              </Stack>

              <Stack gap={6}>
                <Text c="dimmed" fw={700} size="xs">
                  최근 기록
                </Text>
                <Text fw={800} lh={1.5}>
                  {latestTimelineItem
                    ? `${formatWorkDate(latestTimelineItem.value)} · ${latestTimelineItem.label}`
                    : '아직 남긴 진행 기록이 없습니다.'}
                </Text>
              </Stack>
            </Stack>
          </Box>
        </Group>
      </SectionCard>

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        keepMounted={false}
        classNames={{
          root: cn(css.detailTabs),
          list: cn(css.detailTabsList),
          tab: cn(css.detailTab),
        }}
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

            {/* 개인 태그 */}
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
                <Text c="dimmed" size="sm">아직 개인 태그를 남기지 않았습니다.</Text>
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
                  { label: '최근 기록일', value: formatWorkDate(work.lastConsumedAt) },
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
                같은 시리즈, 제작진, 카탈로그 관계로 이어지는 작품을 나눠서 확인합니다.
              </Text>
            </SectionCard>
            {relatedSections}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="timeline">
          <Stack gap="md">
            <SectionCard padding="md" tone="subtle">
              <Group align="flex-start" justify="space-between" wrap="wrap">
                <Stack gap={4}>
                  <Text fw={700}>
                    {latestTimelineItem
                      ? `최근 기록: ${latestTimelineItem.label}`
                      : '아직 날짜 기록이 없습니다'}
                  </Text>
                  <Text c="dimmed" size="sm">
                    {latestTimelineItem
                      ? `${formatWorkDate(latestTimelineItem.value)} · ${latestTimelineItem.description}`
                      : '시작일이나 최근 기록일을 남기면 이곳에 요약됩니다.'}
                  </Text>
                </Stack>
                <AppBadge tone="muted">{timelineItems.length}개</AppBadge>
              </Group>
            </SectionCard>

            <SectionCard gap="md" padding="md" tone="subtle">
              <KeyValueGrid
                columns={2}
                items={[
                  { label: '추가한 날', value: formatWorkDateTime(work.createdAt) },
                  { label: '최근 수정', value: formatWorkDateTime(work.updatedAt) },
                  { label: '시작일', value: formatWorkDate(work.startedAt) },
                  { label: '완료일', value: formatWorkDate(work.completedAt) },
                  { label: '하차일', value: formatWorkDate(work.droppedAt) },
                  { label: '최근 기록일', value: formatWorkDate(work.lastConsumedAt) },
                  { label: '진행도', value: progressLabel ?? '아직 없음' },
                  { label: '현재 상태', value: statusLabel },
                ]}
              />
            </SectionCard>

            {timelineItems.length > 0 && (
              <Stack gap="md">
                {timelineItems.map((item, index) => (
                  <Box
                    className={
                      index === timelineItems.length - 1
                        ? `${cn(css.timelineItem)} ${cn(css.timelineItemLast)}`
                        : cn(css.timelineItem)
                    }
                    key={`${item.source}-${item.id}`}
                  >
                    <Box aria-hidden="true" className={cn(css.timelineDot)} />
                    <Group align="flex-start" justify="space-between">
                      <Stack gap={2}>
                        <Group gap="xs">
                          <Text fw={700}>{item.label}</Text>
                          <AppBadge tone={item.source === 'manual' ? 'accent' : 'muted'}>
                            {item.source === 'manual' ? '직접 기록' : '날짜 기록'}
                          </AppBadge>
                        </Group>
                        <Text c="dimmed" size="sm">{item.description}</Text>
                      </Stack>
                      <ActionRow>
                        <AppBadge tone="accent">
                          {formatWorkDate(item.value)}
                        </AppBadge>
                        {item.source === 'manual' && onDeleteTimelineEntry && (
                          <AppButton
                            disabled={deletingTimelineEntryId === item.id}
                            loading={deletingTimelineEntryId === item.id}
                            onClick={() => void handleDeleteTimelineEntry(item.id)}
                            tone="danger"
                            type="button"
                          >
                            삭제
                          </AppButton>
                        )}
                      </ActionRow>
                    </Group>
                  </Box>
                ))}
              </Stack>
            )}

            {onCreateTimelineEntry && (
              <Accordion defaultValue={null} variant="contained">
                <Accordion.Item value="advanced-record-add">
                  <Accordion.Control>고급 기록 추가</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      <Group align="flex-end" grow>
                        <NativeSelect
                          aria-label={`${work.title} 기록 내역 유형`}
                          label="유형"
                          onChange={(event) =>
                            setTimelineType(event.currentTarget.value as TimelineEntryType)
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
                          aria-label={`${work.title} 기록 내역 날짜`}
                          label="날짜"
                          onChange={(event) => setTimelineDate(event.currentTarget.value)}
                          type="date"
                          value={timelineDate}
                        />
                      </Group>
                      <Textarea
                        aria-label={`${work.title} 기록 내역 메모`}
                        autosize
                        label="메모"
                        minRows={2}
                        onChange={(event) => setTimelineNote(event.currentTarget.value)}
                        placeholder="필요할 때만 남기는 보조 기록입니다."
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
                          기록 추가
                        </AppButton>
                      </ActionRow>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="metadata">
          <Stack gap="md">
            {(seriesTags.length > 0 || contributorValues.length > 0) && (
              <Group gap={6} wrap="wrap">
                {seriesTags.map((series) => (
                  <AppBadge key={`series-chip-${series}`} tone="accent">
                    {series}
                  </AppBadge>
                ))}
                {contributorValues.map((contributor) => (
                  <AppBadge key={`contributor-chip-${contributor}`} tone="success">
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
                    value: work.genres.length > 0 ? work.genres.join(', ') : '없음',
                  },
                  {
                    label: '작품 소개',
                    value: work.description.trim() || '작품 소개가 아직 없습니다.',
                  },
                  { label: '식별 방식', value: sourceIdentityLabel },
                  { label: '추가한 날', value: formatWorkDateTime(work.createdAt) },
                  { label: '수정한 날', value: formatWorkDateTime(work.updatedAt) },
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
    </Stack>
  );
}
