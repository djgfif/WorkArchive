import { Group, Progress, Stack, Text, Title } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';
import { Link } from 'react-router-dom';

import { useAppTranslation } from '@app/i18n';
import { ActionRow, AppButton } from '@shared/components/AppPrimitives';
import { WorkPoster } from './ArchiveComponents';
import { SerialStatusBadge } from './SerialStatusBadge';
import styles from './ArchiveComponents.module.css';
import { getWorkListMetaLine } from '../utils/work-list-row-state';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface WorkListRowSummaryProps {
  editOpen: boolean;
  index?: number;
  isUpdating: boolean;
  onToggleEdit: () => void;
  progressLabel: string | null;
  progressPercent: number | null;
  typeLabel: string;
  work: WorkRecord;
}

export function WorkListRowSummary({
  editOpen,
  index,
  isUpdating,
  onToggleEdit,
  progressLabel,
  progressPercent,
  typeLabel,
  work,
}: WorkListRowSummaryProps) {
  const { t } = useAppTranslation();

  return (
    <Group align="flex-start" gap="md" justify="space-between" wrap="wrap">
      <Group
        align="flex-start"
        className={cn(css.listRowMain)}
        gap="md"
        miw={0}
        wrap="nowrap"
      >
        {typeof index === 'number' && (
          <span aria-hidden="true" className={cn(css.listRowIndex)}>
            {String(index + 1).padStart(2, '0')}
          </span>
        )}
        <Link
          aria-label={t('works.list.trashDetailAria', { title: work.title })}
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

          {work.serialStatus && (
            <Group gap={6}>
              <SerialStatusBadge serialStatus={work.serialStatus} />
            </Group>
          )}

          <Text
            c="dimmed"
            fw={700}
            lineClamp={1}
            size="xs"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {getWorkListMetaLine(work)}
            {isUpdating ? t('works.list.savingPrefix') : ''}
          </Text>

          {progressLabel && (
            <Text c="dimmed" fw={700} lineClamp={1} size="xs">
              {t('works.list.continueReading', { progress: progressLabel })}
            </Text>
          )}

          {progressPercent !== null && (
            <Progress
              aria-label={t('works.list.listProgressAria', {
                percent: progressPercent,
                title: work.title,
              })}
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
            aria-label={t('works.list.openQuickEdit')}
            onClick={onToggleEdit}
            size="compact-sm"
            tone="secondary"
            type="button"
          >
            {editOpen ? t('works.list.closeEdit') : t('works.list.edit')}
          </AppButton>
        </ActionRow>
      </Stack>
    </Group>
  );
}
