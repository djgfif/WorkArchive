import { Grid, Stack } from '@mantine/core';
import type { WorkRecord } from '@work-archive/shared-types';
import { useState, type FormEvent, type ReactNode } from 'react';

import { FeedbackMessage } from '@shared/components/AppPrimitives';
import type { ImportCandidate } from '@features/imports';
import { AddWorkSearchForm } from './AddWorkSearchForm';
import { AddWorkSearchPreview } from './AddWorkSearchPreview';
import { AddWorkSearchResults } from './AddWorkSearchResults';
import type { ProviderGroup } from './quick-add-helpers';
import { isManualProviderGroup } from './quick-add-helpers';
import type { WorkFormValues } from '../utils/work-form';

export interface AddWorkSearchPanelProps {
  candidates: ImportCandidate[];
  duplicateCounts: Record<string, number>;
  duplicateMatches: WorkRecord[];
  fullHeight?: boolean;
  hasSearched: boolean;
  isSearching: boolean;
  isSubmitting: boolean;
  onApplyCandidate: () => void;
  onProviderGroupChange: (value: ProviderGroup) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSearchTermChange: (value: string) => void;
  onSearchTypeChange: (value: string) => void;
  onSelectCandidate: (candidate: ImportCandidate) => void;
  onRatingChange: (rating: number | null) => void;
  onStatusChange: (status: WorkFormValues['status']) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUseManualTitle: () => void;
  providerGroup: ProviderGroup;
  providerReadinessSummary: ReactNode;
  searchError: string | null;
  searchNotice: string | null;
  searchTerm: string;
  searchType: string;
  selectedCandidate: ImportCandidate | null;
  submitError: string | null;
  validationError: string | null;
  values: WorkFormValues;
}

export function AddWorkSearchPanel({
  candidates,
  duplicateCounts,
  duplicateMatches,
  fullHeight = false,
  hasSearched,
  isSearching,
  isSubmitting,
  onApplyCandidate,
  onProviderGroupChange,
  onSearchSubmit,
  onSearchTermChange,
  onSearchTypeChange,
  onSelectCandidate,
  onRatingChange,
  onStatusChange,
  onSubmit,
  onUseManualTitle,
  providerGroup,
  providerReadinessSummary,
  searchError,
  searchNotice,
  searchTerm,
  searchType,
  selectedCandidate,
  submitError,
  validationError,
  values,
}: AddWorkSearchPanelProps) {
  const normalizedSearchTerm = searchTerm.trim();
  const isManualSearchGroup = isManualProviderGroup(providerGroup);
  const [providerOptionsOpen, setProviderOptionsOpen] = useState(false);
  const shouldSuggestProviderChange =
    hasSearched &&
    !isSearching &&
    !isManualSearchGroup &&
    normalizedSearchTerm.length > 0 &&
    candidates.length <= 2;

  return (
    <Stack gap="lg">
      <AddWorkSearchForm
        hasSearched={hasSearched}
        isSearching={isSearching}
        onProviderGroupChange={onProviderGroupChange}
        onProviderOptionsToggle={() =>
          setProviderOptionsOpen((opened) => !opened)
        }
        onSearchSubmit={onSearchSubmit}
        onSearchTermChange={onSearchTermChange}
        onSearchTypeChange={onSearchTypeChange}
        providerGroup={providerGroup}
        providerOptionsOpen={providerOptionsOpen}
        providerReadinessSummary={providerReadinessSummary}
        searchTerm={searchTerm}
        searchType={searchType}
        shouldSuggestProviderChange={shouldSuggestProviderChange}
      />

      {searchError && (
        <FeedbackMessage tone="error">{searchError}</FeedbackMessage>
      )}
      {searchNotice && (
        <FeedbackMessage tone="info">{searchNotice}</FeedbackMessage>
      )}

      <Grid gap="lg">
        <AddWorkSearchResults
          candidates={candidates}
          duplicateCounts={duplicateCounts}
          fullHeight={fullHeight}
          hasSearched={hasSearched}
          isManualSearchGroup={isManualSearchGroup}
          isSearching={isSearching}
          normalizedSearchTerm={normalizedSearchTerm}
          onOpenProviderOptions={() => setProviderOptionsOpen(true)}
          onSelectCandidate={onSelectCandidate}
          onUseManualTitle={onUseManualTitle}
          providerOptionsOpen={providerOptionsOpen}
          selectedCandidate={selectedCandidate}
          shouldSuggestProviderChange={shouldSuggestProviderChange}
        />

        <AddWorkSearchPreview
          duplicateMatches={duplicateMatches}
          fullHeight={fullHeight}
          hasSearched={hasSearched}
          isManualSearchGroup={isManualSearchGroup}
          isSearching={isSearching}
          isSubmitting={isSubmitting}
          onApplyCandidate={onApplyCandidate}
          onRatingChange={onRatingChange}
          onStatusChange={onStatusChange}
          onSubmit={onSubmit}
          selectedCandidate={selectedCandidate}
          submitError={submitError}
          validationError={validationError}
          values={values}
        />
      </Grid>
    </Stack>
  );
}
