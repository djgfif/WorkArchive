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
import {
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
  const [timelineDate, setTimelineDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [timelineNote, setTimelineNote] = useState('');
  const [timelineType, setTimelineType] = useState<TimelineEntryType>('note');
  const [isSavingTimelineEntry, setIsSavingTimelineEntry] = useState(false);
  const [deletingTimelineEntryId, setDeletingTimelineEntryId] = useState<
    string | null
  >(null);
  const latestTimelineItem =
    timelineItems.length > 0 ? timelineItems[timelineItems.length - 1] : null;

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
            {
              label: '최근 기록일',
              value: formatWorkDate(work.lastConsumedAt),
            },
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
                    <AppBadge
                      tone={item.source === 'manual' ? 'accent' : 'muted'}
                    >
                      {item.source === 'manual' ? '직접 기록' : '날짜 기록'}
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
                    aria-label={`${work.title} 기록 내역 날짜`}
                    label="날짜"
                    onChange={(event) =>
                      setTimelineDate(event.currentTarget.value)
                    }
                    type="date"
                    value={timelineDate}
                  />
                </Group>
                <Textarea
                  aria-label={`${work.title} 기록 내역 메모`}
                  autosize
                  label="메모"
                  minRows={2}
                  onChange={(event) =>
                    setTimelineNote(event.currentTarget.value)
                  }
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
  );
}
