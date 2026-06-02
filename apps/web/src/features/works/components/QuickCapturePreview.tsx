import { Paper } from '@mantine/core';

import { WorkPoster } from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';
import type { WorkFormValues } from '../utils/work-form';
import { workTypeOptions } from '../utils/work-options';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface QuickCapturePreviewProps {
  duplicateCount?: number;
  sourceLabel?: string | null;
  values: WorkFormValues;
}

export function QuickCapturePreview({ values }: QuickCapturePreviewProps) {
  const previewTitle = values.title.trim() || '제목 없는 작품';
  const typeLabel =
    workTypeOptions.find((option) => option.value === values.type)?.label ??
    '작품';

  return (
    <Paper className={cn(css.quickCapturePreview)} withBorder>
      <WorkPoster
        coverSeed={`quick:${values.type}:${previewTitle}`}
        thumbnailUrl={values.thumbnailUrl}
        title={previewTitle}
        typeLabel={typeLabel}
        variant="form"
      />
    </Paper>
  );
}
