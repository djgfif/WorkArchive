import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useForm } from '@mantine/form';
import { Grid, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod/v4';

import { useAppTranslation } from '@app/i18n';
import { FeedbackMessage } from '@shared/components/AppPrimitives';
import {
  createDefaultWorkFormValues,
  formatTextListForWorkForm,
  parseWorkFormValues,
  type UpsertWorkInput,
  type WorkFormValues,
} from '../utils/work-form';
import { DuplicateWorkCandidatesCard } from './DuplicateWorkCandidatesCard';
import { useDuplicateWorkCandidates } from '../hooks/useDuplicateWorkCandidates';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import { useWorkFormDraft } from '../hooks/useWorkFormDraft';
import {
  type WorkFormInputChangeHandler,
  type WorkFormListFieldName,
} from './add-work-form.types';
import {
  WorkFormDraftNotice,
  WorkFormMobileSaveAffix,
  WorkFormSubmitActions,
} from './WorkFormSubmitControls';
import { WorkFormPreview } from './WorkFormPreview';
import { WorkFormSteps } from './WorkFormSteps';

const REQUIRED_TITLE_MESSAGE = 'Title is required.';
const RATING_RANGE_MESSAGE = 'Rating must be between 0 and 5.';
const REVIEW_STEP_INDEX = 3;
const LAST_STEP_INDEX = 3;

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
        Number.isFinite(parsedRating) && parsedRating >= 0 && parsedRating <= 5
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
  const { t } = useAppTranslation();
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
      nextValues.seriesText.trim() !== '' ||
        nextValues.universeText.trim() !== '',
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

  function handleRatingChange(newRating: number | null) {
    form.setFieldValue('rating', newRating !== null ? String(newRating) : '');
  }
  const shortReviewLength = values.shortReview.trim().length;
  const reviewLength = values.review.trim().length;
  const submitButtonLabel = isSubmitting ? t('works.form.saving') : submitLabel;
  const mobileActionSummary = values.title.trim()
    ? t('works.form.mobileReady', { title: values.title.trim() })
    : t('works.form.mobileTitleMissing');
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

  const handleInputChange: WorkFormInputChangeHandler = (event) => {
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
  };

  function handleTypeChange(type: WorkFormValues['type']) {
    form.setFieldValue('type', type);
  }

  function handleStatusChange(status: WorkFormValues['status']) {
    form.setFieldValue('status', status);
  }

  function handleSeriesWorkChange(isEnabled: boolean) {
    setIsSeriesWork(isEnabled);

    if (!isEnabled) {
      form.setFieldValue('seriesText', '');
      form.setFieldValue('universeText', '');
    }
  }

  function handleTextListChange(name: WorkFormListFieldName, items: string[]) {
    form.setFieldValue(name, formatTextListForWorkForm(items));
  }

  function handlePreviousStep() {
    setActiveStep((currentStep) => Math.max(0, currentStep - 1));
  }

  function handleNextStep() {
    setActiveStep((currentStep) =>
      currentStep >= LAST_STEP_INDEX ? 0 : currentStep + 1,
    );
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
          typeof firstError === 'string' ? firstError : REQUIRED_TITLE_MESSAGE,
        );

        if (validation.errors.title) {
          titleInputRef.current?.focus();
        }
        return;
      }

      if (!values.title.trim()) {
        const message = t('works.form.titleRequired');

        setTitleError(message);
        setValidationError(message);
        titleInputRef.current?.focus();
        return;
      }

      await onSubmit(parseWorkFormValues(values));
      draft.clearDraft();
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : t('works.form.saveError'),
      );
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {draft.pendingDraft && (
        <WorkFormDraftNotice
          onApplyDraft={draft.applyDraft}
          onClearDraft={draft.clearDraft}
        />
      )}
      <Grid align="start" gap="xl">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="xl">
            <WorkFormSteps
              activeStep={activeStep}
              focusArea={focusArea}
              isLastStep={activeStep >= LAST_STEP_INDEX}
              isSeriesWork={isSeriesWork}
              onInputChange={handleInputChange}
              onNextStep={handleNextStep}
              onPreviousStep={handlePreviousStep}
              onRatingChange={handleRatingChange}
              onSeriesWorkChange={handleSeriesWorkChange}
              onStatusChange={handleStatusChange}
              onStepClick={setActiveStep}
              onTextListChange={handleTextListChange}
              onTypeChange={handleTypeChange}
              organizationContributorSuggestions={
                organizationContributorSuggestions
              }
              personContributorSuggestions={personContributorSuggestions}
              reviewInputRef={reviewInputRef}
              reviewSectionRef={reviewSectionRef}
              seriesSuggestions={seriesSuggestions}
              shortReviewInputRef={shortReviewInputRef}
              tagSuggestions={tagSuggestions}
              titleError={form.errors.title ?? titleError}
              titleInputRef={titleInputRef}
              values={values}
            />

            <DuplicateWorkCandidatesCard candidates={duplicateCandidates} />

            {(validationError || submitError) && (
              <FeedbackMessage tone="error">
                {validationError ?? submitError}
              </FeedbackMessage>
            )}

            <WorkFormSubmitActions
              cancelTo={cancelTo}
              isSubmitting={isSubmitting}
              saveStatus={draft.saveStatus}
              submitButtonLabel={submitButtonLabel}
            />
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <WorkFormPreview values={values} />
        </Grid.Col>
      </Grid>

      <WorkFormMobileSaveAffix
        cancelTo={cancelTo}
        isSubmitting={isSubmitting}
        mobileActionSummary={mobileActionSummary}
        saveStatus={draft.saveStatus}
        submitButtonLabel={submitButtonLabel}
        submitLabel={submitLabel}
      />
    </form>
  );
}
