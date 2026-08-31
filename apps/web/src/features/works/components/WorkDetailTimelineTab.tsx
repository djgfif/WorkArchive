import { useState } from 'react';
import {
  Accordion,
  Box,
  Group,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import type { TimelineEntryType, WorkRecord } from '@work-archive/shared-types';

import {
  ActionRow,
  AppBadge,
  AppButton,
  KeyValueGrid,
  SectionCard,
} from '@shared/components/AppPrimitives';
import { formatWorkDate, formatWorkDateTime } from '../utils/work-options';
import { useAppTranslation } from '@app/i18n';
import {
  getWorkRepeatCopy,
  timelineTypeOptions,
  type WorkDetailTimelineItem,
} from '../utils/work-detail-timeline';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface WorkDetailTimelineTabProps {
  onCreateTimelineEntry?: (input: {
    note: string;
    occurredAt: string;
    type: TimelineEntryType;
  }) => Promise<void>;
  onDeleteTimelineEntry?: (id: string) => Promise<void>;
  progressLabel: string | null;
  statusLabel: string;
  timelineItems: WorkDetailTimelineItem[];
  work: WorkRecord;
}

export function WorkDetailTimelineTab({
  onCreateTimelineEntry,
  onDeleteTimelineEntry,
  progressLabel,
  statusLabel,
  timelineItems,
  work,
}: WorkDetailTimelineTabProps) {
  const { t } = useAppTranslation();
  const [timelineDate, setTimelineDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [timelineNote, setTimelineNote] = useState('');
  const [timelineType, setTimelineType] = useState<TimelineEntryType>('note');
  const [isSavingTimelineEntry, setIsSavingTimelineEntry] = useState(false);
  const [isSavingRepeatEntry, setIsSavingRepeatEntry] = useState(false);
  const [deletingTimelineEntryId, setDeletingTimelineEntryId] = useState<
    string | null
  >(null);
  const latestTimelineItem =
    timelineItems.length > 0 ? timelineItems[timelineItems.length - 1] : null;
  const repeatCopy = getWorkRepeatCopy(work.type);
  const repeatRecordDate = new Date().toISOString().slice(0, 10);
  const repeatCount = timelineItems.filter(
    (item) => item.type === 'rewatch',
  ).length;
  const hasRepeatEntryToday = timelineItems.some(
    (item) =>
      item.type === 'rewatch' && item.value.slice(0, 10) === repeatRecordDate,
  );
  const canQuickRecordRepeat = work.status === 'completed' || repeatCount > 0;

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

  async function handleCreateRepeatEntry() {
    if (!onCreateTimelineEntry || hasRepeatEntryToday) {
      return;
    }

    try {
      setIsSavingRepeatEntry(true);
      await onCreateTimelineEntry({
        note: '',
        occurredAt: new Date(`${repeatRecordDate}T00:00:00.000Z`).toISOString(),
        type: 'rewatch',
      });
    } finally {
      setIsSavingRepeatEntry(false);
    }
  }

  return (
    <Stack gap="md">
      <SectionCard padding="md" tone="subtle">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <Stack gap={4}>
            <Text fw={700}>
              {latestTimelineItem
                ? t('works.detail.timelineSummaryPrefix', {
                    label: latestTimelineItem.label,
                  })
                : t('works.detail.timelineNoDate')}
            </Text>
            <Text c="dimmed" size="sm">
              {latestTimelineItem
                ? `${formatWorkDate(latestTimelineItem.value)} · ${latestTimelineItem.description}`
                : t('works.detail.timelineNoDateDescription')}
            </Text>
          </Stack>
          <AppBadge tone="muted">
            {t('works.detail.timelineCount', { count: timelineItems.length })}
          </AppBadge>
        </Group>
      </SectionCard>

      <SectionCard gap="md" padding="md" tone="subtle">
        <KeyValueGrid
          columns={2}
          items={[
            {
              label: t('works.detail.createdAt'),
              value: formatWorkDateTime(work.createdAt),
            },
            {
              label: t('works.detail.updatedAt'),
              value: formatWorkDateTime(work.updatedAt),
            },
            {
              label: t('works.form.startedAtLabel'),
              value: formatWorkDate(work.startedAt),
            },
            {
              label: t('works.form.completedAtLabel'),
              value: formatWorkDate(work.completedAt),
            },
            {
              label: t('works.detail.droppedAt'),
              value: formatWorkDate(work.droppedAt),
            },
            {
              label: t('works.detail.latestRecordDate'),
              value: formatWorkDate(work.lastConsumedAt),
            },
            {
              label: t('works.detail.progress'),
              value: progressLabel ?? t('works.detail.noProgress'),
            },
            { label: t('works.detail.currentStatus'), value: statusLabel },
          ]}
        />
      </SectionCard>

      {onCreateTimelineEntry && canQuickRecordRepeat && (
        <SectionCard gap="sm" padding="md" tone="default">
          <Group align="flex-start" justify="space-between" wrap="wrap">
            <Stack gap={4}>
              <Text fw={700}>{repeatCopy.title}</Text>
              <Text c="dimmed" size="sm">
                {repeatCopy.description}
              </Text>
              <Text c="dimmed" size="xs">
                {t('works.detail.timelineRepeatAdvancedHint')}
              </Text>
            </Stack>
            <AppBadge tone="muted">
              {t('works.detail.timelineRepeatCount', {
                count: repeatCount,
              })}
            </AppBadge>
          </Group>
          <ActionRow>
            <AppButton
              disabled={hasRepeatEntryToday || isSavingRepeatEntry}
              loading={isSavingRepeatEntry}
              onClick={() => void handleCreateRepeatEntry()}
              tone="primary"
              type="button"
            >
              {hasRepeatEntryToday
                ? t('works.detail.timelineRepeatRecordedToday')
                : repeatCopy.actionLabel}
            </AppButton>
          </ActionRow>
        </SectionCard>
      )}

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
                    <AppBadge
                      tone={item.source === 'manual' ? 'accent' : 'muted'}
                    >
                      {item.source === 'manual'
                        ? t('works.detail.timelineSourceManual')
                        : item.source === 'automatic'
                          ? t('works.detail.timelineSourceAutomatic')
                          : t('works.detail.timelineSourceSystem')}
                    </AppBadge>
                  </Group>
                  <Text c="dimmed" size="sm">
                    {item.description}
                  </Text>
                </Stack>
                <ActionRow>
                  <AppBadge tone="accent">
                    {formatWorkDate(item.value)}
                  </AppBadge>
                  {item.deletableEntryId && onDeleteTimelineEntry && (
                    <AppButton
                      disabled={
                        deletingTimelineEntryId === item.deletableEntryId
                      }
                      loading={
                        deletingTimelineEntryId === item.deletableEntryId
                      }
                      onClick={() =>
                        void handleDeleteTimelineEntry(item.deletableEntryId!)
                      }
                      tone="danger"
                      type="button"
                    >
                      {t('works.detail.timelineDelete')}
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
            <Accordion.Control>
              {t('works.detail.timelineAdvancedAdd')}
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                <Group align="flex-end" grow>
                  <NativeSelect
                    aria-label={t('works.detail.timelineTypeAria', {
                      title: work.title,
                    })}
                    label={t('works.detail.timelineTypeLabel')}
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
                    aria-label={t('works.detail.timelineDateAria', {
                      title: work.title,
                    })}
                    label={t('works.detail.timelineDateLabel')}
                    onChange={(event) =>
                      setTimelineDate(event.currentTarget.value)
                    }
                    type="date"
                    value={timelineDate}
                  />
                </Group>
                <Textarea
                  aria-label={t('works.detail.timelineMemoAria', {
                    title: work.title,
                  })}
                  autosize
                  label={t('works.detail.timelineMemoLabel')}
                  minRows={2}
                  onChange={(event) =>
                    setTimelineNote(event.currentTarget.value)
                  }
                  placeholder={t('works.detail.timelineMemoPlaceholder')}
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
                    {t('works.detail.timelineAdd')}
                  </AppButton>
                </ActionRow>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}
    </Stack>
  );
}
