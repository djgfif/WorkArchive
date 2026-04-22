import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  Checkbox,
  Grid,
  NativeSelect,
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
} from '../../../shared/components/AppPrimitives';
import {
  createDefaultWorkFormValues,
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

interface WorkFormProps {
  cancelTo: string;
  focusArea?: 'general' | 'review';
  initialValues?: WorkFormValues;
  isSubmitting: boolean;
  onSubmit: (input: UpsertWorkInput) => Promise<void>;
  submitError: string | null;
  submitLabel: string;
}

export function WorkForm({
  cancelTo,
  focusArea = 'general',
  initialValues,
  isSubmitting,
  onSubmit,
  submitError,
  submitLabel,
}: WorkFormProps) {
  const [values, setValues] = useState<WorkFormValues>(
    initialValues ?? createDefaultWorkFormValues(),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const reviewSectionRef = useRef<HTMLDivElement | null>(null);
  const shortReviewInputRef = useRef<HTMLTextAreaElement | null>(null);
  const reviewInputRef = useRef<HTMLTextAreaElement | null>(null);
  const hasFocusedReviewRef = useRef(false);

  useEffect(() => {
    setValues(initialValues ?? createDefaultWorkFormValues());
  }, [initialValues]);

  useEffect(() => {
    if (focusArea !== 'review') {
      hasFocusedReviewRef.current = false;
    }
  }, [focusArea]);

  const previewTitle = values.title.trim() || '제목 없는 작품';
  const previewGenres = values.genresText
    .split(',')
    .map((genre) => genre.trim())
    .filter(Boolean)
    .slice(0, 4);
  const shortReviewLength = values.shortReview.trim().length;
  const reviewLength = values.review.trim().length;

  useEffect(() => {
    if (focusArea !== 'review' || hasFocusedReviewRef.current) {
      return;
    }

    reviewSectionRef.current?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'start',
    });

    const focusTarget =
      shortReviewLength === 0 ? shortReviewInputRef.current : reviewInputRef.current;

    focusTarget?.focus();
    hasFocusedReviewRef.current = true;
  }, [focusArea, reviewLength, shortReviewLength]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setValidationError(null);
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
          <SectionCard gap="xl" padding="xl" tone="default">
            <PageSection
              description="필수 정보만 먼저 입력하고, 나머지는 나중에 추가해도 기록 흐름이 깨지지 않도록 정리했습니다."
              divider={false}
              eyebrow="기본 정보"
              title="작품 정보"
            >
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
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

                <div style={{ gridColumn: '1 / -1' }}>
                  <TextInput
                    id="title"
                    label="제목"
                    name="title"
                    onChange={handleInputChange}
                    placeholder="작품 제목을 입력해주세요"
                    value={values.title}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
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
                  <Text c="var(--app-text-muted)" fz="sm" id="thumbnailUrlHint" mt={6}>
                    선택 사항입니다. 표지를 넣어두면 라이브러리에서 더 쉽게 찾을 수 있습니다.
                  </Text>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <TextInput
                    aria-describedby="genresTextHint"
                    id="genresText"
                    label="장르"
                    name="genresText"
                    onChange={handleInputChange}
                    placeholder="SF, 로맨스, 스릴러"
                    value={values.genresText}
                  />
                  <Text c="var(--app-text-muted)" fz="sm" id="genresTextHint" mt={6}>
                    장르는 쉼표로 구분해 입력해주세요.
                  </Text>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <Textarea
                    id="description"
                    label="설명"
                    name="description"
                    onChange={handleInputChange}
                    placeholder="작품 소개나 줄거리, 기록해두고 싶은 배경을 적어보세요"
                    rows={5}
                    value={values.description}
                  />
                </div>
              </SimpleGrid>
            </PageSection>

            <PageSection eyebrow="기록 정보" title="상태와 평가">
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
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

                <TextInput
                  id="rating"
                  label="별점"
                  max="5"
                  min="0"
                  name="rating"
                  onChange={handleInputChange}
                  placeholder="0~5"
                  step="0.5"
                  type="number"
                  value={values.rating}
                />

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
                  id="favorite"
                  label="즐겨찾기로 표시"
                  mt="xl"
                  name="favorite"
                  onChange={handleInputChange}
                />
              </SimpleGrid>
            </PageSection>

            <div ref={reviewSectionRef}>
              <PageSection
                description={
                  focusArea === 'review'
                    ? '이번에는 감상 문장을 먼저 정리할 수 있도록 이 영역을 바로 열어둡니다.'
                    : '짧은 감상과 긴 감상을 나눠두면 나중에 다시 읽을 때 더 편합니다.'
                }
                eyebrow="감상 기록"
                title={focusArea === 'review' ? '이번엔 감상 문장에 집중해보세요' : '감상을 남겨보세요'}
              >
                <ActionRow>
                  <MetricPill
                    label="목록과 홈 최근 기록에 우선 노출됩니다."
                    value={shortReviewLength > 0 ? `${shortReviewLength}자` : '한줄평 없음'}
                  />
                  <MetricPill
                    label="상세 화면에서 길게 읽는 감상입니다."
                    value={reviewLength > 0 ? `${reviewLength}자` : '상세 감상 없음'}
                  />
                </ActionRow>

                <Textarea
                  id="shortReview"
                  label="한 줄 감상"
                  name="shortReview"
                  onChange={handleInputChange}
                  placeholder="나중에 빠르게 훑어볼 수 있는 짧은 감상을 남겨보세요"
                  ref={shortReviewInputRef}
                  rows={3}
                  value={values.shortReview}
                />

                <Textarea
                  id="review"
                  label="상세 감상"
                  name="review"
                  onChange={handleInputChange}
                  placeholder="조금 더 길게 남기고 싶은 생각이나 감상을 적어보세요"
                  ref={reviewInputRef}
                  rows={8}
                  value={values.review}
                />
              </PageSection>
            </div>

            {(validationError || submitError) && (
              <FeedbackMessage tone="error">
                {validationError ?? submitError}
              </FeedbackMessage>
            )}

            <ActionRow>
              <AppButton disabled={isSubmitting} tone="primary" type="submit">
                {isSubmitting ? '저장 중...' : submitLabel}
              </AppButton>
              <AppLinkButton to={cancelTo} tone="quiet">
                취소
              </AppLinkButton>
            </ActionRow>
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <SectionCard gap="lg" padding="lg" tone="subtle">
            <ArtworkPoster
              thumbnailUrl={values.thumbnailUrl}
              title={previewTitle}
              typeLabel={getWorkTypeLabel(values.type)}
              variant="form"
            />

            <Stack gap="sm">
              <ActionRow>
                <AppBadge>{getWorkTypeLabel(values.type)}</AppBadge>
                <AppBadge>{getWorkStatusLabel(values.status)}</AppBadge>
                <AppBadge>{getWorkTierLabel(values.tier || null)}</AppBadge>
                {values.favorite && <AppBadge tone="accent">즐겨찾기</AppBadge>}
              </ActionRow>

              <div>
                <Title order={3}>{previewTitle}</Title>
                <Text c="var(--app-text-muted)">
                  {values.author.trim() || '작가·제작자 미입력'}
                </Text>
              </div>

              <Text c="var(--app-text-secondary)">
                {values.shortReview.trim() ||
                  values.description.trim() ||
                  '짧은 감상이나 설명을 남겨두면 나중에 다시 찾기 쉽습니다.'}
              </Text>

              <ActionRow>
                {previewGenres.length > 0 ? (
                  previewGenres.map((genre) => <AppBadge key={genre}>{genre}</AppBadge>)
                ) : (
                  <AppBadge tone="muted">장르 없음</AppBadge>
                )}
              </ActionRow>

              <Text c="var(--app-text-muted)">
                {focusArea === 'review'
                  ? '지금 쓰는 감상은 저장 후 상세 화면의 리뷰 영역으로 바로 이어집니다.'
                  : '핵심 정보부터 저장하고, 나중에 더 채워도 기록 구조는 그대로 유지됩니다.'}
              </Text>
            </Stack>
          </SectionCard>
        </Grid.Col>
      </Grid>
    </form>
  );
}
