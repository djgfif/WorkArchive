import { Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { useMemo, useRef, useState, type FormEvent } from 'react';

import type { ImportCandidate } from '@features/imports';
import { useAppTranslation } from '@app/i18n';
import { AddWorkManualForm } from './AddWorkManualForm';
import { AddWorkSearchPanel } from './AddWorkSearchPanel';
import { ProviderReadinessSummary } from './ProviderReadinessSummary';
import { WorkFormDraftNotice } from './WorkFormSubmitControls';
import {
  type WorkFormInputChangeHandler,
  type WorkFormListFieldName,
} from './add-work-form.types';
import {
  buildImportIdentity,
  createValuesFromCandidate,
  findLikelyMatches,
  getCandidateSourceCoverage,
} from './quick-add-helpers';
import { useAddWorkReferenceData } from '../hooks/useAddWorkReferenceData';
import { useAddWorkSearch } from '../hooks/useAddWorkSearch';
import { findDuplicateWorkCandidates } from '../hooks/useDuplicateWorkCandidates';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import { useWorkFormDraft } from '../hooks/useWorkFormDraft';
import {
  createDefaultWorkFormValues,
  formatTextListForWorkForm,
  getDisplayAuthorFromWorkFormValues,
  parseWorkFormValues,
  type UpsertWorkInput,
  type WorkFormValues,
} from '../utils/work-form';

interface AddWorkFlowProps {
  draftKey?: string | null;
  initialMode?: 'manual' | 'search';
  initialTitle?: string;
  isSubmitting: boolean;
  onSubmit: (input: UpsertWorkInput) => Promise<void>;
  onCancel?: () => void;
  submitError: string | null;
  variant?: 'dialog' | 'page';
}

function createFormDefaults(title = ''): WorkFormValues {
  return {
    ...createDefaultWorkFormValues(),
    title,
  };
}

function getCandidateFieldSummary(
  values: WorkFormValues,
  t: ReturnType<typeof useAppTranslation>['t'],
) {
  const filled = [
    values.title.trim() ? t('works.add.fieldTitle') : null,
    getDisplayAuthorFromWorkFormValues(values)
      ? t('works.add.fieldContributor')
      : null,
    values.thumbnailUrl.trim() ? t('works.add.fieldCover') : null,
    values.genresText.trim() ? t('works.add.fieldGenre') : null,
    values.description.trim() ? t('works.add.fieldDescription') : null,
  ].filter(Boolean) as string[];
  const missing = [
    values.shortReview.trim() ? null : t('works.add.fieldShortReview'),
    values.rating ? null : t('works.add.fieldRating'),
    values.personalTagsText.trim() ? null : t('works.add.fieldPersonalTags'),
  ].filter(Boolean) as string[];

  return { filled, missing };
}

export function AddWorkFlow({
  draftKey = null,
  initialMode = 'manual',
  initialTitle = '',
  isSubmitting,
  onCancel,
  onSubmit,
  submitError,
  variant = 'page',
}: AddWorkFlowProps) {
  const { t } = useAppTranslation();
  const isDialog = variant === 'dialog';
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'manual' | 'search'>(initialMode);
  const [values, setValues] = useState<WorkFormValues>(() =>
    createFormDefaults(initialTitle),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedImportCandidate, setSelectedImportCandidate] =
    useState<ImportCandidate | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const { existingWorks, workSuggestions } = useAddWorkReferenceData();
  const {
    applyCandidateToForm,
    clearSearchError,
    handleProviderGroupChange,
    handleSearchSubmit,
    handleSearchTypeChange,
    hasSearched,
    isSearching,
    providerGroup,
    providerReadiness,
    resetSearchSelection,
    searchCandidates,
    searchError,
    searchNotice,
    searchTerm,
    searchType,
    selectedSearchCandidate,
    setSearchTerm,
    setSelectedSearchCandidate,
    useSearchTermForManualInput,
  } = useAddWorkSearch({
    enabled: mode === 'search',
    onApplyCandidate: (candidate) => {
      setValues(
        createValuesFromCandidate(candidate, createDefaultWorkFormValues),
      );
      setSelectedImportCandidate(candidate);
      setMode('manual');
      setValidationError(null);
      setTitleError(null);
      focusMainTitle();
    },
    onUseManualTitle: (title) => {
      setSelectedImportCandidate(null);
      setMode('manual');
      setValues((currentValues) => ({
        ...currentValues,
        title,
      }));
      setValidationError(null);
      setTitleError(null);
      focusMainTitle();
    },
  });
  const draftBaselineValues = useMemo(
    () => createFormDefaults(initialTitle),
    [initialTitle],
  );
  const draft = useWorkFormDraft({
    baselineValues: draftBaselineValues,
    draftKey,
    enabled: Boolean(draftKey),
    onRestore: (draftValues) => {
      resetImportedCandidate();
      setMode('manual');
      setValues(draftValues);
      setValidationError(null);
      setTitleError(null);
      focusMainTitle();
    },
    values,
  });
  useUnsavedChangesWarning(Boolean(draftKey) && draft.isDirty && !isSubmitting);

  const duplicateCounts = Object.fromEntries(
    searchCandidates.map((candidate) => [
      candidate.id,
      findLikelyMatches(candidate, existingWorks).length,
    ]),
  );
  const selectedDuplicateMatches =
    selectedSearchCandidate === null
      ? []
      : findLikelyMatches(selectedSearchCandidate, existingWorks);
  const duplicateCandidates = findDuplicateWorkCandidates({
    catalogTitleId: selectedImportCandidate?.catalogMatch?.id ?? null,
    title: values.title,
    type: values.type,
    works: existingWorks,
  });
  const importedSourceCoverage = selectedImportCandidate
    ? getCandidateSourceCoverage(selectedImportCandidate)
    : null;
  const importedFieldSummary = getCandidateFieldSummary(values, t);
  const handleInputChange: WorkFormInputChangeHandler = (event) => {
    const { name, type } = event.target;

    if (name === 'title') {
      setTitleError(null);
      setValidationError(null);
    }

    setValues((currentValues) => ({
      ...currentValues,
      [name]:
        type === 'checkbox'
          ? (event.target as HTMLInputElement).checked
          : event.target.value,
    }));
  };

  function handleStatusChange(status: WorkFormValues['status']) {
    setValues((currentValues) => ({
      ...currentValues,
      status,
    }));
  }

  function handleRatingChange(rating: number | null) {
    setValues((currentValues) => ({
      ...currentValues,
      rating: rating === null ? '' : rating.toString(),
    }));
  }

  function handleTextListChange(name: WorkFormListFieldName, items: string[]) {
    setValues((currentValues) => ({
      ...currentValues,
      [name]: formatTextListForWorkForm(items),
    }));
  }

  function handleSeriesFieldsClear() {
    setValues((currentValues) => ({
      ...currentValues,
      seriesText: '',
      universeText: '',
    }));
  }

  function resetImportedCandidate() {
    setSelectedImportCandidate(null);
    resetSearchSelection();
  }

  function focusMainTitle() {
    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setValidationError(null);
      setTitleError(null);

      if (!values.title.trim()) {
        const message = t('works.form.titleRequired');

        setTitleError(message);
        setValidationError(message);
        focusMainTitle();
        return;
      }

      const input = parseWorkFormValues(values);

      await onSubmit({
        ...input,
        ...(selectedImportCandidate
          ? buildImportIdentity(selectedImportCandidate, input)
          : {
              catalogTitleId: null,
              importDraft: null,
            }),
      });
      draft.clearDraft();
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : t('works.form.saveError'),
      );
    }
  }

  return (
    <Stack gap={isDialog ? 'md' : 'lg'}>
      {draft.pendingDraft && (
        <WorkFormDraftNotice
          onApplyDraft={draft.applyDraft}
          onClearDraft={draft.clearDraft}
        />
      )}
      <Stack gap="sm">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <div>
            {!isDialog && (
              <Text c="var(--mantine-color-text)" fw={800} size="xl">
                {t('works.add.flowTitle')}
              </Text>
            )}
            <Text c="var(--mantine-color-dimmed)" size="sm">
              {t('works.add.flowDescription')}
            </Text>
          </div>

          <SegmentedControl
            aria-label={t('works.add.modeLabel')}
            data={[
              { label: t('works.add.modeManual'), value: 'manual' },
              { label: t('works.add.modeSearch'), value: 'search' },
            ]}
            onChange={(value) => {
              const nextMode = value as 'manual' | 'search';

              setMode(nextMode);
              if (nextMode === 'manual') {
                focusMainTitle();
              } else {
                clearSearchError();
              }
            }}
            value={mode}
          />
        </Group>
      </Stack>

      {mode === 'search' ? (
        <AddWorkSearchPanel
          candidates={searchCandidates}
          duplicateCounts={duplicateCounts}
          duplicateMatches={selectedDuplicateMatches}
          fullHeight={variant === 'dialog'}
          hasSearched={hasSearched}
          isSearching={isSearching}
          onApplyCandidate={applyCandidateToForm}
          onProviderGroupChange={handleProviderGroupChange}
          onSearchSubmit={handleSearchSubmit}
          onSearchTermChange={setSearchTerm}
          onSearchTypeChange={handleSearchTypeChange}
          onSelectCandidate={setSelectedSearchCandidate}
          onUseManualTitle={useSearchTermForManualInput}
          providerGroup={providerGroup}
          providerReadinessSummary={
            <ProviderReadinessSummary
              error={providerReadiness.error}
              isLoading={providerReadiness.isLoading}
              readiness={providerReadiness.readiness}
            />
          }
          searchError={searchError}
          searchNotice={searchNotice}
          searchTerm={searchTerm}
          searchType={searchType}
          selectedCandidate={selectedSearchCandidate}
        />
      ) : (
        <AddWorkManualForm
          duplicateCandidates={duplicateCandidates}
          fieldSummary={importedFieldSummary}
          isDialog={isDialog}
          isSubmitting={isSubmitting}
          onBackToSearch={() => setMode('search')}
          onInputChange={handleInputChange}
          onRatingChange={handleRatingChange}
          onResetImportedCandidate={resetImportedCandidate}
          onSeriesFieldsClear={handleSeriesFieldsClear}
          onStatusChange={handleStatusChange}
          onSubmit={handleSubmit}
          onTextListChange={handleTextListChange}
          saveStatus={draft.saveStatus}
          selectedImportCandidate={selectedImportCandidate}
          sourceCoverage={importedSourceCoverage}
          submitError={submitError}
          suggestions={workSuggestions}
          titleError={titleError}
          titleInputRef={titleInputRef}
          validationError={validationError}
          values={values}
          {...(onCancel ? { onCancel } : {})}
        />
      )}
    </Stack>
  );
}
