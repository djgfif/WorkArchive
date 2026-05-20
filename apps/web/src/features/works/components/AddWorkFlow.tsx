import { liveQuery } from 'dexie';
import type {
  CatalogSearchMediumType,
  WorkRecord,
} from '@work-archive/shared-types';
import {
  Accordion,
  Alert,
  Checkbox,
  Grid,
  Group,
  NativeSelect,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type RefObject,
} from 'react';

import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  ChipSummary,
  FeedbackMessage,
} from '../../../shared/components/AppPrimitives';
import {
  importsService,
  type ImportCandidate,
} from '../../imports/services/imports.service';
import {
  formatProviderNames,
  useImportProviderReadiness,
  type ProviderReadinessGroup,
} from '../../imports/hooks/useImportProviderReadiness';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { AddWorkSearchPanel } from './AddWorkSearchPanel';
import { WorkPoster } from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';
import {
  buildImportIdentity,
  createValuesFromCandidate,
  findLikelyMatches,
  getCandidateSourceCoverage,
  getProviderGroupProviders,
  getVisibleSearchCandidates,
  type ProviderGroup,
} from './quick-add-helpers';
import { worksRepository } from '../services/works.repository';
import {
  createDefaultWorkFormValues,
  formatTextListForWorkForm,
  parseCommaSeparatedTextList,
  parseWorkFormValues,
  type UpsertWorkInput,
  type WorkFormValues,
} from '../utils/work-form';
import { getPersonalTags } from '../utils/graph-tags';
import { workStatusOptions, workTypeOptions } from '../utils/work-options';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

interface AddWorkFlowProps {
  isSubmitting: boolean;
  onSubmit: (input: UpsertWorkInput) => Promise<void>;
  onCancel?: () => void;
  submitError: string | null;
  variant?: 'dialog' | 'page';
}

const ratingOptions = Array.from({ length: 10 }, (_, index) => {
  const value = (index + 1) * 0.5;

  return {
    label: `${value.toFixed(1)}점`,
    value: value.toString(),
  };
});

function createFormDefaults(title = ''): WorkFormValues {
  return {
    ...createDefaultWorkFormValues(),
    title,
  };
}

type WorkFormInputChangeHandler = (
  event: ChangeEvent<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >,
) => void;

function getFieldId(idPrefix: string, fieldName: string) {
  if (!idPrefix) {
    return fieldName;
  }

  return `${idPrefix}${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}`;
}

function getCandidateFieldSummary(values: WorkFormValues) {
  const filled = [
    values.title.trim() ? '제목' : null,
    values.author.trim() ? '작가·제작자' : null,
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

interface ProviderGroupLineProps {
  group: ProviderReadinessGroup;
  tone?: 'accent' | 'muted' | 'success' | 'warning';
}

function ProviderGroupLine({ group, tone = 'muted' }: ProviderGroupLineProps) {
  if (group.providers.length === 0) {
    return null;
  }

  return (
    <ActionRow>
      <AppBadge tone={tone}>{group.label}</AppBadge>
      <Text c="var(--mantine-color-dimmed)" size="sm">
        {formatProviderNames(group.providers)}
      </Text>
    </ActionRow>
  );
}

interface ProviderReadinessSummaryProps {
  error: string | null;
  isLoading: boolean;
  readiness: ReturnType<typeof useImportProviderReadiness>['readiness'];
}

function ProviderReadinessSummary({
  error,
  isLoading,
  readiness,
}: ProviderReadinessSummaryProps) {
  return (
    <Paper
      className={cn(css.providerStatusPanel)}
      p="sm"
      radius="md"
      withBorder
    >
      <Stack gap="xs">
        <ActionRow justify="space-between">
          <Text c="var(--mantine-color-text)" fw={700} size="sm">
            검색 출처 상태
          </Text>
          {isLoading && (
            <Text c="var(--mantine-color-dimmed)" size="xs">
              상태 확인 중
            </Text>
          )}
        </ActionRow>

        {error ? (
          <Text c="var(--mantine-color-dimmed)" size="sm">
            지금은 일부 검색 출처 상태를 확인하지 못했습니다. 검색과 직접 추가는
            계속 사용할 수 있습니다.
          </Text>
        ) : (
          <Stack gap={6}>
            <ProviderGroupLine group={readiness.available} tone="success" />
            <ProviderGroupLine
              group={readiness.userActionRequired}
              tone="warning"
            />
            <ProviderGroupLine
              group={readiness.serverSetupRequired}
              tone="muted"
            />
            <ProviderGroupLine group={readiness.directFallback} tone="accent" />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

interface StatusButtonGroupProps {
  onChange: (status: WorkFormValues['status']) => void;
  value: WorkFormValues['status'];
}

function StatusButtonGroup({ onChange, value }: StatusButtonGroupProps) {
  return (
    <Stack gap={6}>
      <Text c="var(--mantine-color-dimmed)" fw={600} size="sm">
        상태
      </Text>
      <Group gap="xs" wrap="wrap">
        {workStatusOptions.map((option) => (
          <AppButton
            aria-pressed={value === option.value}
            key={option.value}
            onClick={() => onChange(option.value)}
            size="compact-sm"
            tone={value === option.value ? 'primary' : 'secondary'}
            type="button"
          >
            {option.label}
          </AppButton>
        ))}
      </Group>
    </Stack>
  );
}

interface CoreWorkFieldsProps {
  error?: string | null;
  idPrefix?: string;
  onChange: WorkFormInputChangeHandler;
  titleInputRef?: RefObject<HTMLInputElement | null>;
  values: WorkFormValues;
}

function CoreWorkFields({
  error,
  idPrefix = '',
  onChange,
  titleInputRef,
  values,
}: CoreWorkFieldsProps) {
  return (
    <Stack gap="md">
      <ActionRow>
        <AppBadge tone="accent">필수</AppBadge>
        <Text c="var(--mantine-color-dimmed)" size="sm">
          제목과 유형만 입력하면 저장할 수 있습니다.
        </Text>
      </ActionRow>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <div className={cn(css.gridSpanFull)}>
          <TextInput
            aria-label="제목"
            id={getFieldId(idPrefix, 'title')}
            label="제목"
            name="title"
            onChange={onChange}
            placeholder="작품 제목"
            ref={titleInputRef}
            error={error}
            withAsterisk
            value={values.title}
          />
        </div>

        <NativeSelect
          id={getFieldId(idPrefix, 'type')}
          label="유형"
          name="type"
          onChange={onChange}
          value={values.type}
        >
          {workTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>

      </SimpleGrid>
    </Stack>
  );
}

interface PersonalRecordFieldsProps {
  idPrefix?: string;
  onInputChange: WorkFormInputChangeHandler;
  onStatusChange: (status: WorkFormValues['status']) => void;
  values: WorkFormValues;
}

function PersonalRecordFields({
  idPrefix = '',
  onInputChange,
  onStatusChange,
  values,
}: PersonalRecordFieldsProps) {
  return (
    <Stack gap="md">
      <ActionRow>
        <AppBadge tone="accent">내 기록</AppBadge>
        <Text c="var(--mantine-color-dimmed)" size="sm">
          상태, 별점, 한줄평만 먼저 남겨도 충분합니다.
        </Text>
      </ActionRow>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <StatusButtonGroup onChange={onStatusChange} value={values.status} />

        <NativeSelect
          aria-label="별점"
          id={getFieldId(idPrefix, 'rating')}
          label="별점"
          name="rating"
          onChange={onInputChange}
          value={values.rating}
        >
          <option value="">미평가</option>
          {ratingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>

        <div className={cn(css.gridSpanFull)}>
          <Textarea
            id={getFieldId(idPrefix, 'shortReview')}
            label="한줄평"
            name="shortReview"
            onChange={onInputChange}
            placeholder="짧게 남길 감상을 적어보세요"
            rows={2}
            value={values.shortReview}
          />
        </div>

        <Text c="var(--mantine-color-dimmed)" className={cn(css.gridSpanFull)} size="sm">
          긴 상세 감상과 감상 이력은 저장 후 상세 화면에서 이어서 정리할 수 있습니다.
        </Text>
      </SimpleGrid>
    </Stack>
  );
}

interface AdvancedWorkFieldsProps {
  idPrefix?: string;
  itemValue: string;
  onInputChange: WorkFormInputChangeHandler;
  onTextListChange: (
    name: 'genresText' | 'personalTagsText',
    values: string[],
  ) => void;
  tagSuggestions?: string[];
  values: WorkFormValues;
}

function AdvancedWorkFields({
  idPrefix = '',
  itemValue,
  onInputChange,
  onTextListChange,
  tagSuggestions = [],
  values,
}: AdvancedWorkFieldsProps) {
  const genreValues = parseCommaSeparatedTextList(values.genresText);
  const personalTagValues = parseCommaSeparatedTextList(values.personalTagsText);
  const previewTitle = values.title.trim() || '제목 없는 작품';

  return (
    <Accordion>
      <Accordion.Item value={itemValue}>
        <Accordion.Control>표지, 장르, 개인 태그, 상세 감상</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md" pt="sm">
            <TextInput
              id={getFieldId(idPrefix, 'author')}
              label="작가·제작자"
              name="author"
              onChange={onInputChange}
              placeholder="작가, 스튜디오, 제작자"
              value={values.author}
            />

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <TextInput
                id={getFieldId(idPrefix, 'seriesText')}
                label="시리즈"
                name="seriesText"
                onChange={onInputChange}
                placeholder="예: Fate, 해리포터"
                value={values.seriesText}
              />
              <TextInput
                id={getFieldId(idPrefix, 'universeText')}
                label="세계관 / 프랜차이즈"
                name="universeText"
                onChange={onInputChange}
                placeholder="예: TYPE-MOON, Wizarding World"
                value={values.universeText}
              />
              <TextInput
                id={getFieldId(idPrefix, 'creatorText')}
                label="작가 / 원작자 / 감독"
                name="creatorText"
                onChange={onInputChange}
                placeholder="여러 명은 쉼표로 구분"
                value={values.creatorText}
              />
              <TextInput
                id={getFieldId(idPrefix, 'studioText')}
                label="스튜디오 / 제작사"
                name="studioText"
                onChange={onInputChange}
                placeholder="예: ufotable, MAPPA"
                value={values.studioText}
              />
              <TextInput
                id={getFieldId(idPrefix, 'publisherText')}
                label="출판사"
                name="publisherText"
                onChange={onInputChange}
                placeholder="예: Shueisha, Bloomsbury"
                value={values.publisherText}
              />
              <TextInput
                id={getFieldId(idPrefix, 'platformText')}
                label="플랫폼"
                name="platformText"
                onChange={onInputChange}
                placeholder="예: 문피아, Netflix"
                value={values.platformText}
              />
            </SimpleGrid>

            <TextInput
              id={getFieldId(idPrefix, 'thumbnailUrl')}
              label="표지 이미지 주소"
              name="thumbnailUrl"
              onChange={onInputChange}
              placeholder="https://example.com/cover.jpg"
              value={values.thumbnailUrl}
            />
            <Paper
              className={cn(css.coverPreviewPanel)}
              p="sm"
              radius="md"
              withBorder
            >
              <Group align="center" gap="md" wrap="nowrap">
                <WorkPoster
                  coverSeed={`advanced:${previewTitle}:${values.type}`}
                  thumbnailUrl={values.thumbnailUrl}
                  title={previewTitle}
                  typeLabel="표지"
                  variant="row"
                />
                <Stack gap={4} miw={0}>
                  <Text fw={700}>표지 미리보기</Text>
                  <Text c="var(--mantine-color-dimmed)" size="sm">
                    이미지가 없거나 불러오지 못하면 제목 기반 fallback으로 표시됩니다.
                  </Text>
                </Stack>
              </Group>
            </Paper>

            <TagsInput
              clearable
              description="쉼표나 Enter로 여러 장르를 나눠 입력할 수 있습니다."
              id={getFieldId(idPrefix, 'genresText')}
              label="장르"
              name="genresText"
              onChange={(items) => onTextListChange('genresText', items)}
              placeholder="SF, 로맨스, 스릴러"
              splitChars={[',']}
              value={genreValues}
            />

            <TagsInput
              clearable
              data={Array.from(new Set(tagSuggestions))}
              description="개인 태그는 장르와 분리된 내 감상 분류입니다."
              id={getFieldId(idPrefix, 'personalTagsText')}
              label="개인 태그"
              name="personalTagsText"
              onChange={(items) =>
                onTextListChange('personalTagsText', items)
              }
              placeholder="시간여행, 다시 볼 것, 여운 강함"
              splitChars={[',']}
              value={personalTagValues}
            />

            <Textarea
              id={getFieldId(idPrefix, 'review')}
              label="상세 감상"
              name="review"
              onChange={onInputChange}
              placeholder="긴 감상은 저장 후 상세 화면에서 이어서 다듬을 수 있습니다"
              rows={4}
              value={values.review}
            />

            <Textarea
              id={getFieldId(idPrefix, 'description')}
              label="설명"
              name="description"
              onChange={onInputChange}
              placeholder="작품 소개나 줄거리, 기록해두고 싶은 배경을 적어보세요"
              rows={4}
              value={values.description}
            />

            <Checkbox
              checked={values.favorite}
              label="즐겨찾기로 표시"
              name="favorite"
              onChange={onInputChange}
            />
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

function QuickCapturePreview({ values }: { values: WorkFormValues }) {
  const previewTitle = values.title.trim() || '제목 없는 작품';
  const typeLabel =
    workTypeOptions.find((option) => option.value === values.type)?.label ??
    '작품';
  const statusLabel =
    workStatusOptions.find((option) => option.value === values.status)?.label ??
    '기록';
  const shortReview = values.shortReview.trim();

  return (
    <Paper className={cn(css.quickCapturePreview)} withBorder>
      <Stack gap="lg">
        <WorkPoster
          coverSeed={`quick:${values.type}:${previewTitle}`}
          thumbnailUrl={values.thumbnailUrl}
          title={previewTitle}
          typeLabel={typeLabel}
          variant="form"
        />
        <Stack gap="sm">
          <Text c="var(--mantine-color-dimmed)" fw={800} size="xs">
            저장될 기록
          </Text>
          <Title order={3}>{previewTitle}</Title>
          <Text c="var(--mantine-color-dimmed)" size="sm">
            {typeLabel} · {statusLabel}
            {values.rating ? ` · ★ ${Number.parseFloat(values.rating).toFixed(1)}` : ''}
          </Text>
          <Text c="var(--mantine-color-dimmed)" lineClamp={4}>
            {shortReview || '짧은 감상을 적지 않아도 먼저 저장할 수 있습니다.'}
          </Text>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function AddWorkFlow({
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
  const providerReadiness = useImportProviderReadiness(mode === 'search');

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
  const importedSourceCoverage = selectedImportCandidate
    ? getCandidateSourceCoverage(selectedImportCandidate)
    : null;
  const importedFieldSummary = getCandidateFieldSummary(values);
  const tagSuggestions = Array.from(
    new Set(
      existingWorks
        .filter((work) => work.deletedAt === null)
        .flatMap((work) => getPersonalTags(work.personalTags)),
    ),
  ).sort((left, right) => left.localeCompare(right));

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

  function handleTextListChange(
    name: 'genresText' | 'personalTagsText',
    items: string[],
  ) {
    setValues((currentValues) => ({
      ...currentValues,
      [name]: formatTextListForWorkForm(items),
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
      setSearchError(
        error instanceof Error ? error.message : '후보 검색에 실패했습니다.',
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
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : '작품을 저장하지 못했습니다.',
      );
    }
  }

  return (
    <Stack gap={variant === 'dialog' ? 'md' : 'lg'}>
      <Stack gap="sm">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <div>
            <Text c="var(--mantine-color-text)" fw={800} size={variant === 'dialog' ? 'lg' : 'xl'}>
              새 작품 기록
            </Text>
            <Text c="var(--mantine-color-dimmed)" size="sm">
              직접 입력으로 바로 저장할 수 있고, 검색은 작품 정보를 채우는 선택 도구입니다.
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
              <Alert color="blue" radius="lg" variant="light">
                <Stack gap="sm">
                  <ActionRow justify="space-between">
                    <AppBadge tone="accent">검색으로 채운 정보</AppBadge>
                    <ActionRow>
                      <AppButton
                        onClick={() => setMode('search')}
                        size="compact-sm"
                        tone="ghost"
                        type="button"
                      >
                        다시 검색
                      </AppButton>
                      <AppButton
                        onClick={resetImportedCandidate}
                        size="compact-sm"
                        tone="ghost"
                        type="button"
                      >
                        직접 입력으로 전환
                      </AppButton>
                    </ActionRow>
                  </ActionRow>
                  <Text c="inherit" fw={700}>
                    {selectedImportCandidate.title}
                  </Text>
                  <Text c="inherit" size="sm">
                    {selectedImportCandidate.reason}
                  </Text>
                  <ActionRow>
                    <AppBadge tone="muted">
                      {selectedImportCandidate.sourceLabel}
                    </AppBadge>
                    <AppBadge tone="muted">
                      {importedSourceCoverage.summaryLabel}
                    </AppBadge>
                  </ActionRow>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <ChipSummary
                      emptyLabel="자동으로 채워진 필드가 없습니다."
                      label="채워진 정보"
                      values={importedFieldSummary.filled}
                    />
                    <ChipSummary
                      emptyLabel="지금 바로 추가 입력할 항목이 없습니다."
                      label="내가 채우면 좋은 정보"
                      values={importedFieldSummary.missing}
                    />
                  </SimpleGrid>
                </Stack>
              </Alert>
            )}

            {variant === 'page' ? (
              <Grid align="start" gutter="xl">
                <Grid.Col span={{ base: 12, lg: 8 }}>
                  <Stack gap="xl">
                    <CoreWorkFields
                      error={titleError}
                      idPrefix="manual"
                      onChange={handleInputChange}
                      titleInputRef={titleInputRef}
                      values={values}
                    />

                    <PersonalRecordFields
                      idPrefix="manual"
                      onInputChange={handleInputChange}
                      onStatusChange={handleStatusChange}
                      values={values}
                    />

                    <AdvancedWorkFields
                      idPrefix="manual"
                      itemValue="manual-advanced-fields"
                      onInputChange={handleInputChange}
                      onTextListChange={handleTextListChange}
                      tagSuggestions={tagSuggestions}
                      values={values}
                    />
                  </Stack>
                </Grid.Col>
                <Grid.Col span={{ base: 12, lg: 4 }}>
                  <QuickCapturePreview values={values} />
                </Grid.Col>
              </Grid>
            ) : (
              <>
                <CoreWorkFields
                  error={titleError}
                  idPrefix="manual"
                  onChange={handleInputChange}
                  titleInputRef={titleInputRef}
                  values={values}
                />

                <PersonalRecordFields
                  idPrefix="manual"
                  onInputChange={handleInputChange}
                  onStatusChange={handleStatusChange}
                  values={values}
                />

                <AdvancedWorkFields
                  idPrefix="manual"
                  itemValue="manual-advanced-fields"
                  onInputChange={handleInputChange}
                  onTextListChange={handleTextListChange}
                  tagSuggestions={tagSuggestions}
                  values={values}
                />
              </>
            )}

            {(validationError || submitError) && (
              <FeedbackMessage tone="error">
                {validationError ?? submitError}
              </FeedbackMessage>
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
            </ActionRow>
          </Stack>
        </form>
      )}
    </Stack>
  );
}
