import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  Accordion,
  Affix,
  Checkbox,
  Grid,
  Group,
  NativeSelect,
  Paper,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';

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
import { RatingDisplay, StarRatingInput, WorkPoster } from './ArchiveComponents';

const REVIEW_FOCUS_DESCRIPTION_ID = 'work-form-review-focus-description';

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
  const [values, setValues] = useState<WorkFormValues>(
    initialValues ?? createDefaultWorkFormValues(),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const reviewSectionRef = useRef<HTMLDivElement | null>(null);
  const shortReviewInputRef = useRef<HTMLTextAreaElement | null>(null);
  const reviewInputRef = useRef<HTMLTextAreaElement | null>(null);
  const hasFocusedReviewRef = useRef(false);

  useEffect(() => {
    setValues(initialValues ?? createDefaultWorkFormValues());
    setTitleError(null);
    setValidationError(null);
  }, [initialValues]);

  useEffect(() => {
    if (focusArea !== 'review') {
      hasFocusedReviewRef.current = false;
    }
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
    setValues((prev) => ({
      ...prev,
      rating: newRating !== null ? String(newRating) : '',
    }));
  }
  const shortReviewLength = values.shortReview.trim().length;
  const reviewLength = values.review.trim().length;
  const submitButtonLabel = isSubmitting ? '저장 중...' : submitLabel;
  const mobileActionSummary = values.title.trim()
    ? `${values.title.trim()} 저장 준비`
    : '제목을 입력하면 저장할 수 있습니다.';
  const uniqueTagSuggestions = Array.from(new Set(tagSuggestions));
  const previewTags = [...genreValues, ...personalTagValues].slice(0, 3);

  useEffect(() => {
    if (focusArea !== 'review' || hasFocusedReviewRef.current) {
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

    focusTarget?.focus();
    hasFocusedReviewRef.current = true;
  }, [focusArea, reviewLength, shortReviewLength]);

  function handleInputChange(event: ChangeEvent<WorkFormInput>) {
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

  function handleTextListChange(
    name: 'genresText' | 'personalTagsText',
    items: string[],
  ) {
    setValues((currentValues) => ({
      ...currentValues,
      [name]: formatTextListForWorkForm(items),
    }));
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
            <SectionCard gap="xl" padding="xl" tone="default">
              <Stack gap="lg">
                <Stack gap={6}>
                  <Text c="archive.2" fw={800} size="xs" tt="uppercase">
                    빠른 기록
                  </Text>
                  <Title order={2}>작품을 바로 남기기</Title>
                  <Text c="dimmed">
                    제목 하나로 시작하고, 감상은 나중에 천천히 채워도 됩니다.
                  </Text>
                </Stack>

                <Grid gutter="md">
                  <Grid.Col span={12}>
                    <TextInput
                      aria-label="제목"
                      error={titleError}
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
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <NativeSelect
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
                  </Grid.Col>

                  <Grid.Col span={12}>
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
                  </Grid.Col>
                </Grid>
              </Stack>
            </SectionCard>

            <div ref={reviewSectionRef}>
              <Accordion
                defaultValue={focusArea === 'review' ? ['review'] : []}
                multiple
                variant="contained"
              >
                <Accordion.Item value="cover">
                  <Accordion.Control>표지와 분류</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md" pt="sm">
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
                      <Text c="dimmed" id="thumbnailUrlHint" size="sm">
                        표지가 없으면 어두운 fallback 커버로 표시됩니다.
                      </Text>

                      <Stack gap="lg">
                        {/* 장르 태그 */}
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
                          {/* 자주 쓰는 장르 빠른 선택 */}
                          {(['SF', '판타지', '로맨스', '액션', '드라마', '스릴러', '호러', '코미디', '슬라이스 오브 라이프', '스포츠', '역사', '시대극'] as const).map((genre) => (
                            <span
                              key={genre}
                              onClick={() => {
                                if (!genreValues.includes(genre)) {
                                  handleTextListChange('genresText', [...genreValues, genre]);
                                }
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 10px',
                                borderRadius: 20,
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                userSelect: 'none',
                                marginRight: 4,
                                marginBottom: 4,
                                transition: 'all 120ms ease',
                                background: genreValues.includes(genre)
                                  ? 'color-mix(in srgb, var(--app-accent-primary) 18%, transparent)'
                                  : 'var(--app-surface-subtle)',
                                border: genreValues.includes(genre)
                                  ? '1.5px solid color-mix(in srgb, var(--app-accent-primary) 40%, transparent)'
                                  : '1.5px solid var(--app-border-default)',
                                color: genreValues.includes(genre)
                                  ? 'var(--app-accent-primary)'
                                  : 'var(--app-text-secondary)',
                              }}
                            >
                              {genreValues.includes(genre) ? '✓ ' : '+ '}{genre}
                            </span>
                          ))}
                        </Stack>

                        {/* 개인 태그 */}
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
                          {/* 추청 태그 빠른 선택 */}
                          {uniqueTagSuggestions.slice(0, 12).map((tag) => (
                            <span
                              key={tag}
                              onClick={() => {
                                if (!personalTagValues.includes(tag)) {
                                  handleTextListChange('personalTagsText', [...personalTagValues, tag]);
                                }
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 10px',
                                borderRadius: 20,
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                userSelect: 'none',
                                marginRight: 4,
                                marginBottom: 4,
                                transition: 'all 120ms ease',
                                background: personalTagValues.includes(tag)
                                  ? 'color-mix(in srgb, var(--app-accent-secondary) 18%, transparent)'
                                  : 'var(--app-surface-subtle)',
                                border: personalTagValues.includes(tag)
                                  ? '1.5px solid color-mix(in srgb, var(--app-accent-secondary) 40%, transparent)'
                                  : '1.5px solid var(--app-border-default)',
                                color: personalTagValues.includes(tag)
                                  ? 'var(--app-accent-secondary)'
                                  : 'var(--app-text-secondary)',
                              }}
                            >
                              {personalTagValues.includes(tag) ? '✓ ' : '+ '}{tag}
                            </span>
                          ))}
                        </Stack>
                      </Stack>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item value="review">
                  <Accordion.Control>상세 감상</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md" pt="sm">
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
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item value="details">
                  <Accordion.Control>추가 정보</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md" pt="sm">
                      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                        <TextInput
                          id="author"
                          label="작가/제작자"
                          name="author"
                          onChange={handleInputChange}
                          placeholder="작가, 스튜디오, 제작자"
                          value={values.author}
                        />
                        <StarRatingInput
                          label="별점"
                          onChange={handleRatingChange}
                          value={normalizedRating}
                        />
                      </SimpleGrid>

                      <Textarea
                        id="description"
                        label="작품 메모"
                        name="description"
                        onChange={handleInputChange}
                        placeholder="줄거리나 기억해둘 배경"
                        rows={4}
                        value={values.description}
                      />

                      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                        <NativeSelect
                          id="tier"
                          label="티어"
                          name="tier"
                          onChange={handleInputChange}
                          value={values.tier}
                        >
                          <option value="">미지정</option>
                          {workTierOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </NativeSelect>

                        <Checkbox
                          checked={values.favorite}
                          label="즐겨찾기로 표시"
                          mt="xl"
                          name="favorite"
                          onChange={handleInputChange}
                        />
                      </SimpleGrid>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item value="dates">
                  <Accordion.Control>감상 날짜</Accordion.Control>
                  <Accordion.Panel>
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" pt="sm">
                      <TextInput
                        id="startedAt"
                        label="시작일"
                        name="startedAt"
                        onChange={handleInputChange}
                        type="date"
                        value={values.startedAt}
                      />
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
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </div>

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
        <SectionCard gap="xs" padding="sm" tone="default">
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
