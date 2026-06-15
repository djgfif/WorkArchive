import { Paper } from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
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
  const { t } = useAppTranslation();
  const previewTitle = values.title.trim() || t('works.form.previewUntitled');
  const typeLabel =
    workTypeOptions.find((option) => option.value === values.type)?.label ??
    t('works.add.title');

  return (
    <Paper className={cn(css.quickCapturePreview)} withBorder>
      <WorkPoster
        className={cn(css.quickCapturePoster)}
        coverSeed={`quick:${values.type}:${previewTitle}`}
        thumbnailUrl={values.thumbnailUrl}
        title={previewTitle}
        typeLabel={typeLabel}
        variant="form"
      />
    </Paper>
  );
}
