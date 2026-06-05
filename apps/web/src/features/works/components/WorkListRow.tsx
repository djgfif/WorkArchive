import { cn } from '@shared/utils/class-names';
import { Paper } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import { getWorkTypeLabel } from '../utils/work-options';
import {
  getProgressLabel,
  getProgressPercent,
} from '../utils/work-list-row-state';
import styles from './ArchiveComponents.module.css';
import { WorkListRowQuickEditPanel } from './WorkListRowQuickEditPanel';
import { WorkListRowSummary } from './WorkListRowSummary';
import type { WorkListRowProps } from './work-list-row.types';

export type {
  WorkQuickProgressUpdate,
  WorkQuickUpdate,
} from './work-list-row.types';

const css = styles;

export function WorkListRow({
  index,
  isUpdating,
  onDelete,
  onQuickProgressUpdate,
  onQuickUpdate,
  work,
}: WorkListRowProps) {
  const typeLabel = getWorkTypeLabel(work.type);
  const progressLabel = getProgressLabel(work);
  const progressPercent = getProgressPercent(work);
  const [editOpen, { toggle: toggleEdit }] = useDisclosure(false);

  return (
    <Paper className={cn(css.listRowSurface)} radius={0}>
      <WorkListRowSummary
        editOpen={editOpen}
        {...(index !== undefined ? { index } : {})}
        isUpdating={isUpdating}
        onToggleEdit={toggleEdit}
        progressLabel={progressLabel}
        progressPercent={progressPercent}
        typeLabel={typeLabel}
        work={work}
      />

      <WorkListRowQuickEditPanel
        expanded={editOpen}
        isUpdating={isUpdating}
        onDelete={onDelete}
        onQuickProgressUpdate={onQuickProgressUpdate}
        onQuickUpdate={onQuickUpdate}
        work={work}
      />
    </Paper>
  );
}
