import type { FormEvent, RefObject } from 'react';
import type { WorkRecord } from '@work-archive/shared-types';
import { Stack } from '@mantine/core';

import type { ImportCandidate } from '@features/imports';
import { FeedbackMessage } from '@shared/components/AppPrimitives';
import { AddWorkManualFields } from './AddWorkManualFields';
import { AddWorkSaveFooter, type DraftSaveStatus } from './AddWorkSaveFooter';
import { DuplicateWorkCandidatesCard } from './DuplicateWorkCandidatesCard';
import { ImportedCandidateSummary } from './ImportedCandidateSummary';
import {
  type AddWorkSuggestions,
  type WorkFormInputChangeHandler,
  type WorkFormListFieldName,
} from './add-work-form.types';
import type { CandidateSourceCoverage } from './quick-add-helpers';
import type { WorkFormValues } from '../utils/work-form';

interface CandidateFieldSummary {
  filled: string[];
  missing: string[];
}

interface AddWorkManualFormProps {
  duplicateCandidates: WorkRecord[];
  fieldSummary: CandidateFieldSummary;
  isDialog: boolean;
  isSubmitting: boolean;
  onBackToSearch: () => void;
  onCancel?: () => void;
  onInputChange: WorkFormInputChangeHandler;
  onRatingChange: (rating: number | null) => void;
  onResetImportedCandidate: () => void;
  onSeriesFieldsClear: () => void;
  onStatusChange: (status: WorkFormValues['status']) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onTextListChange: (name: WorkFormListFieldName, values: string[]) => void;
  saveStatus: DraftSaveStatus;
  selectedImportCandidate: ImportCandidate | null;
  sourceCoverage: CandidateSourceCoverage | null;
  submitError: string | null;
  suggestions: AddWorkSuggestions;
  titleError: string | null;
  titleInputRef: RefObject<HTMLInputElement | null>;
  validationError: string | null;
  values: WorkFormValues;
}

export function AddWorkManualForm({
  duplicateCandidates,
  fieldSummary,
  isDialog,
  isSubmitting,
  onBackToSearch,
  onCancel,
  onInputChange,
  onRatingChange,
  onResetImportedCandidate,
  onSeriesFieldsClear,
  onStatusChange,
  onSubmit,
  onTextListChange,
  saveStatus,
  selectedImportCandidate,
  sourceCoverage,
  submitError,
  suggestions,
  titleError,
  titleInputRef,
  validationError,
  values,
}: AddWorkManualFormProps) {
  const saveFooter = (
    <AddWorkSaveFooter
      duplicateCount={duplicateCandidates.length}
      isSubmitting={isSubmitting}
      saveStatus={saveStatus}
      {...(onCancel ? { onCancel } : {})}
    />
  );

  return (
    <form onSubmit={onSubmit}>
      <Stack gap={isDialog ? 'lg' : 'xl'}>
        {selectedImportCandidate && sourceCoverage && (
          <ImportedCandidateSummary
            candidate={selectedImportCandidate}
            fieldSummary={fieldSummary}
            onBackToSearch={onBackToSearch}
            onReset={onResetImportedCandidate}
            sourceCoverage={sourceCoverage}
          />
        )}

        <AddWorkManualFields
          duplicateCount={duplicateCandidates.length}
          onInputChange={onInputChange}
          onRatingChange={onRatingChange}
          onSeriesFieldsClear={onSeriesFieldsClear}
          onStatusChange={onStatusChange}
          onTextListChange={onTextListChange}
          primaryActions={saveFooter}
          sourceLabel={selectedImportCandidate?.sourceLabel ?? null}
          suggestions={suggestions}
          titleError={titleError}
          titleInputRef={titleInputRef}
          values={values}
        />

        <DuplicateWorkCandidatesCard candidates={duplicateCandidates} />

        {(validationError || submitError) && (
          <FeedbackMessage tone="error">
            {validationError ?? submitError}
          </FeedbackMessage>
        )}
      </Stack>
    </form>
  );
}
