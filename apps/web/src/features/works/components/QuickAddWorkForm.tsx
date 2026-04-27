import { liveQuery } from 'dexie';
import type {
  CatalogSearchMediumType,
  WorkRecord,
} from '@work-archive/shared-types';
import { useMediaQuery } from '@mantine/hooks';
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
import { SearchPickerModal } from './SearchPickerModal';
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
  submitError: string | null;
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

          <div style={{ gridColumn: '1 / -1' }}>
            <Textarea
              id={getFieldId(idPrefix, 'review')}
              label="상세 감상"
              name="review"
              onChange={onInputChange}
              placeholder="조금 더 긴 감상을 남겨두세요"
              rows={6}
              value={values.review}
            />
          </div>
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}

interface AdvancedWorkFieldsProps {
  idPrefix?: string;
  itemValue: string;
  onInputChange: WorkFormInputChangeHandler;
  values: WorkFormValues;
}

function AdvancedWorkFields({
  idPrefix = '',
  itemValue,
  onInputChange,
  values,
}: AdvancedWorkFieldsProps) {
  return (
    <Accordion>
      <Accordion.Item value={itemValue}>
        <Accordion.Control>표지, 장르, 설명, 즐겨찾기</Accordion.Control>
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
  onSubmit,
  submitError,
}: QuickAddWorkFormProps) {
  const { archiveScopeKey } = useAuthSession();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [values, setValues] = useState<WorkFormValues>(() =>
    createFormDefaults(),
  );
  const [existingWorks, setExistingWorks] = useState<WorkRecord[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchModalOpened, setSearchModalOpened] = useState(false);
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
  const providerReadiness = useImportProviderReadiness(searchModalOpened);

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
    setSearchModalOpened(false);
    setValidationError(null);
    focusMainTitle();
  }

  function useSearchTermForManualInput() {
    const normalizedSearchTerm = searchTerm.trim();

    if (!normalizedSearchTerm) {
      return;
    }

    resetImportedCandidate();
    setSearchModalOpened(false);
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
    <Stack gap="xl">
      <SectionCard gap="md" padding="lg" tone="hero">
        <SectionIntro
          description="직접 추가와 검색 채우기를 모두 사용할 수 있지만, 저장은 항상 아래 폼에서 직접 확인하고 진행합니다."
          eyebrow="추가 방식"
          title="새 작품 기록 만들기"
          titleOrder={2}
        />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Paper
            p="md"
            radius="lg"
            styles={{
              root: {
                backgroundColor: 'var(--app-surface-1)',
                borderColor: 'var(--app-border-strong)',
              },
            }}
            withBorder
          >
            <Stack gap="sm">
              <ActionRow justify="space-between">
                <AppBadge tone="accent">기본 경로</AppBadge>
                <AppBadge tone="success">form-first</AppBadge>
              </ActionRow>
              <div>
                <Title order={3}>직접 추가</Title>
                <Text c="var(--app-text-muted)" size="sm">
                  제목과 유형부터 바로 기록하고, 나머지는 필요할 때만 채웁니다.
                </Text>
              </div>
              <AppButton
                fullWidth
                onClick={() => {
                  focusMainTitle();
                }}
                tone="primary"
                type="button"
              >
                직접 입력 계속
              </AppButton>
            </Stack>
          </Paper>

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
            <Stack gap="sm">
              <ActionRow justify="space-between">
                <AppBadge tone="muted">입력 보조</AppBadge>
                {selectedImportCandidate && (
                  <AppBadge tone="success">불러온 후보 있음</AppBadge>
                )}
              </ActionRow>
              <div>
                <Title order={3}>검색으로 정보 채우기</Title>
                <Text c="var(--app-text-muted)" size="sm">
                  검색 결과를 비교해 제목과 작품 정보를 채우고, 저장은 아래
                  폼에서 마무리합니다.
                </Text>
              </div>
              <AppButton
                fullWidth
                onClick={() => {
                  setSearchModalOpened(true);
                  setSearchError(null);
                }}
                tone="secondary"
                type="button"
              >
                {selectedImportCandidate ? '다시 검색' : '검색으로 정보 채우기'}
              </AppButton>
            </Stack>
          </Paper>
        </SimpleGrid>
      </SectionCard>

      <form onSubmit={handleSubmit}>
        <SectionCard gap="xl" padding="xl" tone="default">
          {selectedImportCandidate && importedSourceCoverage && (
            <Alert color="blue" radius="lg" variant="light">
              <Stack gap="sm">
                <ActionRow justify="space-between">
                  <AppBadge tone="accent">검색으로 채운 정보</AppBadge>
                  <ActionRow>
                    <AppButton
                      onClick={() => setSearchModalOpened(true)}
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
            <AppLinkButton to="/works" tone="quiet">
              취소
            </AppLinkButton>
          </ActionRow>
        </SectionCard>
      </form>

      <SearchPickerModal
        candidates={searchCandidates}
        duplicateCounts={duplicateCounts}
        duplicateMatches={selectedDuplicateMatches}
        fullScreen={Boolean(isMobile)}
        isSearching={isSearching}
        onApplyCandidate={applyCandidateToForm}
        onClose={() => setSearchModalOpened(false)}
        onProviderGroupChange={handleProviderGroupChange}
        onSearchSubmit={handleSearchSubmit}
        onSearchTermChange={setSearchTerm}
        onSearchTypeChange={(value) =>
          setSearchType(value as CatalogSearchMediumType)
        }
        onSelectCandidate={setSelectedSearchCandidate}
        onUseManualTitle={useSearchTermForManualInput}
        opened={searchModalOpened}
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
    </Stack>
  );
}
