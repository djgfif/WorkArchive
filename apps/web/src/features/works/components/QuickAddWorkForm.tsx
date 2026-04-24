import { liveQuery } from 'dexie';
import type {
  CatalogSearchMediumType,
  WorkImportDraft,
  WorkRecord,
} from '@work-archive/shared-types';
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  Accordion,
  Alert,
  Anchor,
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

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  MetricPill,
  PageSection,
  SectionCard,
  SectionIntro,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import {
  importsService,
  type ImportCandidate,
} from '../../imports/services/imports.service';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { worksRepository } from '../services/works.repository';
import {
  createDefaultWorkFormValues,
  parseWorkFormValues,
  type UpsertWorkInput,
  type WorkFormValues,
} from '../utils/work-form';
import {
  getWorkStatusLabel,
  getWorkTypeLabel,
  workStatusOptions,
  workTypeOptions,
} from '../utils/work-options';

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

const quickAddMediumOptions: Array<{
  label: string;
  value: CatalogSearchMediumType;
}> = [
  {
    label: '전체',
    value: 'all',
  },
  {
    label: '라이트노벨',
    value: 'light_novel',
  },
  {
    label: '소설',
    value: 'novel',
  },
  {
    label: '만화',
    value: 'manga',
  },
  {
    label: '애니',
    value: 'anime',
  },
  {
    label: '영화',
    value: 'movie',
  },
  {
    label: '드라마',
    value: 'drama',
  },
  {
    label: '웹소설',
    value: 'web_novel',
  },
  {
    label: '웹툰',
    value: 'webtoon',
  },
];

function createQuickAddDefaults(): WorkFormValues {
  return {
    ...createDefaultWorkFormValues(),
    type: 'other',
  };
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/[^0-9a-z가-힣]+/g, '');
}

function createExternalRefKey(ref: {
  externalId: string;
  provider: string;
  rawType?: string;
}) {
  return [ref.provider, ref.rawType ?? '', ref.externalId].join(':');
}

function isPreviewOrManualCandidate(candidate: ImportCandidate) {
  return candidate.sourceId === 'preview-manual' || candidate.sourceId === 'manual';
}

function buildImportExternalRef(ref: {
  externalId: string;
  provider: string;
  rawType?: string;
  url?: string;
}) {
  return {
    externalId: ref.externalId,
    provider: ref.provider,
    ...(ref.rawType ? { rawType: ref.rawType } : {}),
    ...(ref.url ? { url: ref.url } : {}),
  };
}

function findLikelyMatches(
  candidate: ImportCandidate,
  existingWorks: WorkRecord[],
) {
  const matchedCatalogTitleId = candidate.catalogMatch?.id ?? null;
  const candidateExternalRefKeys = new Set(
    candidate.externalRefs.map((ref) => createExternalRefKey(ref)),
  );
  const candidateTitleKeys = Array.from(
    new Set(
      [candidate.title, candidate.title.replace(/\s*\([^)]*\)\s*$/, '')]
        .map(normalizeTitle)
        .filter(Boolean),
    ),
  );

  return existingWorks.filter((work) => {
    if (matchedCatalogTitleId && work.catalogTitleId === matchedCatalogTitleId) {
      return true;
    }

    if (
      candidateExternalRefKeys.size > 0 &&
      work.importDraft?.externalRefs?.some((ref) =>
        candidateExternalRefKeys.has(createExternalRefKey(ref)),
      )
    ) {
      return true;
    }

    return candidateTitleKeys.some((key) => normalizeTitle(work.title) === key);
  });
}

function createValuesFromCandidate(candidate: ImportCandidate): WorkFormValues {
  return {
    ...createQuickAddDefaults(),
    author: candidate.author,
    description: candidate.description,
    genresText: candidate.genresText,
    thumbnailUrl: candidate.thumbnailUrl,
    title: candidate.title,
    type: candidate.mediumType,
  };
}

function buildImportIdentity(
  candidate: ImportCandidate,
  input: UpsertWorkInput,
): Pick<UpsertWorkInput, 'catalogTitleId' | 'importDraft'> {
  if (candidate.catalogMatch?.id) {
    return {
      catalogTitleId: candidate.catalogMatch.id,
      importDraft: null,
    };
  }

  if (isPreviewOrManualCandidate(candidate)) {
    return {
      catalogTitleId: null,
      importDraft: null,
    };
  }

  const importDraft: WorkImportDraft = {
    mediumType: input.type,
  };

  if (candidate.franchiseName !== null) {
    importDraft.franchiseName = candidate.franchiseName;
  }

  if (candidate.subType !== null) {
    importDraft.subType = candidate.subType;
  }

  if (candidate.releaseYear !== null) {
    importDraft.releaseYear = candidate.releaseYear;
  }

  if (candidate.contributors.length > 0) {
    importDraft.contributors = candidate.contributors.map((contributor) => ({
      name: contributor.name,
    }));
  }

  if (candidate.externalRefs.length > 0) {
    importDraft.externalRefs = candidate.externalRefs.map((ref) =>
      buildImportExternalRef(ref),
    );
  }

  if (candidate.releaseCandidates.length > 0) {
    importDraft.releaseCandidates = candidate.releaseCandidates.map((release) => ({
      ...(release.displayLabel ? { displayLabel: release.displayLabel } : {}),
      ...(release.externalRefs && release.externalRefs.length > 0
        ? {
            externalRefs: release.externalRefs.map((ref) =>
              buildImportExternalRef(ref),
            ),
          }
        : {}),
      isbn: release.isbn ?? null,
      releaseDate: release.releaseDate ?? null,
      ...(release.releaseType ? { releaseType: release.releaseType } : {}),
      sequence: release.sequence ?? null,
      ...(release.thumbnailUrl ? { thumbnailUrl: release.thumbnailUrl } : {}),
      ...(release.title ? { title: release.title } : {}),
    }));
  }

  return {
    catalogTitleId: null,
    importDraft,
  };
}

interface WorkflowProgressProps {
  activeStep: number;
}

function WorkflowProgress({
  activeStep,
}: WorkflowProgressProps) {
  const steps = ['검색', '선택', '확인', '기록', '저장'];

  return (
    <ActionRow>
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = activeStep === stepNumber;
        const isComplete = activeStep > stepNumber;

        return (
          <Text
            c={isActive || isComplete ? 'var(--app-text-strong)' : 'var(--app-text-muted)'}
            fw={isActive || isComplete ? 700 : 500}
            key={step}
            size="sm"
          >
            {stepNumber}. {step}
          </Text>
        );
      })}
    </ActionRow>
  );
}

interface CandidateRowProps {
  active: boolean;
  candidate: ImportCandidate;
  duplicateCount: number;
  isLast: boolean;
  onSelect: () => void;
}

function CandidateRow({
  active,
  candidate,
  duplicateCount,
  isLast,
  onSelect,
}: CandidateRowProps) {
  return (
    <button
      aria-label={`${candidate.title} ${getWorkTypeLabel(candidate.type)} 후보 선택`}
      onClick={onSelect}
      style={{
        backgroundColor: active ? 'var(--app-surface-1)' : 'transparent',
        border: 'none',
        borderBottom: isLast ? 'none' : '1px solid var(--app-border-color)',
        color: 'inherit',
        cursor: 'pointer',
        padding: '1rem',
        textAlign: 'left',
        width: '100%',
      }}
      type="button"
    >
      <Group align="flex-start" gap="md" wrap="nowrap">
        <ArtworkPoster
          thumbnailUrl={candidate.thumbnailUrl}
          title={candidate.title}
          typeLabel={getWorkTypeLabel(candidate.type)}
          variant="row"
        />

        <Stack flex={1} gap="xs" miw={0}>
          <ActionRow>
            <AppBadge tone="accent">{candidate.confidenceLabel}</AppBadge>
            <AppBadge>{candidate.sourceLabel}</AppBadge>
            <AppBadge>{getWorkTypeLabel(candidate.mediumType)}</AppBadge>
            {candidate.subType && <AppBadge>{candidate.subType}</AppBadge>}
            {candidate.franchiseName && (
              <AppBadge tone="success">{candidate.franchiseName}</AppBadge>
            )}
            {candidate.releaseYear && <AppBadge>{candidate.releaseYear}</AppBadge>}
            {candidate.existingRecord && (
              <AppBadge tone="warning">이미 내 기록에 있음</AppBadge>
            )}
            {candidate.catalogMatch && !candidate.existingRecord && (
              <AppBadge tone="success">카탈로그 매칭</AppBadge>
            )}
            {duplicateCount > 0 && <AppBadge tone="warning">비슷한 기록 {duplicateCount}</AppBadge>}
          </ActionRow>

          <div>
            <Title order={4}>{candidate.title}</Title>
            <Text c="var(--app-text-muted)">
              {candidate.contributors.length > 0
                ? candidate.contributors
                    .map((contributor) => `${contributor.name} · ${contributor.role}`)
                    .join(', ')
                : candidate.author}
            </Text>
          </div>

          <Text c="var(--app-text-secondary)">{candidate.description}</Text>
          {candidate.reason && (
            <Text c="var(--app-text-muted)" size="xs">
              {candidate.reason}
            </Text>
          )}
          {candidate.note && (
            <Text c="var(--app-text-muted)" size="xs">
              {candidate.note}
            </Text>
          )}
        </Stack>
      </Group>
    </button>
  );
}

export function QuickAddWorkForm({
  isSubmitting,
  onSubmit,
  submitError,
}: QuickAddWorkFormProps) {
  const { archiveScopeKey, mode } = useAuthSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMedium, setSearchMedium] =
    useState<CatalogSearchMediumType>('all');
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState('');
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [existingWorks, setExistingWorks] = useState<WorkRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<ImportCandidate | null>(
    null,
  );
  const [confirmedDuplicateCandidateId, setConfirmedDuplicateCandidateId] = useState<
    string | null
  >(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [values, setValues] = useState<WorkFormValues>(createQuickAddDefaults);

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

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
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

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedSearchTerm = searchTerm.trim();

    if (!normalizedSearchTerm) {
      setValidationError('먼저 작품 제목이나 작가를 검색해주세요.');
      return;
    }

    setValidationError(null);
    setSubmittedSearchTerm(normalizedSearchTerm);
    setSelectedCandidate(null);
    setConfirmedDuplicateCandidateId(null);
    setCandidates([]);
    setSearchNotice(null);
    setValues(createQuickAddDefaults());

    try {
      setIsSearching(true);

      const result = await importsService.searchCandidates(normalizedSearchTerm, {
        limit: 10,
        mediumType: searchMedium,
        useExternal: mode === 'authenticated',
      });

      setCandidates(result.candidates);
      setSearchNotice(result.notice);
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : '후보 검색에 실패했습니다.',
      );
      setCandidates([]);
      setSearchNotice(null);
    } finally {
      setIsSearching(false);
    }
  }

  function handleSelectCandidate(candidate: ImportCandidate) {
    setSelectedCandidate(candidate);
    setConfirmedDuplicateCandidateId((currentValue) =>
      currentValue === candidate.id ? currentValue : null,
    );
    setValidationError(null);
    setValues(createValuesFromCandidate(candidate));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCandidate) {
      setValidationError('검색 결과에서 먼저 작품을 선택해주세요.');
      return;
    }

    if (shouldConfirmDuplicate) {
      setValidationError('비슷한 기존 기록을 확인한 뒤 계속 진행해주세요.');
      return;
    }

    try {
      setValidationError(null);
      const input = parseWorkFormValues(values);

      await onSubmit({
        ...input,
        ...buildImportIdentity(selectedCandidate, input),
      });
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : '작품을 저장하지 못했습니다.',
      );
    }
  }

  const duplicateMatches =
    selectedCandidate === null
      ? []
      : findLikelyMatches(selectedCandidate, existingWorks);
  const shouldConfirmDuplicate =
    selectedCandidate !== null &&
    duplicateMatches.length > 0 &&
    confirmedDuplicateCandidateId !== selectedCandidate.id;
  const activeStep = selectedCandidate ? 4 : candidates.length > 0 ? 2 : 1;

  return (
    <SimpleGrid cols={{ base: 1, xl: 12 }} spacing="xl">
      <div style={{ gridColumn: 'span 4 / span 4' }}>
        <Stack gap="lg">
          <SectionCard gap="lg" tone="hero">
            <SectionIntro
              description="작품 제목이나 작가를 먼저 검색하고, 가장 가까운 후보를 고른 뒤 내 기록만 남깁니다."
              eyebrow="검색"
              title="검색에서 시작"
              titleOrder={2}
            />

            <WorkflowProgress activeStep={activeStep} />

            <form onSubmit={handleSearchSubmit}>
              <Group align="flex-end" gap="sm" wrap="wrap">
                <NativeSelect
                  id="quickAddMedium"
                  label="매체"
                  onChange={(event) =>
                    setSearchMedium(event.currentTarget.value as CatalogSearchMediumType)
                  }
                  value={searchMedium}
                >
                  {quickAddMediumOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>

                <TextInput
                  id="quickAddSearch"
                  label="작품 검색"
                  onChange={(event) => setSearchTerm(event.currentTarget.value)}
                  placeholder="제목, IP, 작가, 스튜디오를 입력하세요"
                  value={searchTerm}
                />
                <AppButton
                  disabled={isSearching}
                  loading={isSearching}
                  tone="primary"
                  type="submit"
                >
                  {isSearching ? '검색 중...' : '검색'}
                </AppButton>
              </Group>
            </form>
          </SectionCard>

          <SectionCard gap="md" padding="lg" tone={candidates.length > 0 ? 'default' : 'subtle'}>
            <SectionIntro
              description={
                submittedSearchTerm
                  ? `"${submittedSearchTerm}" 기준 후보를 정리했습니다.`
                  : '검색하면 후보가 여기 표시됩니다.'
              }
              eyebrow="후보"
              title={submittedSearchTerm ? '검색 결과' : '후보 선택 대기'}
              titleOrder={3}
            />

            {searchNotice && (
              <FeedbackMessage tone="info">
                {searchNotice}
              </FeedbackMessage>
            )}

            {isSearching ? (
              <Text c="var(--app-text-muted)">
                선택한 매체에 맞는 provider와 수동 후보를 확인하고 있습니다.
              </Text>
            ) : submittedSearchTerm && candidates.length === 0 ? (
              <Text c="var(--app-text-muted)">
                현재 검색어로는 후보를 찾지 못했습니다. 제목이나 작가를 조금 바꿔 다시 찾아보세요.
              </Text>
            ) : candidates.length > 0 ? (
              <Paper
                p={0}
                radius="lg"
                styles={{
                  root: {
                    backgroundColor: 'var(--app-surface-0)',
                    borderColor: 'var(--app-border-color)',
                    overflow: 'hidden',
                  },
                }}
                withBorder
              >
                <Stack gap={0}>
                  {candidates.map((candidate, index) => (
                    <CandidateRow
                      active={selectedCandidate?.id === candidate.id}
                      candidate={candidate}
                      duplicateCount={findLikelyMatches(candidate, existingWorks).length}
                      isLast={index === candidates.length - 1}
                      key={candidate.id}
                      onSelect={() => handleSelectCandidate(candidate)}
                    />
                  ))}
                </Stack>
              </Paper>
            ) : (
              <Text c="var(--app-text-muted)">
                제목, 원작자, 스튜디오 등 기억나는 단서로 먼저 검색을 시작하세요.
              </Text>
            )}
          </SectionCard>
        </Stack>
      </div>

      <div style={{ gridColumn: 'span 8 / span 8' }}>
        {!selectedCandidate ? (
          <StateMessage
            description="왼쪽에서 검색 후 후보를 하나 선택하면 메타데이터 확인과 개인 기록 입력이 같은 흐름 안에서 이어집니다."
            eyebrow="선택 대기"
            title="먼저 검색 결과에서 작품을 선택하세요."
            tone="info"
          />
        ) : (
          <form onSubmit={handleSubmit}>
            <SectionCard gap="xl" padding="xl" tone="default">
              <WorkflowProgress activeStep={shouldConfirmDuplicate ? 3 : 4} />

              {shouldConfirmDuplicate && (
                <Alert color="yellow" radius="md" variant="light">
                  <Stack gap="sm">
                    <Title order={3}>비슷한 기록이 이미 있습니다</Title>
                    <Text c="inherit">
                      이미 저장된 기록과 같은 작품인지 먼저 확인하세요. 다른 작품이 맞다면 그대로 계속 진행할 수 있습니다.
                    </Text>
                    {duplicateMatches.map((work) => (
                      <Paper
                        key={work.id}
                        p="sm"
                        styles={{
                          root: {
                            backgroundColor: 'var(--app-surface-0)',
                            borderColor: 'var(--app-border-color)',
                          },
                        }}
                        withBorder
                      >
                        <Group align="flex-start" justify="space-between" wrap="wrap">
                          <Stack gap={2}>
                            <Text fw={700}>{work.title}</Text>
                            <Text c="var(--app-text-muted)" size="sm">
                      {work.author || '작가·제작자 미입력'} · {getWorkTypeLabel(work.type)} ·{' '}
                              {getWorkStatusLabel(work.status)}
                            </Text>
                          </Stack>
                          {work.deletedAt === null ? (
                            <AppLinkButton to={`/works/${work.id}`} tone="quiet">
                              기존 작품 보기
                            </AppLinkButton>
                          ) : (
                            <AppLinkButton
                              to={`/works?scope=trash&q=${encodeURIComponent(work.title)}`}
                              tone="quiet"
                            >
                              휴지통에서 보기
                            </AppLinkButton>
                          )}
                        </Group>
                      </Paper>
                    ))}
                    <ActionRow>
                      <AppButton
                        onClick={() => setConfirmedDuplicateCandidateId(selectedCandidate.id)}
                        tone="primary"
                        type="button"
                      >
                        그래도 계속 추가
                      </AppButton>
                      <AppButton
                        onClick={() => {
                          setSelectedCandidate(null);
                          setConfirmedDuplicateCandidateId(null);
                          setValues(createQuickAddDefaults());
                        }}
                        tone="ghost"
                        type="button"
                      >
                        다른 후보 보기
                      </AppButton>
                    </ActionRow>
                  </Stack>
                </Alert>
              )}

              <PageSection
                description="검색 결과에서 가져온 초안을 다시 입력하지 않고, 제목과 유형, 작가 정도만 빠르게 확인합니다."
                divider={false}
                eyebrow="확인"
                title="선택한 작품 확인"
              >
                <Group align="flex-start" gap="md" wrap="nowrap">
                  <ArtworkPoster
                    thumbnailUrl={values.thumbnailUrl}
                    title={values.title || selectedCandidate.title}
                    typeLabel={getWorkTypeLabel(values.type)}
                    variant="row"
                  />

                  <Stack flex={1} gap="sm" miw={0}>
                    <ActionRow>
                      <AppBadge tone="accent">{selectedCandidate.confidenceLabel}</AppBadge>
                      <AppBadge>{selectedCandidate.sourceLabel}</AppBadge>
                      <AppBadge>{getWorkTypeLabel(selectedCandidate.mediumType)}</AppBadge>
                      {selectedCandidate.franchiseName && (
                        <AppBadge tone="success">{selectedCandidate.franchiseName}</AppBadge>
                      )}
                      {selectedCandidate.releaseYear && (
                        <AppBadge>{selectedCandidate.releaseYear}</AppBadge>
                      )}
                    </ActionRow>

                    <Text c="var(--app-text-secondary)">
                      {values.description || '설명은 아직 없습니다.'}
                    </Text>

                    <Text c="var(--app-text-muted)" size="sm">
                      {selectedCandidate.note}
                      {selectedCandidate.sourceUrl && (
                        <>
                          {' · '}
                          <Anchor
                            href={selectedCandidate.sourceUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            provider에서 보기
                          </Anchor>
                        </>
                      )}
                    </Text>

                    <ActionRow>
                      <MetricPill label="형식" value={selectedCandidate.formatLabel} />
                      <MetricPill label="식별 정보" value={selectedCandidate.countLabel} />
                      <MetricPill label="추천 이유" value={selectedCandidate.reason} />
                    </ActionRow>
                  </Stack>
                </Group>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <div style={{ gridColumn: '1 / -1' }}>
                    <TextInput
                      id="title"
                      label="제목"
                      name="title"
                      onChange={handleInputChange}
                      placeholder="작품 제목"
                      value={values.title}
                    />
                  </div>

                  <NativeSelect
                    id="type"
                    label="유형"
                    name="type"
                    onChange={handleInputChange}
                    value={values.type}
                  >
                    {workTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>

                  <TextInput
                    id="author"
                    label="작가·제작자"
                    name="author"
                    onChange={handleInputChange}
                    placeholder="작가, 스튜디오, 제작자를 입력해주세요"
                    value={values.author}
                  />
                </SimpleGrid>
              </PageSection>

              <PageSection
                description="저장 전에 직접 남겨야 하는 핵심 기록을 먼저 입력합니다."
                eyebrow="내 기록"
                title="개인 기록 입력"
              >
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <NativeSelect
                    aria-label="상태"
                    id="status"
                    label="상태"
                    name="status"
                    onChange={handleInputChange}
                    value={values.status}
                  >
                    {workStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>

                  <NativeSelect
                    aria-label="별점"
                    id="rating"
                    label="별점"
                    name="rating"
                    onChange={handleInputChange}
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
                      id="shortReview"
                      label="한줄평"
                      name="shortReview"
                      onChange={handleInputChange}
                      placeholder="목록과 최근 기록에 먼저 보일 짧은 감상을 적어보세요"
                      rows={3}
                      value={values.shortReview}
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <Textarea
                      id="review"
                      label="상세 감상"
                      name="review"
                      onChange={handleInputChange}
                      placeholder="필요하면 조금 더 긴 감상을 남겨두세요"
                      rows={6}
                      value={values.review}
                    />
                  </div>
                </SimpleGrid>
              </PageSection>

              <PageSection
                description="표지, 장르, 설명 같은 부가 정보는 필요할 때만 펼쳐서 다룹니다."
                eyebrow="추가 필드"
                title="고급 정보"
              >
                <Accordion>
                  <Accordion.Item value="advanced-fields">
                    <Accordion.Control>표지, 장르, 설명, 즐겨찾기</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md" pt="sm">
                        <TextInput
                          id="thumbnailUrl"
                          label="표지 이미지 주소"
                          name="thumbnailUrl"
                          onChange={handleInputChange}
                          placeholder="https://example.com/cover.jpg"
                          value={values.thumbnailUrl}
                        />

                        <TextInput
                          id="genresText"
                          label="장르"
                          name="genresText"
                          onChange={handleInputChange}
                          placeholder="SF, 로맨스, 스릴러"
                          value={values.genresText}
                        />

                        <Textarea
                          id="description"
                          label="설명"
                          name="description"
                          onChange={handleInputChange}
                          placeholder="작품 소개나 줄거리, 기록해두고 싶은 배경을 적어보세요"
                          rows={4}
                          value={values.description}
                        />

                        <Checkbox
                          checked={values.favorite}
                          label="즐겨찾기로 표시"
                          name="favorite"
                          onChange={handleInputChange}
                        />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </PageSection>

              {(validationError || submitError) && (
                <FeedbackMessage tone="error">
                  {validationError ?? submitError}
                </FeedbackMessage>
              )}

              <ActionRow>
                <AppButton
                  disabled={isSubmitting || shouldConfirmDuplicate}
                  tone="primary"
                  type="submit"
                >
                  {isSubmitting
                    ? '저장 중...'
                    : shouldConfirmDuplicate
                      ? '중복 확인 후 저장'
                      : '저장'}
                </AppButton>
                <AppLinkButton to="/works" tone="quiet">
                  취소
                </AppLinkButton>
              </ActionRow>
            </SectionCard>
          </form>
        )}
      </div>
    </SimpleGrid>
  );
}
