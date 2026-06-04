import type { ReactNode, RefObject } from 'react';
import { Stack, Stepper, Text, Title } from '@mantine/core';

import {
  ActionRow,
  AppButton,
  SectionCard,
} from '@shared/components/AppPrimitives';
import {
  type WorkFormInputChangeHandler,
  type WorkFormListFieldName,
  type WorkFormSuggestionProps,
  type WorkFormTitleRefProps,
  type WorkFormValuesProps,
} from './add-work-form.types';
import { WorkFormBasicInfoStep } from './WorkFormBasicInfoStep';
import { WorkFormContributorStep } from './WorkFormContributorStep';
import { WorkFormReviewStep } from './WorkFormReviewStep';
import { WorkFormSeriesRelationStep } from './WorkFormSeriesRelationStep';
import { parseCommaSeparatedTextList } from '../utils/work-form';
import { getWorkMediaFieldLabels } from '../utils/work-media-labels';
import { normalizeWorkGenres } from '../utils/work-genres';
import { WEB_NOVEL_KEYWORDS } from '../utils/web-novel-keywords';

interface WorkFormStepNavigationProps {
  activeStep: number;
  isLastStep: boolean;
  onNextStep: () => void;
  onPreviousStep: () => void;
  onStepClick: (stepIndex: number) => void;
}

interface WorkFormStepFieldsProps
  extends WorkFormSuggestionProps,
    WorkFormTitleRefProps,
    WorkFormValuesProps {
  focusArea: 'general' | 'review';
  isSeriesWork: boolean;
  onInputChange: WorkFormInputChangeHandler;
  onRatingChange: (rating: number | null) => void;
  onSeriesWorkChange: (isSeriesWork: boolean) => void;
  onStatusChange: (status: WorkFormValuesProps['values']['status']) => void;
  onTextListChange: (name: WorkFormListFieldName, values: string[]) => void;
  onTypeChange: (type: WorkFormValuesProps['values']['type']) => void;
  reviewInputRef: RefObject<HTMLTextAreaElement | null>;
  reviewSectionRef: RefObject<HTMLDivElement | null>;
  shortReviewInputRef: RefObject<HTMLTextAreaElement | null>;
  titleError?: ReactNode;
}

interface WorkFormStepsProps
  extends WorkFormStepFieldsProps,
    WorkFormStepNavigationProps {}

export function WorkFormSteps({
  activeStep,
  focusArea,
  isLastStep,
  isSeriesWork,
  onInputChange,
  onNextStep,
  onPreviousStep,
  onRatingChange,
  onSeriesWorkChange,
  onStatusChange,
  onStepClick,
  onTextListChange,
  onTypeChange,
  organizationContributorSuggestions = [],
  personContributorSuggestions = [],
  reviewInputRef,
  reviewSectionRef,
  seriesSuggestions = [],
  shortReviewInputRef,
  tagSuggestions = [],
  titleError,
  titleInputRef,
  values,
}: WorkFormStepsProps) {
  const mediaLabels = getWorkMediaFieldLabels(values.type);
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
  const ratingValue =
    values.rating.trim() === '' ? null : Number.parseFloat(values.rating);
  const normalizedRating =
    ratingValue !== null && Number.isFinite(ratingValue) ? ratingValue : null;
  const uniqueOrganizationSuggestions = Array.from(
    new Set(organizationContributorSuggestions),
  );
  const uniquePersonSuggestions = Array.from(
    new Set(personContributorSuggestions),
  );
  const uniqueSeriesSuggestions = Array.from(new Set(seriesSuggestions));
  const uniqueTagSuggestions = Array.from(
    new Set([...tagSuggestions, ...WEB_NOVEL_KEYWORDS]),
  );
  const shouldShowStudioField =
    mediaLabels.showStudioField || studioValues.length > 0;

  return (
    <SectionCard gap="lg" padding="xl" tone="default">
      <Stack gap="lg">
        <Stack gap={6}>
          <Text c="archive.2" fw={800} size="xs" tt="uppercase">
            단계별 기록
          </Text>
          <Title order={2}>작품을 바로 남기기</Title>
          <Text c="dimmed">
            기본 정보를 먼저 잡고, 감상 기록은 다음 단계에서 편하게
            정리합니다.
          </Text>
        </Stack>

        <Stepper active={activeStep} onStepClick={onStepClick}>
          <Stepper.Step description="제목, 표지, 분류" label="기본 정보">
            <WorkFormBasicInfoStep
              genreValues={genreValues}
              onInputChange={onInputChange}
              onStatusChange={onStatusChange}
              onTextListChange={onTextListChange}
              onTypeChange={onTypeChange}
              titleError={titleError}
              values={values}
              {...(titleInputRef ? { titleInputRef } : {})}
            />
          </Stepper.Step>

          <Stepper.Step description="시리즈, 세계관" label="시리즈 / 관계">
            <WorkFormSeriesRelationStep
              isSeriesWork={isSeriesWork}
              mediaLabels={mediaLabels}
              onSeriesWorkChange={onSeriesWorkChange}
              onTextListChange={onTextListChange}
              seriesValues={seriesValues}
              uniqueSeriesSuggestions={uniqueSeriesSuggestions}
              universeValues={universeValues}
            />
          </Stepper.Step>

          <Stepper.Step description="매체별 제작 정보" label="제작진">
            <WorkFormContributorStep
              creatorValues={creatorValues}
              mediaLabels={mediaLabels}
              onTextListChange={onTextListChange}
              platformValues={platformValues}
              publisherValues={publisherValues}
              shouldShowStudioField={shouldShowStudioField}
              studioValues={studioValues}
              uniqueOrganizationSuggestions={uniqueOrganizationSuggestions}
              uniquePersonSuggestions={uniquePersonSuggestions}
            />
          </Stepper.Step>

          <Stepper.Step description="평점과 감상" label="감상 기록">
            <WorkFormReviewStep
              focusArea={focusArea}
              normalizedRating={normalizedRating}
              onInputChange={onInputChange}
              onRatingChange={onRatingChange}
              onTextListChange={onTextListChange}
              personalTagValues={personalTagValues}
              reviewInputRef={reviewInputRef}
              reviewSectionRef={reviewSectionRef}
              shortReviewInputRef={shortReviewInputRef}
              uniqueTagSuggestions={uniqueTagSuggestions}
              values={values}
            />
          </Stepper.Step>
        </Stepper>

        <ActionRow justify="space-between">
          <AppButton
            disabled={activeStep === 0}
            onClick={onPreviousStep}
            tone="secondary"
            type="button"
          >
            이전
          </AppButton>
          <AppButton onClick={onNextStep} tone="secondary" type="button">
            {isLastStep ? '처음으로' : '다음'}
          </AppButton>
        </ActionRow>
      </Stack>
    </SectionCard>
  );
}
