import type {
  TimelineEntryRecord,
  TimelineEntryType,
  WorkType,
  WorkRecord,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';

export interface WorkDetailTimelineItem {
  deletableEntryId: string | null;
  description: string;
  id: string;
  label: string;
  source: 'automatic' | 'manual' | 'system';
  type: TimelineEntryType;
  value: string;
}

export interface WorkRepeatCopy {
  actionLabel: string;
  description: string;
  label: string;
  title: string;
}

const READING_WORK_TYPES = new Set<WorkType>([
  'novel',
  'manga',
  'light_novel',
  'web_novel',
  'webtoon',
]);

const WATCHING_WORK_TYPES = new Set<WorkType>(['anime', 'movie', 'drama']);

export function getWorkRepeatCopy(type: WorkType): WorkRepeatCopy {
  if (READING_WORK_TYPES.has(type)) {
    return {
      actionLabel: appI18n.t('works.detail.timelineRepeatActionRead'),
      description: appI18n.t('works.detail.timelineRepeatDescriptionRead'),
      label: appI18n.t('works.detail.timelineRepeatLabelRead'),
      title: appI18n.t('works.detail.timelineRepeatTitleRead'),
    };
  }

  if (WATCHING_WORK_TYPES.has(type)) {
    return {
      actionLabel: appI18n.t('works.detail.timelineRepeatActionWatch'),
      description: appI18n.t('works.detail.timelineRepeatDescriptionWatch'),
      label: appI18n.t('works.detail.timelineRepeatLabelWatch'),
      title: appI18n.t('works.detail.timelineRepeatTitleWatch'),
    };
  }

  return {
    actionLabel: appI18n.t('works.detail.timelineRepeatActionGeneric'),
    description: appI18n.t('works.detail.timelineRepeatDescriptionGeneric'),
    label: appI18n.t('works.detail.timelineRepeatLabelGeneric'),
    title: appI18n.t('works.detail.timelineRepeatTitleGeneric'),
  };
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
      deletableEntryId: null,
      id: 'system-started-at',
      label: appI18n.t('works.detail.timelineTypeStarted'),
      value: work.startedAt,
      description: appI18n.t('works.detail.timelineStartedDescription'),
      source: 'system',
      type: 'started',
    },
    {
      deletableEntryId: null,
      id: 'system-last-consumed-at',
      label: appI18n.t('works.detail.latestRecord'),
      value: work.lastConsumedAt,
      description: work.lastConsumedLabel
        ? appI18n.t('works.detail.timelineLastConsumedWithLabel', {
            label: work.lastConsumedLabel,
          })
        : appI18n.t('works.detail.timelineLastConsumedDescription'),
      source: 'system',
      type: 'progress',
    },
    {
      deletableEntryId: null,
      id: 'system-completed-at',
      label: appI18n.t('works.detail.timelineTypeCompleted'),
      value: work.completedAt,
      description: appI18n.t('works.detail.timelineCompletedDescription'),
      source: 'system',
      type: 'completed',
    },
    {
      deletableEntryId: null,
      id: 'system-dropped-at',
      label: appI18n.t('works.detail.timelineTypeDropped'),
      value: work.droppedAt,
      description: appI18n.t('works.detail.timelineDroppedDescription'),
      source: 'system',
      type: 'dropped',
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
  const repeatCopy = getWorkRepeatCopy(work.type);

  return [
    ...createTimelineItems(work),
    ...timelineEntries.map((entry) => ({
      deletableEntryId: entry.id,
      description:
        entry.note.trim() ||
        appI18n.t(
          entry.source === 'automatic'
            ? 'works.detail.timelineAutomaticDescription'
            : 'works.detail.timelineManualDescription',
        ),
      id: entry.id,
      label:
        entry.type === 'rewatch'
          ? repeatCopy.label
          : timelineTypeLabels[entry.type],
      source:
        entry.source === 'automatic'
          ? ('automatic' as const)
          : ('manual' as const),
      value: entry.occurredAt,
      type: entry.type,
    })),
  ].sort(
    (left, right) =>
      new Date(left.value).getTime() - new Date(right.value).getTime(),
  );
}
