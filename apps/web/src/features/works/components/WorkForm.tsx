import {
  useEffect,
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
  parseCommaSeparatedTextList,
  parseWorkFormValues,
  type UpsertWorkInput,
  type WorkFormValues,
} from '../utils/work-form';
import {
  getWorkStatusLabel,
  getWorkTierLabel,
  getWorkTypeLabel,
  workStatusOptions,
  workTierOptions,
  workTypeOptions,
} from '../utils/work-options';
import {
  RatingDisplay,
  SegmentedChoiceGroup,
  StarRatingInput,
  WorkPoster,
} from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';

const REVIEW_FOCUS_DESCRIPTION_ID = 'work-form-review-focus-description';
const css = styles as Record<string, string>;
const REQUIRED_TITLE_MESSAGE = 'Title is required.';
const RATING_RANGE_MESSAGE = 'Rating must be between 0 and 5.';

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
  focusArea?: 'general' | 'review';
  initialValues?: WorkFormValues;
  isSubmitting: boolean;
  onSubmit: (input: UpsertWorkInput) => Promise<void>;
  submitError: string | null;
  submitLabel: string;
  tagSuggestions?: string[];
}

type WorkFormInput = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function WorkForm({
  cancelTo,
  focusArea = 'general',
  initialValues,
  isSubmitting,
  onSubmit,
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
  const [activeStep, setActiveStep] = useState(focusArea === 'review' ? 1 : 0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const reviewSectionRef = useRef<HTMLDivElement | null>(null);
  const shortReviewInputRef = useRef<HTMLTextAreaElement | null>(null);
  const reviewInputRef = useRef<HTMLTextAreaElement | null>(null);
  const hasFocusedReviewRef = useRef(false);

  useEffect(() => {
    const nextValues = initialValues ?? createDefaultWorkFormValues();

    form.setValues(nextValues);
    form.setInitialValues(nextValues);
    form.resetDirty(nextValues);
    form.clearErrors();
    setTitleError(null);
    setValidationError(null);
    // The Mantine form instance is intentionally excluded; this effect only
    // reconciles external initialValues changes into the existing form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  useEffect(() => {
    if (focusArea !== 'review') {
      hasFocusedReviewRef.current = false;
      return;
    }

    setActiveStep(1);
  }, [focusArea]);

  const previewTitle = values.title.trim() || '제목 없는 작품';
  const genreValues = parseCommaSeparatedTextList(values.genresText);
  const personalTagValues = parseCommaSeparatedTextList(
    values.personalTagsText,
  );
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
  const uniqueTagSuggestions = Array.from(new Set(tagSuggestions));
  const previewTags = [...genreValues, ...personalTagValues].slice(0, 3);
  const tierOptions = [{ label: '미지정', value: '' }, ...workTierOptions];

  useEffect(() => {
    if (focusArea !== 'review' || hasFocusedReviewRef.current) {
      return;
    }

    if (activeStep !== 1) {
      setActiveStep(1);
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
    name: 'genresText' | 'personalTagsText',
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
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : '작품을 저장하지 못했습니다.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit}>
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

                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <TextInput
                            id="author"
                            label="작가/제작자"
                            name="author"
                            onChange={handleInputChange}
                            placeholder="작가, 스튜디오, 제작자"
                            value={values.author}
                          />
                        </Grid.Col>

                        <Grid.Col span={{ base: 12, md: 6 }}>
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

                      <SegmentedChoiceGroup
                        aria-label="개인 티어"
                        label="티어"
                        onChange={(value) => handleValueChange('tier', value)}
                        options={tierOptions}
                        value={values.tier}
                      />

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
                          label="중단일"
                          name="droppedAt"
                          onChange={handleInputChange}
                          type="date"
                          value={values.droppedAt}
                        />
                      </SimpleGrid>

                      <Stack gap="xs">
                        <Text fw={600} size="sm" style={{ color: 'var(--app-text-secondary)' }}>
                          장르
                        </Text>
                        <TagsInput
                          clearable
                          id="genresText"
                          name="genresText"
                          onChange={(items) => handleTextListChange('genresText', items)}
                          placeholder="Enter 또는 쉼표로 구분"
                          splitChars={[',']}
                          value={genreValues}
                          styles={{
                            input: {
                              background: 'var(--app-surface-default)',
                              border: '1.5px solid var(--app-border-default)',
                              borderRadius: 10,
                              fontSize: '0.875rem',
                            },
                            pill: {
                              background: 'color-mix(in srgb, var(--app-accent-primary) 14%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--app-accent-primary) 30%, transparent)',
                              color: 'var(--app-accent-primary)',
                              fontWeight: 600,
                              borderRadius: 6,
                              fontSize: '0.8rem',
                            },
                          }}
                        />
                        <Group gap={4}>
                          {(['SF', '판타지', '로맨스', '액션', '드라마', '스릴러', '호러', '코미디', '슬라이스 오브 라이프', '스포츠', '역사', '시대극'] as const).map((genre) => (
                            <button
                              aria-pressed={genreValues.includes(genre)}
                              className={css.filterPill}
                              key={genre}
                              onClick={() => {
                                if (!genreValues.includes(genre)) {
                                  handleTextListChange('genresText', [...genreValues, genre]);
                                }
                              }}
                              style={{
                                background: genreValues.includes(genre)
                                  ? 'color-mix(in srgb, var(--app-accent-primary) 18%, transparent)'
                                  : 'var(--app-surface-subtle)',
                                border: genreValues.includes(genre)
                                  ? '1.5px solid color-mix(in srgb, var(--app-accent-primary) 40%, transparent)'
                                  : '1.5px solid var(--app-border-default)',
                                borderRadius: 20,
                                color: genreValues.includes(genre)
                                  ? 'var(--app-accent-primary)'
                                  : 'var(--app-text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                padding: '3px 10px',
                              }}
                              type="button"
                            >
                              {genreValues.includes(genre) ? '✓ ' : '+ '}{genre}
                            </button>
                          ))}
                        </Group>
                      </Stack>

                      <Stack gap="xs">
                        <Text fw={600} size="sm" style={{ color: 'var(--app-text-secondary)' }}>
                          개인 태그
                          <Text component="span" c="dimmed" fw={400} size="xs" ml={6}>
                            나만의 감상 분류
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
                          label="별점"
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
                    </Stack>
                    </Box>
                  </Stepper.Step>
                </Stepper>

                <ActionRow justify="space-between">
                  <AppButton
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep(0)}
                    tone="secondary"
                    type="button"
                  >
                    기본 정보
                  </AppButton>
                  <AppButton
                    onClick={() => setActiveStep(activeStep === 0 ? 1 : 0)}
                    tone="secondary"
                    type="button"
                  >
                    {activeStep === 0 ? '감상 기록으로' : '기본 정보로'}
                  </AppButton>
                </ActionRow>
              </Stack>
            </SectionCard>

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
            </ActionRow>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Paper p="lg" radius="lg" shadow="md" withBorder>
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
                    {values.author.trim() || '작가/제작자 미입력'}
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

                {values.tier && (
                  <MetricPill
                    label="개인 티어"
                    value={getWorkTierLabel(values.tier)}
                  />
                )}
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
          </ActionRow>
        </SectionCard>
      </Affix>
    </form>
  );
}
