import type {
  TimelineEntryRecord,
  TimelineEntryType,
  WorkRecord,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';

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
  { label: appI18n.t('works.detail.timelineTypeNote'), value: 'note' },
  { label: appI18n.t('works.detail.timelineTypeStarted'), value: 'started' },
  {
    label: appI18n.t('works.detail.timelineTypeCompleted'),
    value: 'completed',
  },
  { label: appI18n.t('works.detail.timelineTypeDropped'), value: 'dropped' },
  { label: appI18n.t('works.detail.timelineTypeRewatch'), value: 'rewatch' },
  { label: appI18n.t('works.detail.timelineTypeProgress'), value: 'progress' },
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
      label: appI18n.t('works.detail.timelineTypeStarted'),
      value: work.startedAt,
      description: appI18n.t('works.detail.timelineStartedDescription'),
      source: 'system',
    },
    {
      id: 'system-last-consumed-at',
      label: appI18n.t('works.detail.latestRecord'),
      value: work.lastConsumedAt,
      description: work.lastConsumedLabel
        ? appI18n.t('works.detail.timelineLastConsumedWithLabel', {
            label: work.lastConsumedLabel,
          })
        : appI18n.t('works.detail.timelineLastConsumedDescription'),
      source: 'system',
    },
    {
      id: 'system-completed-at',
      label: appI18n.t('works.detail.timelineTypeCompleted'),
      value: work.completedAt,
      description: appI18n.t('works.detail.timelineCompletedDescription'),
      source: 'system',
    },
    {
      id: 'system-dropped-at',
      label: appI18n.t('works.detail.timelineTypeDropped'),
      value: work.droppedAt,
      description: appI18n.t('works.detail.timelineDroppedDescription'),
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
      description:
        entry.note.trim() || appI18n.t('works.detail.timelineManualDescription'),
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
