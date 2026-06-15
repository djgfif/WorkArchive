import { Checkbox, Group, Paper, Stack, Text } from '@mantine/core';

import { AppButton } from '@shared/components/AppPrimitives';
import { useAppTranslation } from '@app/i18n';
import { IconTrash } from './WorksToolbarIcons';
import { cn } from '@shared/utils/class-names';
import styles from './ArchiveComponents.module.css';

const css = styles;

interface WorksTrashToolbarProps {
  allSelected: boolean;
  onClearSelection: () => void;
  onEmptyTrash: () => void;
  onPermanentDeleteSelected: () => void;
  onRestoreAll: () => void;
  onRestoreSelected: () => void;
  onToggleSelectAll: () => void;
  retentionDays: number;
  selectedCount: number;
}

export function WorksTrashToolbar({
  allSelected,
  onClearSelection,
  onEmptyTrash,
  onPermanentDeleteSelected,
  onRestoreAll,
  onRestoreSelected,
  onToggleSelectAll,
  retentionDays,
  selectedCount,
}: WorksTrashToolbarProps) {
  const { t } = useAppTranslation();
  const hasSelection = selectedCount > 0;

  return (
    <Paper className={cn(css.trashToolbar)} p="sm" radius="lg" withBorder>
      <Group align="center" gap="sm" justify="space-between" wrap="wrap">
        <Checkbox
          checked={allSelected}
          indeterminate={hasSelection && !allSelected}
          label={
            hasSelection
              ? t('works.list.selectionCount', { total: selectedCount })
              : t('works.list.selectAll')
          }
          onChange={onToggleSelectAll}
        />

        <Group gap="xs" wrap="wrap">
          {hasSelection ? (
            <>
              <AppButton
                onClick={onRestoreSelected}
                size="compact-sm"
                tone="secondary"
                type="button"
              >
                {t('works.list.restoreSelected')}
              </AppButton>
              <AppButton
                leftSection={<IconTrash size={13} />}
                onClick={onPermanentDeleteSelected}
                size="compact-sm"
                tone="danger"
                type="button"
              >
                {t('works.list.permanentDeleteSelected')}
              </AppButton>
              <AppButton
                onClick={onClearSelection}
                size="compact-sm"
                tone="quiet"
                type="button"
              >
                {t('works.list.clearSelection')}
              </AppButton>
            </>
          ) : (
            <>
              <AppButton
                onClick={onRestoreAll}
                size="compact-sm"
                tone="secondary"
                type="button"
              >
                {t('works.list.restoreAllAction')}
              </AppButton>
              <AppButton
                leftSection={<IconTrash size={13} />}
                onClick={onEmptyTrash}
                size="compact-sm"
                tone="danger"
                type="button"
              >
                {t('works.list.emptyTrashAction')}
              </AppButton>
            </>
          )}
        </Group>
      </Group>

      <Stack gap={0} mt="xs">
        <Text c="dimmed" size="xs">
          {t('works.list.trashRetentionNotice', { days: retentionDays })}
        </Text>
      </Stack>
    </Paper>
  );
}
