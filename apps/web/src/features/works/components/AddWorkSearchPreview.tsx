import { Grid, Paper } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';
import type { FormEvent } from 'react';

import { useAppTranslation } from '@app/i18n';
import { StateMessage } from '@shared/components/AppPrimitives';
import type { ImportCandidate } from '@features/imports';
import { AddWorkSelectedCandidatePanel } from './AddWorkSelectedCandidatePanel';
import { SearchPreviewLoading } from './AddWorkSearchLoading';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';
import type { WorkFormValues } from '../utils/work-form';

const css = styles;

interface AddWorkSearchPreviewProps {
  duplicateMatches: WorkRecord[];
  fullHeight: boolean;
  hasSearched: boolean;
  isManualSearchGroup: boolean;
  isSearching: boolean;
  isSubmitting: boolean;
  onApplyCandidate: () => void;
  onRatingChange: (rating: number | null) => void;
  onStatusChange: (status: WorkFormValues['status']) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  selectedCandidate: ImportCandidate | null;
  submitError: string | null;
  validationError: string | null;
  values: WorkFormValues;
}

export function AddWorkSearchPreview({
  duplicateMatches,
  fullHeight,
  hasSearched,
  isManualSearchGroup,
  isSearching,
  isSubmitting,
  onApplyCandidate,
  onRatingChange,
  onStatusChange,
  onSubmit,
  selectedCandidate,
  submitError,
  validationError,
  values,
}: AddWorkSearchPreviewProps) {
  const { t } = useAppTranslation();

  return (
    <Grid.Col span={{ base: 12, md: 5 }}>
      <Paper
        className={cn(css.searchPreviewPanel)}
        p="md"
        radius="md"
        {...(fullHeight ? { mih: undefined } : {})}
        withBorder
      >
        {isSearching ? (
          <SearchPreviewLoading />
        ) : selectedCandidate ? (
          <AddWorkSelectedCandidatePanel
            candidate={selectedCandidate}
            duplicateMatches={duplicateMatches}
            isSubmitting={isSubmitting}
            onEditDetails={onApplyCandidate}
            onRatingChange={onRatingChange}
            onStatusChange={onStatusChange}
            onSubmit={onSubmit}
            submitError={submitError}
            validationError={validationError}
            values={values}
          />
        ) : (
          <StateMessage
            description={
              isManualSearchGroup
                ? t('works.add.search.previewManualDescription')
                : hasSearched
                  ? t('works.add.search.previewHasSearchedDescription')
                  : t('works.add.search.noDescription')
            }
            title={
              isManualSearchGroup
                ? t('works.add.search.previewManualTitle')
                : hasSearched
                  ? t('works.add.search.previewHasSearchedTitle')
                  : t('works.add.search.previewInitialTitle')
            }
            tone="info"
          />
        )}
      </Paper>
    </Grid.Col>
  );
}
