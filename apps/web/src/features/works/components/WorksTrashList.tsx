import { Checkbox, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

import type { WorkRecord } from '@work-archive/shared-types';

import { useAppTranslation } from '@app/i18n';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
} from '@shared/components/AppPrimitives';
import {
  formatWorkDateTime,
  getWorkStatusLabel,
  getWorkSyncStatusLabel,
  getWorkTypeLabel,
} from '../utils/work-options';
import { WorkPoster } from './ArchiveComponents';
import { IconTrash } from './WorksToolbarIcons';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface WorksTrashListProps {
  deletingWorkId: string | null;
  onPermanentDelete: (work: WorkRecord) => Promise<void> | void;
  onRestore: (work: WorkRecord) => Promise<void>;
  onToggleSelect: (id: string) => void;
  restoringWorkId: string | null;
  retentionDays: number;
  selectedIds: ReadonlySet<string>;
  works: WorkRecord[];
}

/** 삭제 후 보존 기간까지 남은 일수 라벨. */
function getAutoDeleteLabel(
  work: WorkRecord,
  retentionDays: number,
  t: ReturnType<typeof useAppTranslation>['t'],
): string | null {
  if (retentionDays <= 0) {
    return null;
  }

  const deletedTime = Date.parse(work.deletedAt ?? work.updatedAt);

  if (!Number.isFinite(deletedTime)) {
    return null;
  }

  const elapsedDays = (Date.now() - deletedTime) / MS_PER_DAY;
  const daysLeft = Math.ceil(retentionDays - elapsedDays);

  if (daysLeft <= 1) {
    return t('works.list.trashAutoDeleteSoon');
  }

  return t('works.list.trashAutoDeleteIn', { days: daysLeft });
}

export function WorksTrashList({
  deletingWorkId,
  onPermanentDelete,
  onRestore,
  onToggleSelect,
  restoringWorkId,
  retentionDays,
  selectedIds,
  works,
}: WorksTrashListProps) {
  const { t } = useAppTranslation();

  // 휴지통은 가장 최근에 버린 항목이 위로 오도록 삭제일 내림차순으로 보여준다.
  const orderedWorks = [...works].sort((a, b) => {
    const left = Date.parse(b.deletedAt ?? b.updatedAt) || 0;
    const right = Date.parse(a.deletedAt ?? a.updatedAt) || 0;

    return left - right;
  });

  return (
    <section aria-label={t('works.list.trashListAria')}>
      <Stack gap="md">
        {orderedWorks.map((work) => {
          const isRestoring = restoringWorkId === work.id;
          const isDeleting = deletingWorkId === work.id;
          const isBusy = isRestoring || isDeleting;
          const isSelected = selectedIds.has(work.id);
          const typeLabel = getWorkTypeLabel(work.type);
          const autoDeleteLabel = getAutoDeleteLabel(work, retentionDays, t);

          return (
            <Paper
              className={`${cn(css.listRowSurface)} ${cn(css.trashRowSurface)}`}
              data-selected={isSelected ? 'true' : 'false'}
              key={work.id}
              radius="lg"
              style={{ opacity: isBusy ? 0.78 : 1 }}
              withBorder
            >
              <Group
                align="flex-start"
                gap="md"
                justify="space-between"
                wrap="wrap"
              >
                <Group
                  align="flex-start"
                  className={cn(css.listRowMain)}
                  gap="md"
                  miw={0}
                  wrap="nowrap"
                >
                  <Checkbox
                    aria-label={t('works.list.selectItemAria', {
                      title: work.title,
                    })}
                    checked={isSelected}
                    disabled={isBusy}
                    mt={4}
                    onChange={() => onToggleSelect(work.id)}
                  />
                  <Link
                    aria-label={t('works.list.trashDetailAria', {
                      title: work.title,
                    })}
                    style={{ flexShrink: 0, display: 'block' }}
                    to={`/works/${work.id}`}
                  >
                    <WorkPoster
                      showFallbackTitle={false}
                      thumbnailUrl={work.thumbnailUrl}
                      title={work.title}
                      typeLabel={typeLabel}
                      variant="row"
                    />
                  </Link>

                  <Stack flex={1} gap={6} miw={0} pt={2}>
                    <Group gap={6} wrap="wrap">
                      <AppBadge tone="warning">
                        {t('works.list.trashDeleted')}
                      </AppBadge>
                      <AppBadge tone="muted">{typeLabel}</AppBadge>
                      <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
                      <AppBadge>
                        {getWorkSyncStatusLabel(work.syncStatus)}
                      </AppBadge>
                      {autoDeleteLabel && (
                        <AppBadge tone="danger">{autoDeleteLabel}</AppBadge>
                      )}
                      {isRestoring && (
                        <AppBadge tone="accent">
                          {t('works.list.restoring')}
                        </AppBadge>
                      )}
                    </Group>

                    <Title lineClamp={1} order={3} size="h4">
                      <Link
                        style={{ color: 'inherit', textDecoration: 'none' }}
                        to={`/works/${work.id}`}
                      >
                        {work.title}
                      </Link>
                    </Title>

                    <Text
                      className={cn(css.trashDeletedMeta)}
                      c="dimmed"
                      lineClamp={1}
                      size="xs"
                    >
                      {work.author || t('works.form.creatorMissing')}
                      {t('works.list.trashDeletedDate')}
                      {formatWorkDateTime(work.deletedAt ?? work.updatedAt)}
                    </Text>

                    <Text c="var(--mantine-color-text)" lineClamp={2}>
                      {work.shortReview ||
                        work.description ||
                        t('works.list.noMemo')}
                    </Text>
                  </Stack>
                </Group>

                <Stack className={cn(css.listRowControls)} gap="xs">
                  <ActionRow justify="flex-end">
                    <AppButton
                      disabled={isBusy}
                      onClick={() => void onRestore(work)}
                      size="compact-sm"
                      tone="primary"
                      type="button"
                    >
                      {isRestoring
                        ? t('works.list.restoringProgress')
                        : t('works.list.restoreAction')}
                    </AppButton>
                    <AppButton
                      disabled={isBusy}
                      leftSection={<IconTrash size={13} />}
                      onClick={() => void onPermanentDelete(work)}
                      size="compact-sm"
                      tone="danger"
                      type="button"
                    >
                      {isDeleting
                        ? t('works.list.permanentDeleteProgress')
                        : t('works.list.permanentDeleteAction')}
                    </AppButton>
                    <AppLinkButton
                      size="compact-sm"
                      to={`/works/${work.id}`}
                      tone="quiet"
                    >
                      {t('works.list.viewDetail')}
                    </AppLinkButton>
                  </ActionRow>
                  <Text
                    className={cn(css.trashRiskText)}
                    c="dimmed"
                    size="xs"
                    ta="right"
                  >
                    {t('works.list.trashRestoreDescription')}
                  </Text>
                </Stack>
              </Group>
            </Paper>
          );
        })}
      </Stack>
    </section>
  );
}
