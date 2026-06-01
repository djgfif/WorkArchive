import { Group, SegmentedControl, Stack, Text } from '@mantine/core';
import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import type { ImportCandidate } from '@features/imports';
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

function getCandidateFieldSummary(values: WorkFormValues) {
  const filled = [
    values.title.trim() ? '제목' : null,
    getDisplayAuthorFromWorkFormValues(values) ? '제작진' : null,
    values.thumbnailUrl.trim() ? '표지' : null,
    values.genresText.trim() ? '장르' : null,
    values.description.trim() ? '설명' : null,
  ].filter(Boolean) as string[];
  const missing = [
    values.shortReview.trim() ? null : '한줄평',
    values.rating ? null : '별점',
    values.personalTagsText.trim() ? null : '개인 태그',
  ].filter(Boolean) as string[];

  return { filled, missing };
}

export function AddWorkFlow({
  draftKey = null,
  isSubmitting,
  onCancel,
  onSubmit,
  submitError,
  variant = 'page',
}: AddWorkFlowProps) {
  const isDialog = variant === 'dialog';
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'manual' | 'search'>('manual');
  const [values, setValues] = useState<WorkFormValues>(() =>
    createFormDefaults(),
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
  const draftBaselineValues = useMemo(() => createFormDefaults(), []);
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
  const importedFieldSummary = getCandidateFieldSummary(values);
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
        const message = '제목을 입력해주세요.';

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
        error instanceof Error ? error.message : '작품을 저장하지 못했습니다.',
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
                새 작품 기록
              </Text>
            )}
            <Text c="var(--mantine-color-dimmed)" size="sm">
              제목만으로 시작하고, 필요할 때 검색 후보로 표지와 기본 정보를 채웁니다.
            </Text>
          </div>

          <SegmentedControl
            aria-label="추가 방식"
            data={[
              { label: '직접 입력', value: 'manual' },
              { label: '검색으로 채우기', value: 'search' },
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
