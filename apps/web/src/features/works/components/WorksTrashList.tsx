import { Group, Paper, Stack, Text, Title } from '@mantine/core';
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
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface WorksTrashListProps {
  onRestore: (work: WorkRecord) => Promise<void>;
  restoringWorkId: string | null;
  works: WorkRecord[];
}

export function WorksTrashList({
  onRestore,
  restoringWorkId,
  works,
}: WorksTrashListProps) {
  const { t } = useAppTranslation();

  return (
    <section aria-label={t('works.list.trashListAria')}>
      <Stack gap="md">
        {works.map((work) => {
          const isRestoring = restoringWorkId === work.id;
          const typeLabel = getWorkTypeLabel(work.type);

          return (
            <Paper
              className={`${cn(css.listRowSurface)} ${cn(css.trashRowSurface)}`}
              key={work.id}
              radius="lg"
              style={{
                opacity: isRestoring ? 0.78 : 1,
              }}
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
                  <Link
                    aria-label={t('works.list.trashDetailAria', {
                      title: work.title,
                    })}
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
                      {t('works.list.trashUpdatedDate')}
                      {formatWorkDateTime(work.updatedAt)}
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
                      disabled={isRestoring}
                      onClick={() => void onRestore(work)}
                      size="compact-sm"
                      tone="primary"
                      type="button"
                    >
                      {isRestoring
                        ? t('works.list.restoringProgress')
                        : t('works.list.restoreAction')}
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
