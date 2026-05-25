import { liveQuery } from 'dexie';
import type {
  CatalogSearchMediumType,
  WorkRecord,
} from '@work-archive/shared-types';
import { Grid, Group, Paper, SegmentedControl, Stack, Text } from '@mantine/core';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
} from '@shared/components/AppPrimitives';
import { importsService, type ImportCandidate } from '@features/imports';
import { useImportProviderReadiness } from '@features/imports';
import { useAuthSession } from '@features/auth';
import { AddWorkSearchPanel } from './AddWorkSearchPanel';
import { AdvancedWorkFields } from './AdvancedWorkFields';
import { CoreWorkFields } from './CoreWorkFields';
import { PersonalRecordFields } from './PersonalRecordFields';
import { ProviderReadinessSummary } from './ProviderReadinessSummary';
import { QuickCapturePreview } from './QuickCapturePreview';
import { ImportedCandidateSummary } from './ImportedCandidateSummary';
import styles from './ArchiveComponents.module.css';
import type { WorkFormListFieldName } from './add-work-form.types';
import {
  buildImportIdentity,
  createValuesFromCandidate,
  findLikelyMatches,
  getCandidateSourceCoverage,
  getProviderGroupProviders,
  getVisibleSearchCandidates,
  type ProviderGroup,
} from './quick-add-helpers';
import { DuplicateWorkCandidatesCard } from './DuplicateWorkCandidatesCard';
import { findDuplicateWorkCandidates } from '../hooks/useDuplicateWorkCandidates';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import { useWorkFormDraft } from '../hooks/useWorkFormDraft';
import { worksRepository } from '../services/works.repository';
import { worksService } from '../services/works.service';
import { DEFAULT_WORKS_LIST_QUERY } from '../utils/query-works';
import {
  createDefaultWorkFormValues,
  formatTextListForWorkForm,
  getDisplayAuthorFromWorkFormValues,
  parseWorkFormValues,
  type UpsertWorkInput,
  type WorkFormValues,
} from '../utils/work-form';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

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
  const { archiveScopeKey } = useAuthSession();
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'manual' | 'search'>('manual');
  const [values, setValues] = useState<WorkFormValues>(() =>
    createFormDefaults(),
  );
  const [existingWorks, setExistingWorks] = useState<WorkRecord[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<CatalogSearchMediumType>('all');
  const [providerGroup, setProviderGroup] = useState<ProviderGroup>('all');
  const [searchCandidates, setSearchCandidates] = useState<ImportCandidate[]>(
    [],
  );
  const [selectedSearchCandidate, setSelectedSearchCandidate] =
    useState<ImportCandidate | null>(null);
  const [selectedImportCandidate, setSelectedImportCandidate] =
    useState<ImportCandidate | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [workSuggestions, setWorkSuggestions] = useState({
    organizationContributorSuggestions: [] as string[],
    personContributorSuggestions: [] as string[],
    seriesSuggestions: [] as string[],
    tagSuggestions: [] as string[],
  });
  const providerReadiness = useImportProviderReadiness(mode === 'search');
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

  useEffect(() => {
    const subscription = liveQuery(() => worksRepository.listAll()).subscribe({
      next: (works) => {
        setExistingWorks(works);
      },
      error: () => {
        setExistingWorks([]);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

  useEffect(() => {
    const subscription = liveQuery(() =>
      worksService.listWorks(DEFAULT_WORKS_LIST_QUERY, 'active'),
    ).subscribe({
      next: ({
        organizationContributorSuggestions,
        personContributorSuggestions,
        seriesSuggestions,
        tagSuggestions,
      }) => {
        setWorkSuggestions({
          organizationContributorSuggestions,
          personContributorSuggestions,
          seriesSuggestions,
          tagSuggestions,
        });
      },
      error: () => {
        setWorkSuggestions({
          organizationContributorSuggestions: [],
          personContributorSuggestions: [],
          seriesSuggestions: [],
          tagSuggestions: [],
        });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

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
  function handleInputChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
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
  }

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
    setSelectedSearchCandidate(null);
    setSearchNotice(null);
    setSearchError(null);
  }

  function focusMainTitle() {
    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });
  }

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedSearchTerm = searchTerm.trim();

    if (!normalizedSearchTerm) {
      setSearchError('먼저 작품 제목이나 작가를 검색해주세요.');
      return;
    }

    setSearchError(null);
    setSearchNotice(null);
    setSelectedSearchCandidate(null);
    setSearchCandidates([]);
    setHasSearched(true);

    try {
      setIsSearching(true);

      const providerGroupProviders = getProviderGroupProviders(providerGroup);
      const result = await importsService.searchCandidates(
        normalizedSearchTerm,
        {
          limit: 10,
          mediumType: searchType,
          ...(providerGroupProviders
            ? { providers: providerGroupProviders }
            : {}),
          useExternal: true,
        },
      );
      const visibleCandidates = getVisibleSearchCandidates(
        result.candidates,
        providerGroup,
      );

      setSearchCandidates(visibleCandidates);
      setSearchNotice(result.notice);
      setSelectedSearchCandidate(visibleCandidates[0] ?? null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '후보 검색에 실패했습니다.';

      setSearchError(
        `${message} 검색 없이도 입력한 제목으로 직접 추가를 계속할 수 있습니다.`,
      );
      setSearchCandidates([]);
      setSelectedSearchCandidate(null);
      setSearchNotice(null);
    } finally {
      setIsSearching(false);
    }
  }

  function applyCandidateToForm() {
    if (!selectedSearchCandidate) {
      setSearchError('검색 결과에서 먼저 작품을 선택해주세요.');
      return;
    }

    setValues(
      createValuesFromCandidate(
        selectedSearchCandidate,
        createDefaultWorkFormValues,
      ),
    );
    setSelectedImportCandidate(selectedSearchCandidate);
    setMode('manual');
    setValidationError(null);
    setTitleError(null);
    focusMainTitle();
  }

  function useSearchTermForManualInput() {
    const normalizedSearchTerm = searchTerm.trim();

    if (!normalizedSearchTerm) {
      return;
    }

    resetImportedCandidate();
    setMode('manual');
    setValues((currentValues) => ({
      ...currentValues,
      title: normalizedSearchTerm,
    }));
    setValidationError(null);
    setTitleError(null);
    focusMainTitle();
  }

  function handleProviderGroupChange(value: ProviderGroup) {
    setProviderGroup(value);
    setSearchCandidates([]);
    setSelectedSearchCandidate(null);
    setSearchNotice(null);
    setSearchError(null);
    setHasSearched(false);
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
    <Stack gap={variant === 'dialog' ? 'md' : 'lg'}>
      {draft.pendingDraft && (
        <FeedbackMessage title="임시작성 있음" tone="info">
          <ActionRow justify="space-between">
            <Text c="inherit">이전에 작성하던 내용이 있습니다.</Text>
            <ActionRow justify="flex-end">
              <AppButton
                onClick={draft.applyDraft}
                size="compact-sm"
                tone="secondary"
                type="button"
              >
                이어서 작성하기
              </AppButton>
              <AppButton
                onClick={draft.clearDraft}
                size="compact-sm"
                tone="ghost"
                type="button"
              >
                임시작성 삭제
              </AppButton>
            </ActionRow>
          </ActionRow>
        </FeedbackMessage>
      )}
      <Stack gap="sm">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <div>
            <Text
              c="var(--mantine-color-text)"
              fw={800}
              size={variant === 'dialog' ? 'lg' : 'xl'}
            >
              새 작품 기록
            </Text>
            <Text c="var(--mantine-color-dimmed)" size="sm">
              직접 입력으로 바로 저장할 수 있고, 검색은 작품 정보를 채우는 선택
              도구입니다.
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
                setSearchError(null);
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
          onSearchTypeChange={(value) =>
            setSearchType(value as CatalogSearchMediumType)
          }
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
        <form onSubmit={handleSubmit}>
          <Stack gap={variant === 'dialog' ? 'lg' : 'xl'}>
            {selectedImportCandidate && importedSourceCoverage && (
              <ImportedCandidateSummary
                candidate={selectedImportCandidate}
                fieldSummary={importedFieldSummary}
                onBackToSearch={() => setMode('search')}
                onReset={resetImportedCandidate}
                sourceCoverage={importedSourceCoverage}
              />
            )}

            {variant === 'page' ? (
              <Grid align="start" gutter="xl">
                <Grid.Col span={{ base: 12, lg: 8 }}>
                  <Stack gap="xl">
                    <CoreWorkFields
                      error={titleError}
                      idPrefix="manual"
                      onChange={handleInputChange}
                      onTextListChange={handleTextListChange}
                      titleInputRef={titleInputRef}
                      values={values}
                    />

                    <PersonalRecordFields
                      idPrefix="manual"
                      onInputChange={handleInputChange}
                      onRatingChange={handleRatingChange}
                      onStatusChange={handleStatusChange}
                      values={values}
                    />

                    <AdvancedWorkFields
                      idPrefix="manual"
                      itemValue="manual-advanced-fields"
                      onInputChange={handleInputChange}
                      onSeriesFieldsClear={handleSeriesFieldsClear}
                      onTextListChange={handleTextListChange}
                      organizationContributorSuggestions={
                        workSuggestions.organizationContributorSuggestions
                      }
                      personContributorSuggestions={
                        workSuggestions.personContributorSuggestions
                      }
                      seriesSuggestions={workSuggestions.seriesSuggestions}
                      tagSuggestions={workSuggestions.tagSuggestions}
                      values={values}
                    />
                  </Stack>
                </Grid.Col>
                <Grid.Col span={{ base: 12, lg: 4 }}>
                  <QuickCapturePreview
                    duplicateCount={duplicateCandidates.length}
                    sourceLabel={selectedImportCandidate?.sourceLabel ?? null}
                    values={values}
                  />
                </Grid.Col>
              </Grid>
            ) : (
              <>
                <CoreWorkFields
                  error={titleError}
                  idPrefix="manual"
                  onChange={handleInputChange}
                  onTextListChange={handleTextListChange}
                  titleInputRef={titleInputRef}
                  values={values}
                />

                <PersonalRecordFields
                  idPrefix="manual"
                  onInputChange={handleInputChange}
                  onRatingChange={handleRatingChange}
                  onStatusChange={handleStatusChange}
                  values={values}
                />

                <AdvancedWorkFields
                  idPrefix="manual"
                  itemValue="manual-advanced-fields"
                  onInputChange={handleInputChange}
                  onSeriesFieldsClear={handleSeriesFieldsClear}
                  onTextListChange={handleTextListChange}
                  organizationContributorSuggestions={
                    workSuggestions.organizationContributorSuggestions
                  }
                  personContributorSuggestions={
                    workSuggestions.personContributorSuggestions
                  }
                  seriesSuggestions={workSuggestions.seriesSuggestions}
                  tagSuggestions={workSuggestions.tagSuggestions}
                  values={values}
                />
              </>
            )}

            <DuplicateWorkCandidatesCard candidates={duplicateCandidates} />

            {(validationError || submitError) && (
              <FeedbackMessage tone="error">
                {validationError ?? submitError}
              </FeedbackMessage>
            )}

            <Paper
              className={cn(css.addWorkSaveFooter)}
              p="sm"
              radius="lg"
              withBorder
            >
              <Stack gap="xs">
                {duplicateCandidates.length > 0 && (
                  <ActionRow>
                    <AppBadge tone="warning">기존 기록 확인 필요</AppBadge>
                    <Text c="var(--mantine-color-dimmed)" size="sm">
                      비슷한 기록 {duplicateCandidates.length}개를 확인한 뒤
                      저장하세요.
                    </Text>
                  </ActionRow>
                )}
                <ActionRow>
                  <AppButton
                    disabled={isSubmitting}
                    fullWidth
                    size="lg"
                    tone="primary"
                    type="submit"
                  >
                    {isSubmitting ? '저장 중...' : '내 아카이브에 저장'}
                  </AppButton>
                  {onCancel ? (
                    <AppButton onClick={onCancel} tone="quiet" type="button">
                      취소
                    </AppButton>
                  ) : (
                    <AppLinkButton to="/works" tone="quiet">
                      취소
                    </AppLinkButton>
                  )}
                  {draft.saveStatus === 'saving' && (
                    <AppBadge tone="muted">임시저장 중</AppBadge>
                  )}
                  {draft.saveStatus === 'saved' && (
                    <AppBadge tone="success">임시저장됨</AppBadge>
                  )}
                  {draft.saveStatus === 'restored' && (
                    <AppBadge tone="accent">임시작성 복구됨</AppBadge>
                  )}
                </ActionRow>
              </Stack>
            </Paper>
          </Stack>
        </form>
      )}
    </Stack>
  );
}
