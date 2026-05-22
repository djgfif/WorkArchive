import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useForm } from '@mantine/form';
import {
  Affix,
  Box,
  Checkbox,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Stepper,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod/v4';

import {
  ActionRow,
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  MetricPill,
  SectionCard,
} from '../../../shared/components/AppPrimitives';
import {
  createDefaultWorkFormValues,
  formatTextListForWorkForm,
  getDisplayAuthorFromWorkFormValues,
  parseCommaSeparatedTextList,
  parseWorkFormValues,
  type UpsertWorkInput,
  type WorkFormValues,
} from '../utils/work-form';
import { getWorkMediaFieldLabels } from '../utils/work-media-labels';
import {
  getWorkStatusLabel,
  getWorkTypeLabel,
  workStatusOptions,
  workTypeOptions,
} from '../utils/work-options';
import {
  RatingDisplay,
  SegmentedChoiceGroup,
  StarRatingInput,
  WorkPoster,
} from './ArchiveComponents';
import { DuplicateWorkCandidatesCard } from './DuplicateWorkCandidatesCard';
import { useDuplicateWorkCandidates } from '../hooks/useDuplicateWorkCandidates';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import { useWorkFormDraft } from '../hooks/useWorkFormDraft';
import styles from './ArchiveComponents.module.css';
import { WorkGenreSelector } from './WorkGenreSelector';
import { normalizeWorkGenres } from '../utils/work-genres';

const REVIEW_FOCUS_DESCRIPTION_ID = 'work-form-review-focus-description';
const css = styles as Record<string, string>;
const REQUIRED_TITLE_MESSAGE = 'Title is required.';
const RATING_RANGE_MESSAGE = 'Rating must be between 0 and 5.';
const REVIEW_STEP_INDEX = 3;
const LAST_STEP_INDEX = 3;

function cn(value: string | undefined) {
  return value ?? '';
}

function optionalDateInputSchema(fieldLabel: string) {
  return z.string().refine((value) => {
    const trimmed = value.trim();

    if (!trimmed) {
      return true;
    }

    return !Number.isNaN(new Date(`${trimmed}T00:00:00.000Z`).getTime());
  }, `${fieldLabel} must be a valid date.`);
}

const workFormSchema = z
  .object({
    completedAt: optionalDateInputSchema('completedAt'),
    droppedAt: optionalDateInputSchema('droppedAt'),
    lastConsumedAt: optionalDateInputSchema('lastConsumedAt'),
    rating: z.string().refine((value) => {
      const trimmed = value.trim();

      if (!trimmed) {
        return true;
      }

      const parsedRating = Number.parseFloat(trimmed);

      return (
        Number.isFinite(parsedRating) &&
        parsedRating >= 0 &&
        parsedRating <= 5
      );
    }, RATING_RANGE_MESSAGE),
    startedAt: optionalDateInputSchema('startedAt'),
    title: z.string().trim().min(1, REQUIRED_TITLE_MESSAGE),
  })
  .passthrough();
const validateWorkFormSchema = zod4Resolver(workFormSchema);

function validateWorkForm(values: WorkFormValues) {
  return validateWorkFormSchema(values as unknown as Record<string, unknown>);
}

interface WorkFormProps {
  cancelTo: string;
  catalogTitleId?: string | null;
  currentWorkId?: string | null;
  draftKey?: string | null;
  focusArea?: 'general' | 'review';
  initialValues?: WorkFormValues;
  isSubmitting: boolean;
  onSubmit: (input: UpsertWorkInput) => Promise<void>;
  organizationContributorSuggestions?: string[];
  personContributorSuggestions?: string[];
  seriesSuggestions?: string[];
  submitError: string | null;
  submitLabel: string;
  tagSuggestions?: string[];
}

type WorkFormInput = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type WorkFormListFieldName =
  | 'creatorText'
  | 'genresText'
  | 'personalTagsText'
  | 'platformText'
  | 'publisherText'
  | 'seriesText'
  | 'studioText'
  | 'universeText';

export function WorkForm({
  cancelTo,
  catalogTitleId = null,
  currentWorkId = null,
  draftKey = null,
  focusArea = 'general',
  initialValues,
  isSubmitting,
  onSubmit,
  organizationContributorSuggestions = [],
  personContributorSuggestions = [],
  seriesSuggestions = [],
  submitError,
  submitLabel,
  tagSuggestions = [],
}: WorkFormProps) {
  const form = useForm<WorkFormValues>({
    clearInputErrorOnChange: true,
    initialValues: initialValues ?? createDefaultWorkFormValues(),
    validate: validateWorkForm,
    validateInputOnBlur: [
      'completedAt',
      'droppedAt',
      'lastConsumedAt',
      'rating',
      'startedAt',
      'title',
    ],
  });
  const values = form.values;
  const mediaLabels = getWorkMediaFieldLabels(values.type);
  const hasSeriesRelation =
    values.seriesText.trim() !== '' || values.universeText.trim() !== '';
  const [activeStep, setActiveStep] = useState(
    focusArea === 'review' ? REVIEW_STEP_INDEX : 0,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isSeriesWork, setIsSeriesWork] = useState(hasSeriesRelation);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const reviewSectionRef = useRef<HTMLDivElement | null>(null);
  const shortReviewInputRef = useRef<HTMLTextAreaElement | null>(null);
  const reviewInputRef = useRef<HTMLTextAreaElement | null>(null);
  const hasFocusedReviewRef = useRef(false);
  const defaultDraftBaseline = useMemo(() => createDefaultWorkFormValues(), []);
  const draft = useWorkFormDraft({
    baselineValues: initialValues ?? defaultDraftBaseline,
    draftKey,
    onRestore: (draftValues) => {
      form.setValues(draftValues);
      form.clearErrors();
      setTitleError(null);
      setValidationError(null);
    },
    values,
  });
  const duplicateCandidates = useDuplicateWorkCandidates({
    catalogTitleId,
    currentWorkId,
    title: values.title,
    type: values.type,
  });
  useUnsavedChangesWarning(draft.isDirty && !isSubmitting);

  useEffect(() => {
    const nextValues = initialValues ?? createDefaultWorkFormValues();

    if (form.isDirty()) {
      form.setInitialValues(nextValues);
      return;
    }

    form.setValues(nextValues);
    form.setInitialValues(nextValues);
    form.resetDirty(nextValues);
    form.clearErrors();
    setTitleError(null);
    setValidationError(null);
    setIsSeriesWork(
      nextValues.seriesText.trim() !== '' || nextValues.universeText.trim() !== '',
    );
    // The Mantine form instance is intentionally excluded; this effect only
    // reconciles external initialValues changes into the existing form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  useEffect(() => {
    if (hasSeriesRelation) {
      setIsSeriesWork(true);
    }
  }, [hasSeriesRelation]);

  useEffect(() => {
    if (focusArea !== 'review') {
      hasFocusedReviewRef.current = false;
      return;
    }

    setActiveStep(REVIEW_STEP_INDEX);
  }, [focusArea]);

  const previewTitle = values.title.trim() || '제목 없는 작품';
  const genreValues = normalizeWorkGenres(
    parseCommaSeparatedTextList(values.genresText),
  );
  const personalTagValues = parseCommaSeparatedTextList(
    values.personalTagsText,
  );
  const seriesValues = parseCommaSeparatedTextList(values.seriesText);
  const universeValues = parseCommaSeparatedTextList(values.universeText);
  const creatorValues = parseCommaSeparatedTextList(values.creatorText);
  const studioValues = parseCommaSeparatedTextList(values.studioText);
  const publisherValues = parseCommaSeparatedTextList(values.publisherText);
  const platformValues = parseCommaSeparatedTextList(values.platformText);
  const posterUrl = values.thumbnailUrl.trim();
  const ratingValue =
    values.rating.trim() === '' ? null : Number.parseFloat(values.rating);
  const normalizedRating =
    ratingValue !== null && Number.isFinite(ratingValue) ? ratingValue : null;

  function handleRatingChange(newRating: number | null) {
    form.setFieldValue('rating', newRating !== null ? String(newRating) : '');
  }
  const shortReviewLength = values.shortReview.trim().length;
  const reviewLength = values.review.trim().length;
  const submitButtonLabel = isSubmitting ? '저장 중...' : submitLabel;
  const mobileActionSummary = values.title.trim()
    ? `${values.title.trim()} 저장 준비`
    : '제목을 입력하면 저장할 수 있습니다.';
  const uniqueOrganizationSuggestions = Array.from(
    new Set(organizationContributorSuggestions),
  );
  const uniquePersonSuggestions = Array.from(new Set(personContributorSuggestions));
  const uniqueSeriesSuggestions = Array.from(new Set(seriesSuggestions));
  const uniqueTagSuggestions = Array.from(new Set(tagSuggestions));
  const shouldShowStudioField =
    mediaLabels.showStudioField || studioValues.length > 0;
  const previewTags = [...genreValues, ...personalTagValues].slice(0, 3);
  useEffect(() => {
    if (focusArea !== 'review' || hasFocusedReviewRef.current) {
      return;
    }

    if (activeStep !== REVIEW_STEP_INDEX) {
      setActiveStep(REVIEW_STEP_INDEX);
      return;
    }

    reviewSectionRef.current?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'start',
    });

    const focusTarget =
      shortReviewLength === 0
        ? shortReviewInputRef.current
        : reviewInputRef.current;

    if (focusTarget) {
      focusTarget.focus();
      hasFocusedReviewRef.current = true;
    }
  }, [activeStep, focusArea, reviewLength, shortReviewLength]);

  function handleInputChange(event: ChangeEvent<WorkFormInput>) {
    const { name, type } = event.target;
    const fieldName = name as keyof WorkFormValues;

    if (name === 'title') {
      setTitleError(null);
      setValidationError(null);
    }

    form.setFieldValue(
      fieldName,
      (type === 'checkbox'
        ? (event.target as HTMLInputElement).checked
        : event.target.value) as WorkFormValues[typeof fieldName],
    );
  }

  function handleValueChange<Value extends WorkFormValues[keyof WorkFormValues]>(
    name: keyof WorkFormValues,
    value: Value,
  ) {
    if (name === 'title') {
      setTitleError(null);
      setValidationError(null);
    }

    form.setFieldValue(name, value);
  }

  function handleTextListChange(
    name: WorkFormListFieldName,
    items: string[],
  ) {
    form.setFieldValue(name, formatTextListForWorkForm(items));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setValidationError(null);
      setTitleError(null);
      const validation = form.validate();

      if (validation.hasErrors) {
        const firstError = Object.values(validation.errors).find(Boolean);

        setValidationError(
          typeof firstError === 'string'
            ? firstError
            : REQUIRED_TITLE_MESSAGE,
        );

        if (validation.errors.title) {
          titleInputRef.current?.focus();
        }
        return;
      }

      if (!values.title.trim()) {
        const message = '제목을 입력해주세요.';

        setTitleError(message);
        setValidationError(message);
        titleInputRef.current?.focus();
        return;
      }

      await onSubmit(parseWorkFormValues(values));
      draft.clearDraft();
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : '작품을 저장하지 못했습니다.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit}>
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
      <Grid align="start" gutter="xl">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="xl">
            <SectionCard gap="lg" padding="xl" tone="default">
              <Stack gap="lg">
                <Stack gap={6}>
                  <Text c="archive.2" fw={800} size="xs" tt="uppercase">
                    단계별 기록
                  </Text>
                  <Title order={2}>작품을 바로 남기기</Title>
                  <Text c="dimmed">
                    기본 정보를 먼저 잡고, 감상 기록은 다음 단계에서 편하게 정리합니다.
                  </Text>
                </Stack>

                <Stepper active={activeStep} onStepClick={setActiveStep}>
                  <Stepper.Step
                    description="제목, 표지, 분류"
                    label="기본 정보"
                  >
                    <Stack gap="lg" pt="md">
                      <Grid gutter="md">
                        <Grid.Col span={12}>
                          <TextInput
                            aria-label="제목"
                            error={form.errors.title ?? titleError}
                            id="title"
                            label="제목"
                            name="title"
                            onChange={handleInputChange}
                            placeholder="작품 제목"
                            ref={titleInputRef}
                            value={values.title}
                            withAsterisk
                          />
                        </Grid.Col>

                        <Grid.Col span={12}>
                          <TextInput
                            aria-describedby="thumbnailUrlHint"
                            id="thumbnailUrl"
                            label="표지 이미지 주소"
                            name="thumbnailUrl"
                            onChange={handleInputChange}
                            placeholder="https://example.com/cover.jpg"
                            type="url"
                            value={values.thumbnailUrl}
                          />
                          <Text c="dimmed" id="thumbnailUrlHint" mt={4} size="xs">
                            표지가 없으면 fallback 커버로 표시됩니다.
                          </Text>
                        </Grid.Col>
                      </Grid>

                      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                        <SegmentedChoiceGroup
                          aria-label="작품 유형"
                          label="유형"
                          onChange={(value) =>
                            handleValueChange('type', value)
                          }
                          options={workTypeOptions}
                          value={values.type}
                        />
                        <WorkGenreSelector
                          description="대표 장르는 최대 3개까지 선택합니다."
                          id="genresText"
                          onChange={(items) =>
                            handleTextListChange('genresText', items)
                          }
                          value={genreValues}
                        />
                      </SimpleGrid>

                      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                        <SegmentedChoiceGroup
                          aria-label="작품 상태"
                          label="상태"
                          onChange={(value) =>
                            handleValueChange('status', value)
                          }
                          options={workStatusOptions}
                          value={values.status}
                        />
                      </SimpleGrid>

                      <Checkbox
                        checked={values.favorite}
                        label="즐겨찾기로 표시"
                        name="favorite"
                        onChange={handleInputChange}
                      />

                      <TextInput
                        id="startedAt"
                        label="시작일"
                        name="startedAt"
                        onChange={handleInputChange}
                        type="date"
                        value={values.startedAt}
                      />
                      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                        <TextInput
                          id="lastConsumedAt"
                          label="마지막 감상일"
                          name="lastConsumedAt"
                          onChange={handleInputChange}
                          type="date"
                          value={values.lastConsumedAt}
                        />
                        <TextInput
                          id="completedAt"
                          label="완료일"
                          name="completedAt"
                          onChange={handleInputChange}
                          type="date"
                          value={values.completedAt}
                        />
                        <TextInput
                          id="droppedAt"
                          label="하차일"
                          name="droppedAt"
                          onChange={handleInputChange}
                          type="date"
                          value={values.droppedAt}
                        />
                      </SimpleGrid>

                    </Stack>
                  </Stepper.Step>

                  <Stepper.Step
                    description="시리즈, 세계관"
                    label="시리즈 / 관계"
                  >
                    <Stack gap="lg" pt="md">
                      <Paper p="md" radius="md" withBorder>
                        <Stack gap="md">
                          <Checkbox
                            checked={isSeriesWork}
                            description="후속작, 외전, 리메이크, 공유 세계관을 따로 묶어 탐색할 때 사용합니다."
                            label="시리즈 / 세계관 연결"
                            onChange={(event) => {
                              const checked = event.currentTarget.checked;
                              setIsSeriesWork(checked);

                              if (!checked) {
                                form.setFieldValue('seriesText', '');
                                form.setFieldValue('universeText', '');
                              }
                            }}
                          />

                          {isSeriesWork && (
                            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                              <TagsInput
                                clearable
                                data={uniqueSeriesSuggestions}
                                description={mediaLabels.seriesDescription}
                                id="seriesText"
                                label={mediaLabels.seriesLabel}
                                name="seriesText"
                                onChange={(items) => handleTextListChange('seriesText', items)}
                                placeholder={mediaLabels.seriesPlaceholder}
                                splitChars={[',']}
                                value={seriesValues}
                              />
                              <TagsInput
                                clearable
                                data={uniqueSeriesSuggestions}
                                description={mediaLabels.universeDescription}
                                id="universeText"
                                label={mediaLabels.universeLabel}
                                name="universeText"
                                onChange={(items) => handleTextListChange('universeText', items)}
                                placeholder={mediaLabels.universePlaceholder}
                                splitChars={[',']}
                                value={universeValues}
                              />
                            </SimpleGrid>
                          )}
                        </Stack>
                      </Paper>
                    </Stack>
                  </Stepper.Step>

                  <Stepper.Step
                    description="매체별 제작 정보"
                    label="제작진"
                  >
                    <Stack gap="lg" pt="md">
                      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                        <TagsInput
                          clearable
                          data={uniquePersonSuggestions}
                          id="creatorText"
                          label={mediaLabels.creatorLabel}
                          name="creatorText"
                          onChange={(items) => handleTextListChange('creatorText', items)}
                          placeholder={mediaLabels.creatorPlaceholder}
                          splitChars={[',']}
                          value={creatorValues}
                        />
                        {shouldShowStudioField && (
                          <TagsInput
                            clearable
                            data={uniqueOrganizationSuggestions}
                            id="studioText"
                            label={mediaLabels.studioLabel}
                            name="studioText"
                            onChange={(items) => handleTextListChange('studioText', items)}
                            placeholder={mediaLabels.studioPlaceholder}
                            splitChars={[',']}
                            value={studioValues}
                          />
                        )}
                        <TagsInput
                          clearable
                          data={uniqueOrganizationSuggestions}
                          id="publisherText"
                          label={mediaLabels.publisherLabel}
                          name="publisherText"
                          onChange={(items) => handleTextListChange('publisherText', items)}
                          placeholder={mediaLabels.publisherPlaceholder}
                          splitChars={[',']}
                          value={publisherValues}
                        />
                        <TagsInput
                          clearable
                          data={uniqueOrganizationSuggestions}
                          id="platformText"
                          label={mediaLabels.platformLabel}
                          name="platformText"
                          onChange={(items) => handleTextListChange('platformText', items)}
                          placeholder={mediaLabels.platformPlaceholder}
                          splitChars={[',']}
                          value={platformValues}
                        />
                      </SimpleGrid>
                    </Stack>
                  </Stepper.Step>

                  <Stepper.Step
                    description="평점과 감상"
                    label="감상 기록"
                  >
                    <Box ref={reviewSectionRef}>
                      <Stack gap="md" pt="md">
                      {focusArea === 'review' && (
                        <FeedbackMessage title="리뷰 집중 모드" tone="info">
                          <span id={REVIEW_FOCUS_DESCRIPTION_ID}>
                            한줄평과 상세 감상 입력으로 바로 이동했습니다.
                            저장하면 상세 화면의 개인 감상 기록으로 돌아갑니다.
                          </span>
                        </FeedbackMessage>
                      )}

                      <Textarea
                        aria-describedby={
                          focusArea === 'review'
                            ? REVIEW_FOCUS_DESCRIPTION_ID
                            : undefined
                        }
                        description={
                          focusArea === 'review'
                            ? '상세 화면에서 이어 온 리뷰 집중 수정 입력입니다.'
                            : undefined
                        }
                        id="shortReview"
                        label="한 줄 감상"
                        name="shortReview"
                        onChange={handleInputChange}
                        placeholder="목록과 상세 상단에 남길 짧은 감상"
                        ref={shortReviewInputRef}
                        rows={3}
                        value={values.shortReview}
                      />

                      <Textarea
                        aria-describedby={
                          focusArea === 'review'
                            ? REVIEW_FOCUS_DESCRIPTION_ID
                            : undefined
                        }
                        description={
                          focusArea === 'review'
                            ? '한줄평보다 길게 남기는 개인 감상 입력입니다.'
                            : undefined
                        }
                        id="review"
                        label="상세 감상"
                        name="review"
                        onChange={handleInputChange}
                        placeholder="길게 남기고 싶은 장면, 인상, 생각"
                        ref={reviewInputRef}
                        rows={8}
                        value={values.review}
                      />
                      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                        <StarRatingInput
                          label="고급별점"
                          onChange={handleRatingChange}
                          value={normalizedRating}
                        />
                        <Textarea
                          id="description"
                          label="작품 메모"
                          name="description"
                          onChange={handleInputChange}
                          placeholder="줄거리나 기억해둘 배경"
                          rows={4}
                          value={values.description}
                        />
                      </SimpleGrid>

                      <Stack gap="xs">
                        <Text fw={600} size="sm" style={{ color: 'var(--app-text-secondary)' }}>
                          개인 태그
                          <Text component="span" c="dimmed" fw={400} size="xs" ml={6}>
                            취향, 소재, 기억할 키워드
                          </Text>
                        </Text>
                        <TagsInput
                          clearable
                          data={uniqueTagSuggestions}
                          id="personalTagsText"
                          name="personalTagsText"
                          onChange={(items) => handleTextListChange('personalTagsText', items)}
                          placeholder="여운, 다시 볼 것, 시간여행"
                          splitChars={[',']}
                          value={personalTagValues}
                          styles={{
                            input: {
                              background: 'var(--app-surface-default)',
                              border: '1.5px solid var(--app-border-default)',
                              borderRadius: 10,
                              fontSize: '0.875rem',
                            },
                            pill: {
                              background: 'color-mix(in srgb, var(--app-accent-secondary) 14%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--app-accent-secondary) 30%, transparent)',
                              color: 'var(--app-accent-secondary)',
                              fontWeight: 600,
                              borderRadius: 6,
                              fontSize: '0.8rem',
                            },
                          }}
                        />
                        <Group gap={4}>
                          {uniqueTagSuggestions.slice(0, 12).map((tag) => (
                            <button
                              aria-pressed={personalTagValues.includes(tag)}
                              className={css.filterPill}
                              key={tag}
                              onClick={() => {
                                if (!personalTagValues.includes(tag)) {
                                  handleTextListChange('personalTagsText', [...personalTagValues, tag]);
                                }
                              }}
                              style={{
                                background: personalTagValues.includes(tag)
                                  ? 'color-mix(in srgb, var(--app-accent-secondary) 18%, transparent)'
                                  : 'var(--app-surface-subtle)',
                                border: personalTagValues.includes(tag)
                                  ? '1.5px solid color-mix(in srgb, var(--app-accent-secondary) 40%, transparent)'
                                  : '1.5px solid var(--app-border-default)',
                                borderRadius: 20,
                                color: personalTagValues.includes(tag)
                                  ? 'var(--app-accent-secondary)'
                                  : 'var(--app-text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                padding: '3px 10px',
                              }}
                              type="button"
                            >
                              {personalTagValues.includes(tag) ? '✓ ' : '+ '}{tag}
                            </button>
                          ))}
                        </Group>
                      </Stack>
                    </Stack>
                    </Box>
                  </Stepper.Step>
                </Stepper>

                <ActionRow justify="space-between">
                  <AppButton
                    disabled={activeStep === 0}
                    onClick={() =>
                      setActiveStep((currentStep) =>
                        Math.max(0, currentStep - 1),
                      )
                    }
                    tone="secondary"
                    type="button"
                  >
                    이전
                  </AppButton>
                  <AppButton
                    onClick={() =>
                      setActiveStep((currentStep) =>
                        currentStep >= LAST_STEP_INDEX
                          ? 0
                          : currentStep + 1,
                      )
                    }
                    tone="secondary"
                    type="button"
                  >
                    {activeStep >= LAST_STEP_INDEX ? '처음으로' : '다음'}
                  </AppButton>
                </ActionRow>
              </Stack>
            </SectionCard>

            <DuplicateWorkCandidatesCard candidates={duplicateCandidates} />

            {(validationError || submitError) && (
              <FeedbackMessage tone="error">
                {validationError ?? submitError}
              </FeedbackMessage>
            )}

            <ActionRow>
              <AppButton
                disabled={isSubmitting}
                loading={isSubmitting}
                tone="primary"
                type="submit"
              >
                {submitButtonLabel}
              </AppButton>
              <AppLinkButton to={cancelTo} tone="quiet">
                취소
              </AppLinkButton>
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
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Paper className={cn(css.quickCapturePreview)} p="lg" radius="lg" shadow="md" withBorder>
            <Stack gap="lg">
              <WorkPoster
                title={previewTitle}
                typeLabel={getWorkTypeLabel(values.type)}
                variant="form"
                {...(posterUrl ? { thumbnailUrl: posterUrl } : {})}
              />

              <Stack gap="sm">
                <Group gap="xs">
                  <AppBadge>{getWorkTypeLabel(values.type)}</AppBadge>
                  <AppBadge>{getWorkStatusLabel(values.status)}</AppBadge>
                  {values.favorite && <AppBadge tone="accent">즐겨찾기</AppBadge>}
                </Group>

                <div>
                  <Title order={3}>{previewTitle}</Title>
                  <Text c="dimmed">
                    {getDisplayAuthorFromWorkFormValues(values) ||
                      '작가/제작자 미입력'}
                  </Text>
                </div>

                <RatingDisplay value={normalizedRating} />

                <Text c="dimmed">
                  {values.shortReview.trim() ||
                    values.description.trim() ||
                    '지금 남긴 감상은 목록과 상세 화면에서 다시 읽기 쉽게 보입니다.'}
                </Text>

                <ActionRow>
                  {previewTags.length > 0 ? (
                    previewTags.map((tag) => <AppBadge key={tag}>{tag}</AppBadge>)
                  ) : (
                    <AppBadge tone="muted">분류 없음</AppBadge>
                  )}
                </ActionRow>

                <MetricPill
                  label="감상 길이"
                  value={
                    reviewLength > 0
                      ? `상세 ${reviewLength}자`
                      : shortReviewLength > 0
                        ? `한줄평 ${shortReviewLength}자`
                        : '아직 없음'
                  }
                />
              </Stack>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      <Affix bottom={12} hiddenFrom="sm" left={12} right={12} zIndex={200}>
        <SectionCard
          className={cn(css.mobileSaveAffix)}
          gap="xs"
          padding="sm"
          tone="default"
        >
          <Text c="dimmed" fw={700} lineClamp={1} size="xs">
            {mobileActionSummary}
          </Text>
          <ActionRow>
            <AppButton
              aria-label={`${submitLabel} 하단 고정 저장`}
              disabled={isSubmitting}
              fullWidth
              loading={isSubmitting}
              tone="primary"
              type="submit"
            >
              {submitButtonLabel}
            </AppButton>
            <AppLinkButton to={cancelTo} tone="quiet">
              취소
            </AppLinkButton>
            {draft.saveStatus === 'saved' && (
              <AppBadge tone="success">임시저장됨</AppBadge>
            )}
          </ActionRow>
        </SectionCard>
      </Affix>
    </form>
  );
}
