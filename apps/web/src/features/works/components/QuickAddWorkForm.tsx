import { liveQuery } from 'dexie';
import type {
  CatalogSearchMediumType,
  WorkRecord,
} from '@work-archive/shared-types';
import {
  Accordion,
  Alert,
  Checkbox,
  Group,
  NativeSelect,
  Paper,
  SimpleGrid,
  Stack,
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
  FeedbackMessage,
  PageSection,
  SectionCard,
  SectionIntro,
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
import { SearchPickerPanel } from './SearchPickerModal';
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
  parseWorkFormValues,
  type UpsertWorkInput,
  type WorkFormValues,
} from '../utils/work-form';
import { workStatusOptions, workTypeOptions } from '../utils/work-options';

interface QuickAddWorkFormProps {
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
      <Text c="var(--app-text-muted)" size="sm">
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
      p="sm"
      radius="md"
      styles={{
        root: {
          backgroundColor: 'var(--app-surface-1)',
          borderColor: 'var(--app-border-color)',
        },
      }}
      withBorder
    >
      <Stack gap="xs">
        <ActionRow justify="space-between">
          <Text c="var(--app-text-strong)" fw={700} size="sm">
            검색 provider 상태
          </Text>
          {isLoading && (
            <Text c="var(--app-text-muted)" size="xs">
              상태 확인 중
            </Text>
          )}
        </ActionRow>

        {error ? (
          <Text c="var(--app-text-muted)" size="sm">
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
      <Text c="var(--app-text-muted)" fw={600} size="sm">
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
  idPrefix?: string;
  onChange: WorkFormInputChangeHandler;
  titleInputRef?: RefObject<HTMLInputElement | null>;
  values: WorkFormValues;
}

function CoreWorkFields({
  idPrefix = '',
  onChange,
  titleInputRef,
  values,
}: CoreWorkFieldsProps) {
  return (
    <Paper
      p="md"
      radius="lg"
      styles={{
        root: {
          backgroundColor: 'var(--app-surface-1)',
          borderColor: 'var(--app-border-color)',
        },
      }}
      withBorder
    >
      <Stack gap="md">
        <ActionRow>
          <AppBadge tone="accent">필수</AppBadge>
          <Text c="var(--app-text-muted)" size="sm">
            제목과 유형만 입력하면 저장할 수 있습니다.
          </Text>
        </ActionRow>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <div style={{ gridColumn: '1 / -1' }}>
            <TextInput
              id={getFieldId(idPrefix, 'title')}
              label="제목"
              name="title"
              onChange={onChange}
              placeholder="작품 제목"
              ref={titleInputRef}
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

          <TextInput
            id={getFieldId(idPrefix, 'author')}
            label="작가·제작자"
            name="author"
            onChange={onChange}
            placeholder="작가, 스튜디오, 제작자를 입력해주세요"
            value={values.author}
          />
        </SimpleGrid>
      </Stack>
    </Paper>
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
    <Paper
      p="md"
      radius="lg"
      styles={{
        root: {
          backgroundColor: 'var(--app-surface-0)',
          borderColor: 'var(--app-border-color)',
        },
      }}
      withBorder
    >
      <Stack gap="md">
        <ActionRow>
          <AppBadge tone="accent">내 기록</AppBadge>
          <Text c="var(--app-text-muted)" size="sm">
            상태와 감상은 상세 화면에서 가장 먼저 읽히는 개인 기록입니다.
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

          <div style={{ gridColumn: '1 / -1' }}>
            <Textarea
              id={getFieldId(idPrefix, 'shortReview')}
              label="한줄평"
              name="shortReview"
              onChange={onInputChange}
              placeholder="짧게 남길 감상을 적어보세요"
              rows={3}
              value={values.shortReview}
            />
          </div>

          <Text c="var(--app-text-muted)" size="sm" style={{ gridColumn: '1 / -1' }}>
            긴 상세 감상과 감상 이력은 저장 후 상세 화면에서 이어서 정리할 수 있습니다.
          </Text>
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}

interface AdvancedWorkFieldsProps {
  idPrefix?: string;
  itemValue: string;
  onInputChange: WorkFormInputChangeHandler;
  tagSuggestions?: string[];
  values: WorkFormValues;
}

function AdvancedWorkFields({
  idPrefix = '',
  itemValue,
  onInputChange,
  tagSuggestions = [],
  values,
}: AdvancedWorkFieldsProps) {
  return (
    <Accordion>
      <Accordion.Item value={itemValue}>
        <Accordion.Control>표지, 장르, 개인 태그, 상세 감상</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md" pt="sm">
            <TextInput
              id={getFieldId(idPrefix, 'thumbnailUrl')}
              label="표지 이미지 주소"
              name="thumbnailUrl"
              onChange={onInputChange}
              placeholder="https://example.com/cover.jpg"
              value={values.thumbnailUrl}
            />

            <TextInput
              id={getFieldId(idPrefix, 'genresText')}
              label="장르"
              name="genresText"
              onChange={onInputChange}
              placeholder="SF, 로맨스, 스릴러"
              value={values.genresText}
            />

            <TextInput
              aria-describedby={getFieldId(idPrefix, 'personalTagsTextHint')}
              id={getFieldId(idPrefix, 'personalTagsText')}
              label="개인 태그"
              list={getFieldId(idPrefix, 'personalTagsSuggestions')}
              name="personalTagsText"
              onChange={onInputChange}
              placeholder="시간여행, 다시 볼 것, 여운 강함"
              value={values.personalTagsText}
            />
            <datalist id={getFieldId(idPrefix, 'personalTagsSuggestions')}>
              {tagSuggestions.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
            <Text
              c="var(--app-text-muted)"
              fz="sm"
              id={getFieldId(idPrefix, 'personalTagsTextHint')}
              mt={-8}
            >
              장르와 분리된 내 분류입니다. 쉼표로 구분해 입력해주세요.
            </Text>

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

export function QuickAddWorkForm({
  isSubmitting,
  onCancel,
  onSubmit,
  submitError,
  variant = 'page',
}: QuickAddWorkFormProps) {
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
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
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
  const tagSuggestions = Array.from(
    new Set(
      existingWorks
        .filter((work) => work.deletedAt === null)
        .flatMap((work) => work.personalTags),
    ),
  ).sort((left, right) => left.localeCompare(right));

  function handleInputChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    const { name, type } = event.target;

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
    focusMainTitle();
  }

  function handleProviderGroupChange(value: ProviderGroup) {
    setProviderGroup(value);
    setSearchCandidates([]);
    setSelectedSearchCandidate(null);
    setSearchNotice(null);
    setSearchError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setValidationError(null);
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
    <Stack gap={variant === 'dialog' ? 'lg' : 'xl'}>
      <SectionCard gap="md" padding={variant === 'dialog' ? 'lg' : 'xl'} tone="hero">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <SectionIntro
            description="직접 입력하거나 검색 후보로 기본 정보를 채운 뒤, 저장 전 한 화면에서 최종 확인합니다."
            eyebrow="새 기록"
            title="새 작품 기록"
            titleOrder={variant === 'dialog' ? 2 : 1}
          />
          <ActionRow justify="flex-end">
            <AppButton
              aria-pressed={mode === 'manual'}
              onClick={() => {
                setMode('manual');
                focusMainTitle();
              }}
              size="compact-sm"
              tone={mode === 'manual' ? 'primary' : 'secondary'}
              type="button"
            >
              직접 입력
            </AppButton>
            <AppButton
              aria-pressed={mode === 'search'}
              onClick={() => {
                setMode('search');
                setSearchError(null);
              }}
              size="compact-sm"
              tone={mode === 'search' ? 'primary' : 'secondary'}
              type="button"
            >
              검색으로 정보 채우기
            </AppButton>
          </ActionRow>
        </Group>
      </SectionCard>

      {mode === 'search' ? (
        <SectionCard gap="lg" padding={variant === 'dialog' ? 'lg' : 'xl'} tone="default">
          <SearchPickerPanel
            candidates={searchCandidates}
            duplicateCounts={duplicateCounts}
            duplicateMatches={selectedDuplicateMatches}
            fullHeight={variant === 'dialog'}
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
        </SectionCard>
      ) : (
        <form onSubmit={handleSubmit}>
          <SectionCard gap="xl" padding={variant === 'dialog' ? 'lg' : 'xl'} tone="default">
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
              </Stack>
            </Alert>
          )}

          <PageSection
            description="제목과 유형만 있으면 저장할 수 있습니다. 검색으로 채웠더라도 아래 폼이 최종 저장 기준입니다."
            divider={false}
            eyebrow="기본 정보"
              title="작품 기록 입력"
            >
            <CoreWorkFields
              idPrefix="manual"
              onChange={handleInputChange}
              titleInputRef={titleInputRef}
              values={values}
            />
          </PageSection>

          <PageSection
            description="상태와 감상은 내 아카이브에서 가장 먼저 읽히는 개인 기록입니다."
            eyebrow="내 기록"
              title="상태와 감상"
            >
            <PersonalRecordFields
              idPrefix="manual"
              onInputChange={handleInputChange}
              onStatusChange={handleStatusChange}
              values={values}
            />
          </PageSection>

          <PageSection
            description="표지, 장르, 설명 같은 부가 정보는 필요할 때만 펼쳐서 다룹니다."
            eyebrow="추가 필드"
              title="고급 정보"
            >
            <AdvancedWorkFields
              idPrefix="manual"
              itemValue="manual-advanced-fields"
              onInputChange={handleInputChange}
              tagSuggestions={tagSuggestions}
              values={values}
            />
          </PageSection>

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
          </SectionCard>
        </form>
      )}
    </Stack>
  );
}
