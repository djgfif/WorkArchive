import { Grid, Paper } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';

import { useAppTranslation } from '@app/i18n';
import { StateMessage } from '@shared/components/AppPrimitives';
import type { ImportCandidate } from '@features/imports';
import { CandidatePreviewPanel } from './CandidatePreviewPanel';
import { SearchPreviewLoading } from './AddWorkSearchLoading';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface AddWorkSearchPreviewProps {
  duplicateMatches: WorkRecord[];
  fullHeight: boolean;
  hasSearched: boolean;
  isManualSearchGroup: boolean;
  isSearching: boolean;
  onApplyCandidate: () => void;
  selectedCandidate: ImportCandidate | null;
}

export function AddWorkSearchPreview({
  duplicateMatches,
  fullHeight,
  hasSearched,
  isManualSearchGroup,
  isSearching,
  onApplyCandidate,
  selectedCandidate,
}: AddWorkSearchPreviewProps) {
  const { t } = useAppTranslation();

  return (
    <Grid.Col span={{ base: 12, md: 7 }}>
      <Paper
        className={cn(css.searchPreviewPanel)}
        p="lg"
        radius="md"
        {...(fullHeight ? { mih: undefined } : {})}
        withBorder
      >
        {isSearching ? (
          <SearchPreviewLoading />
        ) : selectedCandidate ? (
          <CandidatePreviewPanel
            candidate={selectedCandidate}
            duplicateMatches={duplicateMatches}
            onApply={onApplyCandidate}
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
