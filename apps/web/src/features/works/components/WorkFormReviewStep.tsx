import type { RefObject } from 'react';
import {
  Box,
  Group,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  Textarea,
} from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
import { FeedbackMessage } from '@shared/components/AppPrimitives';
import { StarRatingInput } from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';
import {
  type WorkFormInputChangeHandler,
  type WorkFormListFieldName,
} from './add-work-form.types';
import type { WorkFormValues } from '../utils/work-form';

const REVIEW_FOCUS_DESCRIPTION_ID = 'work-form-review-focus-description';
const css = styles;

interface WorkFormReviewStepProps {
  focusArea: 'general' | 'review';
  normalizedRating: number | null;
  onInputChange: WorkFormInputChangeHandler;
  onRatingChange: (rating: number | null) => void;
  onTextListChange: (name: WorkFormListFieldName, values: string[]) => void;
  personalTagValues: string[];
  reviewInputRef: RefObject<HTMLTextAreaElement | null>;
  reviewSectionRef: RefObject<HTMLDivElement | null>;
  shortReviewInputRef: RefObject<HTMLTextAreaElement | null>;
  uniqueTagSuggestions: string[];
  values: WorkFormValues;
}

export function WorkFormReviewStep({
  focusArea,
  normalizedRating,
  onInputChange,
  onRatingChange,
  onTextListChange,
  personalTagValues,
  reviewInputRef,
  reviewSectionRef,
  shortReviewInputRef,
  uniqueTagSuggestions,
  values,
}: WorkFormReviewStepProps) {
  const { t } = useAppTranslation();

  return (
    <Box ref={reviewSectionRef}>
      <Stack gap="md" pt="md">
        {focusArea === 'review' && (
          <FeedbackMessage title={t('works.form.reviewFocusTitle')} tone="info">
            <span id={REVIEW_FOCUS_DESCRIPTION_ID}>
              {t('works.form.reviewFocusDescription')}
            </span>
          </FeedbackMessage>
        )}

        <Textarea
          aria-describedby={
            focusArea === 'review' ? REVIEW_FOCUS_DESCRIPTION_ID : undefined
          }
          description={
            focusArea === 'review'
              ? t('works.form.shortReviewDescription')
              : undefined
          }
          id="shortReview"
          label={t('works.form.reviewShortLabel')}
          name="shortReview"
          onChange={onInputChange}
          placeholder={t('works.form.reviewShortPlaceholder')}
          ref={shortReviewInputRef}
          rows={3}
          value={values.shortReview}
        />

        <Textarea
          aria-describedby={
            focusArea === 'review' ? REVIEW_FOCUS_DESCRIPTION_ID : undefined
          }
          description={
            focusArea === 'review'
              ? t('works.form.reviewInputDescription')
              : undefined
          }
          id="review"
          label={t('works.form.reviewInputLabel')}
          name="review"
          onChange={onInputChange}
          placeholder={t('works.form.reviewInputPlaceholder')}
          ref={reviewInputRef}
          rows={8}
          value={values.review}
        />
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <StarRatingInput
            label={t('works.form.advancedRatingLabel')}
            onChange={onRatingChange}
            value={normalizedRating}
          />
          <Textarea
            id="description"
            label={t('works.form.workMemoLabel')}
            name="description"
            onChange={onInputChange}
            placeholder={t('works.form.workMemoPlaceholder')}
            rows={4}
            value={values.description}
          />
        </SimpleGrid>

        <Stack gap="xs">
          <Text
            fw={600}
            size="sm"
            style={{ color: 'var(--app-text-secondary)' }}
          >
            {t('works.form.personalTagsLabel')}
            <Text component="span" c="dimmed" fw={400} size="xs" ml={6}>
              {t('works.form.personalTagsHint')}
            </Text>
          </Text>
          <TagsInput
            clearable
            data={uniqueTagSuggestions}
            id="personalTagsText"
            name="personalTagsText"
            onChange={(items) => onTextListChange('personalTagsText', items)}
            placeholder={t('works.form.personalTagsPlaceholder')}
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
                background:
                  'color-mix(in srgb, var(--app-accent-secondary) 14%, transparent)',
                border:
                  '1px solid color-mix(in srgb, var(--app-accent-secondary) 30%, transparent)',
                borderRadius: 6,
                color: 'var(--app-accent-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600,
              },
            }}
          />
          <Group gap={4}>
            {uniqueTagSuggestions.slice(0, 12).map((tag) => {
              const isSelected = personalTagValues.includes(tag);

              return (
                <button
                  aria-pressed={isSelected}
                  className={css.filterPill}
                  key={tag}
                  onClick={() => {
                    if (!isSelected) {
                      onTextListChange('personalTagsText', [
                        ...personalTagValues,
                        tag,
                      ]);
                    }
                  }}
                  style={{
                    background: isSelected
                      ? 'color-mix(in srgb, var(--app-accent-secondary) 18%, transparent)'
                      : 'var(--app-surface-subtle)',
                    border: isSelected
                      ? '1.5px solid color-mix(in srgb, var(--app-accent-secondary) 40%, transparent)'
                      : '1.5px solid var(--app-border-default)',
                    borderRadius: 20,
                    color: isSelected
                      ? 'var(--app-accent-secondary)'
                      : 'var(--app-text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    padding: '3px 10px',
                  }}
                  type="button"
                >
                  {isSelected ? '✓ ' : '+ '}
                  {tag}
                </button>
              );
            })}
          </Group>
        </Stack>
      </Stack>
    </Box>
  );
}
