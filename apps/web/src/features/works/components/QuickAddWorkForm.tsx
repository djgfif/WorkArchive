import { liveQuery } from 'dexie';
import type { WorkRecord } from '@work-archive/shared-types';
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  Checkbox,
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
  SectionCard,
  SectionIntro,
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

function findLikelyMatches(
  candidate: ImportCandidate,
  existingWorks: WorkRecord[],
) {
  const candidateTitleKeys = Array.from(
    new Set(
      [candidate.title, candidate.title.replace(/\s*\([^)]*\)\s*$/, '')]
        .map(normalizeTitle)
        .filter(Boolean),
    ),
  );

  return existingWorks.filter((work) =>
    candidateTitleKeys.some((key) => normalizeTitle(work.title) === key),
  );
}

function createValuesFromCandidate(candidate: ImportCandidate): WorkFormValues {
  return {
    ...createQuickAddDefaults(),
    author: candidate.author,
    description: candidate.description,
    genresText: candidate.genresText,
    title: candidate.title,
    type: candidate.type,
  };
}

interface StepCardProps {
  active: boolean;
  complete: boolean;
  label: string;
  step: number;
}

function StepCard({
  active,
  complete,
  label,
  step,
}: StepCardProps) {
  return (
    <Paper
      p="md"
      radius="lg"
      styles={{
        root: {
          backgroundColor: active || complete ? 'var(--app-accent-soft)' : 'var(--app-surface-1)',
          borderColor: active || complete ? 'var(--app-border-strong)' : 'var(--app-border-color)',
        },
      }}
      withBorder
    >
      <Stack gap={2}>
        <Text c="var(--app-accent)" fw={700} fz="0.76rem" lts="0.12em" tt="uppercase">
          {step}단계
        </Text>
        <Text c="var(--app-text-strong)" fw={700}>
          {label}
        </Text>
      </Stack>
    </Paper>
  );
}

interface CandidateCardProps {
  active: boolean;
  candidate: ImportCandidate;
  duplicateCount: number;
  onSelect: () => void;
}

function CandidateCard({
  active,
  candidate,
  duplicateCount,
  onSelect,
}: CandidateCardProps) {
  return (
    <Paper
      aria-label={`${candidate.title} ${getWorkTypeLabel(candidate.type)} 후보 선택`}
      component="button"
      onClick={onSelect}
      p="lg"
      radius="lg"
      styles={{
        root: {
          backgroundColor: active ? 'var(--app-accent-soft)' : 'var(--app-surface-1)',
          borderColor: active ? 'var(--app-border-strong)' : 'var(--app-border-color)',
          color: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          transition:
            'transform var(--app-transition-fast), border-color var(--app-transition-fast), background-color var(--app-transition-fast)',
          width: '100%',
        },
      }}
      type="button"
      withBorder
    >
      <Stack gap="md">
        <div
          style={{
            alignItems: 'flex-start',
            display: 'flex',
            gap: '1rem',
          }}
        >
          <ArtworkPoster
            title={candidate.title}
            typeLabel={getWorkTypeLabel(candidate.type)}
            variant="row"
          />

          <Stack flex={1} gap="sm" miw={0}>
            <ActionRow>
              <AppBadge tone="accent">{candidate.confidenceLabel}</AppBadge>
              <AppBadge>{candidate.note}</AppBadge>
              <AppBadge>{getWorkTypeLabel(candidate.type)}</AppBadge>
              {duplicateCount > 0 && <AppBadge tone="warning">비슷한 기록 {duplicateCount}개</AppBadge>}
            </ActionRow>

            <div>
              <Title order={4}>{candidate.title}</Title>
              <Text c="var(--app-text-muted)">{candidate.author}</Text>
            </div>

            <Text c="var(--app-text-secondary)">{candidate.description}</Text>
          </Stack>
        </div>

        <ActionRow>
          <MetricPill label="형식" value={candidate.formatLabel} />
          <MetricPill label="식별 정보" value={candidate.countLabel} />
          <MetricPill label="초안 출처" value={candidate.sourceLabel} />
        </ActionRow>
      </Stack>
    </Paper>
  );
}

export function QuickAddWorkForm({
  isSubmitting,
  onSubmit,
  submitError,
}: QuickAddWorkFormProps) {
  const { archiveScopeKey } = useAuthSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState('');
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [existingWorks, setExistingWorks] = useState<WorkRecord[]>([]);
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

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
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
    setCandidates(importsService.searchCandidates(normalizedSearchTerm));
    setValues(createQuickAddDefaults());
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

    try {
      setValidationError(null);
      await onSubmit(parseWorkFormValues(values));
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
  const activeStep =
    selectedCandidate && !shouldConfirmDuplicate ? 4 : selectedCandidate ? 3 : candidates.length > 0 ? 2 : 1;

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md" aria-label="작품 추가 단계">
        {['검색', '후보 선택', '작품 확인', '내 기록 입력'].map((label, index) => {
          const stepNumber = index + 1;

          return (
            <StepCard
              active={activeStep === stepNumber}
              complete={activeStep > stepNumber}
              key={label}
              label={label}
              step={stepNumber}
            />
          );
        })}
      </SimpleGrid>

      <SectionCard tone="hero">
        <SectionIntro
          description="검색에서 시작하고, 선택한 후보에 내 기록만 덧붙이는 흐름입니다."
          eyebrow="1단계"
          title="작품 검색"
          titleOrder={3}
        />

        <form onSubmit={handleSearchSubmit}>
          <ActionRow>
            <div style={{ flex: '1 1 18rem', minWidth: 220 }}>
              <TextInput
                id="quickAddSearch"
                label="작품 검색"
                onChange={(event) => setSearchTerm(event.currentTarget.value)}
                placeholder="제목이나 작가를 입력하세요"
                value={searchTerm}
              />
            </div>
            <AppButton tone="primary" type="submit">
              검색
            </AppButton>
          </ActionRow>
        </form>

        <ActionRow>
          <AppBadge tone="accent">검색 우선</AppBadge>
          <AppBadge>자동 채움 초안</AppBadge>
          <AppBadge>기록 최소 입력</AppBadge>
        </ActionRow>
      </SectionCard>

      {candidates.length > 0 && (
        <SectionCard>
          <SectionIntro
            description={`"${submittedSearchTerm}" 기준 후보 ${candidates.length}개입니다. 가장 가까운 작품부터 고르세요.`}
            eyebrow="2단계"
            title="검색 결과 선택"
            titleOrder={3}
          />

          <Stack gap="md">
            {candidates.map((candidate) => (
              <CandidateCard
                active={selectedCandidate?.id === candidate.id}
                candidate={candidate}
                duplicateCount={findLikelyMatches(candidate, existingWorks).length}
                key={candidate.id}
                onSelect={() => handleSelectCandidate(candidate)}
              />
            ))}
          </Stack>
        </SectionCard>
      )}

      {selectedCandidate && shouldConfirmDuplicate && (
        <SectionCard gap="lg" tone="subtle">
          <SectionIntro
            description="먼저 기존 기록을 확인한 뒤, 다른 작품이 맞다면 그대로 계속 추가하세요."
            eyebrow="중복 확인"
            title="비슷한 기록이 이미 있습니다"
            titleOrder={3}
          />

          <Stack gap="md">
            {duplicateMatches.map((work) => (
              <SectionCard key={work.id} padding="lg" tone="default">
                <div
                  style={{
                    alignItems: 'flex-start',
                    display: 'flex',
                    gap: '1rem',
                  }}
                >
                  <ArtworkPoster
                    thumbnailUrl={work.thumbnailUrl}
                    title={work.title}
                    typeLabel={getWorkTypeLabel(work.type)}
                    variant="row"
                  />
                  <Stack flex={1} gap="sm" miw={0}>
                    <ActionRow>
                      <AppBadge>{work.deletedAt === null ? '기존 기록' : '휴지통'}</AppBadge>
                      <AppBadge>{getWorkTypeLabel(work.type)}</AppBadge>
                      <AppBadge>{getWorkStatusLabel(work.status)}</AppBadge>
                    </ActionRow>
                    <div>
                      <Title order={4}>{work.title}</Title>
                      <Text c="var(--app-text-muted)">{work.author || '작가·제작자 미입력'}</Text>
                    </div>
                    <ActionRow>
                      {work.deletedAt === null ? (
                        <AppLinkButton to={`/works/${work.id}`}>기존 작품 보기</AppLinkButton>
                      ) : (
                        <AppLinkButton
                          to={`/works?scope=trash&q=${encodeURIComponent(work.title)}`}
                        >
                          휴지통에서 보기
                        </AppLinkButton>
                      )}
                    </ActionRow>
                  </Stack>
                </div>
              </SectionCard>
            ))}
          </Stack>

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
                setValues(createQuickAddDefaults());
              }}
              tone="quiet"
              type="button"
            >
              다른 후보 보기
            </AppButton>
          </ActionRow>
        </SectionCard>
      )}

      {selectedCandidate && !shouldConfirmDuplicate && (
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <SectionCard>
              <SectionIntro
                description="가져온 초안을 모두 다시 입력하지 말고, 제목·유형·작가만 먼저 확인합니다."
                eyebrow="3단계"
                title="선택한 작품 확인"
                titleOrder={3}
              />

              <div
                style={{
                  alignItems: 'flex-start',
                  display: 'flex',
                  gap: '1rem',
                }}
              >
                <ArtworkPoster
                  thumbnailUrl={values.thumbnailUrl}
                  title={values.title || selectedCandidate.title}
                  typeLabel={getWorkTypeLabel(values.type)}
                  variant="row"
                />
                <Stack flex={1} gap="sm" miw={0}>
                  <ActionRow>
                    <AppBadge tone="accent">{selectedCandidate.confidenceLabel}</AppBadge>
                    <AppBadge>{selectedCandidate.note}</AppBadge>
                    <AppBadge>{selectedCandidate.sourceLabel}</AppBadge>
                  </ActionRow>
                  <Text c="var(--app-text-secondary)">
                    {values.description || '설명은 아직 없습니다.'}
                  </Text>
                </Stack>
              </div>

              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <div style={{ gridColumn: '1 / -1' }}>
                  <TextInput
                    id="title"
                    label="제목"
                    name="title"
                    onChange={handleInputChange}
                    placeholder="작품 제목"
                    required
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
            </SectionCard>

            <SectionCard tone="hero">
              <SectionIntro
                description="저장 전에 직접 입력해야 하는 핵심 정보만 여기서 마무리합니다."
                eyebrow="4단계"
                title="개인 기록 입력"
                titleOrder={3}
              />

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

                <div style={{ gridColumn: '1 / -1' }}>
                  <TextInput
                    id="thumbnailUrl"
                    label="표지 이미지 주소"
                    name="thumbnailUrl"
                    onChange={handleInputChange}
                    placeholder="https://example.com/cover.jpg"
                    value={values.thumbnailUrl}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <TextInput
                    id="genresText"
                    label="장르"
                    name="genresText"
                    onChange={handleInputChange}
                    placeholder="SF, 로맨스, 스릴러"
                    value={values.genresText}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <Textarea
                    id="description"
                    label="설명"
                    name="description"
                    onChange={handleInputChange}
                    placeholder="작품 소개나 줄거리, 기록해두고 싶은 배경을 적어보세요"
                    rows={4}
                    value={values.description}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <Checkbox
                    checked={values.favorite}
                    label="즐겨찾기로 표시"
                    name="favorite"
                    onChange={handleInputChange}
                  />
                </div>
              </SimpleGrid>
            </SectionCard>

            {(validationError || submitError) && (
              <FeedbackMessage tone="error">
                {validationError ?? submitError}
              </FeedbackMessage>
            )}

            <ActionRow>
              <AppButton disabled={isSubmitting} tone="primary" type="submit">
                {isSubmitting ? '저장 중...' : '저장'}
              </AppButton>
              <AppLinkButton to="/works" tone="quiet">
                취소
              </AppLinkButton>
            </ActionRow>
          </Stack>
        </form>
      )}
    </Stack>
  );
}
