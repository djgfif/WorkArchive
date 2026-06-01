import { Group, Progress, Stack, Text, Title } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import { ActionRow, AppButton } from '@shared/components/AppPrimitives';
import { WorkPoster } from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';
import { getWorkListMetaLine } from '../utils/work-list-row-state';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

interface WorkListRowSummaryProps {
  editOpen: boolean;
  isUpdating: boolean;
  onToggleEdit: () => void;
  progressLabel: string | null;
  progressPercent: number | null;
  typeLabel: string;
  work: WorkRecord;
}

export function WorkListRowSummary({
  editOpen,
  isUpdating,
  onToggleEdit,
  progressLabel,
  progressPercent,
  typeLabel,
  work,
}: WorkListRowSummaryProps) {
  return (
    <Group align="flex-start" gap="md" justify="space-between" wrap="wrap">
      <Group
        align="flex-start"
        className={cn(css.listRowMain)}
        gap="md"
        miw={0}
        wrap="nowrap"
      >
        <Link
          aria-label={`${work.title} 상세 보기`}
          style={{ flexShrink: 0, display: 'block' }}
          to={`/works/${work.id}`}
        >
          <WorkPoster
            thumbnailUrl={work.thumbnailUrl}
            title={work.title}
            typeLabel={typeLabel}
            variant="row"
          />
        </Link>

        <Stack flex={1} gap={5} miw={0} pt={2}>
          <Title lineClamp={1} order={3} size="h4">
            <Link
              style={{ color: 'inherit', textDecoration: 'none' }}
              to={`/works/${work.id}`}
            >
              {work.title}
            </Link>
          </Title>

          {work.author.trim() && (
            <Text c="dimmed" lineClamp={1} size="xs">
              {work.author.trim()}
            </Text>
          )}

          <Text
            c="dimmed"
            fw={700}
            lineClamp={1}
            size="xs"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {getWorkListMetaLine(work)}
            {isUpdating ? ' · 저장 중' : ''}
          </Text>

          {progressLabel && (
            <Text c="dimmed" fw={700} lineClamp={1} size="xs">
              이어보기 {progressLabel}
            </Text>
          )}

          {progressPercent !== null && (
            <Progress
              aria-label={`${work.title} 진행도 ${progressPercent}%`}
              color="archive.5"
              radius="xl"
              size="xs"
              value={progressPercent}
            />
          )}

          <Text c="dimmed" lineClamp={1} size="xs">
            {typeLabel}
            {work.shortReview.trim() ? ` · ${work.shortReview.trim()}` : ''}
          </Text>
        </Stack>
      </Group>

      <Stack
        className={cn(css.listRowControls)}
        gap="xs"
        style={{ minWidth: 'min(100%, 10rem)' }}
      >
        <ActionRow justify="flex-end">
          <AppButton
            aria-expanded={editOpen}
            aria-label="빠른 수정 패널 열기"
            onClick={onToggleEdit}
            size="compact-sm"
            tone="secondary"
            type="button"
          >
            {editOpen ? '닫기' : '수정'}
          </AppButton>
        </ActionRow>
      </Stack>
    </Group>
  );
}
