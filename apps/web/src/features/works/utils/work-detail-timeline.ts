import type {
  TimelineEntryRecord,
  TimelineEntryType,
  WorkRecord,
} from '@work-archive/shared-types';

export interface WorkDetailTimelineItem {
  description: string;
  id: string;
  label: string;
  source: 'manual' | 'system';
  value: string;
}

export const timelineTypeOptions: Array<{
  label: string;
  value: TimelineEntryType;
}> = [
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

type MaybeTimelineItem = Omit<WorkDetailTimelineItem, 'value'> & {
  value: string | null | undefined;
};

function hasTimelineValue(
  item: MaybeTimelineItem,
): item is WorkDetailTimelineItem {
  return typeof item.value === 'string' && item.value.trim() !== '';
}

function createTimelineItems(work: WorkRecord): WorkDetailTimelineItem[] {
  const items: MaybeTimelineItem[] = [
    {
      id: 'system-started-at',
      label: '감상 시작',
      value: work.startedAt,
      description: '작품을 보기 시작한 날입니다.',
      source: 'system',
    },
    {
      id: 'system-last-consumed-at',
      label: '최근 기록',
      value: work.lastConsumedAt,
      description: work.lastConsumedLabel
        ? `마지막으로 남긴 위치: ${work.lastConsumedLabel}`
        : '마지막으로 진행을 기록한 날입니다.',
      source: 'system',
    },
    {
      id: 'system-completed-at',
      label: '완료',
      value: work.completedAt,
      description: '끝까지 본 날입니다.',
      source: 'system',
    },
    {
      id: 'system-dropped-at',
      label: '하차',
      value: work.droppedAt,
      description: '하차한 날입니다.',
      source: 'system',
    },
  ];

  return items
    .filter(hasTimelineValue)
    .sort(
      (left, right) =>
        new Date(left.value).getTime() - new Date(right.value).getTime(),
    );
}

export function buildWorkDetailTimelineItems(
  work: WorkRecord,
  timelineEntries: TimelineEntryRecord[],
): WorkDetailTimelineItem[] {
  return [
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
      new Date(left.value).getTime() - new Date(right.value).getTime(),
  );
}
