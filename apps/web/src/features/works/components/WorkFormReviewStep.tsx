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
  return (
    <Box ref={reviewSectionRef}>
      <Stack gap="md" pt="md">
        {focusArea === 'review' && (
          <FeedbackMessage title="리뷰 집중 모드" tone="info">
            <span id={REVIEW_FOCUS_DESCRIPTION_ID}>
              한줄평과 상세 감상 입력으로 바로 이동했습니다. 저장하면 상세
              화면의 개인 감상 기록으로 돌아갑니다.
            </span>
          </FeedbackMessage>
        )}

        <Textarea
          aria-describedby={
            focusArea === 'review' ? REVIEW_FOCUS_DESCRIPTION_ID : undefined
          }
          description={
            focusArea === 'review'
              ? '상세 화면에서 이어 온 리뷰 집중 수정 입력입니다.'
              : undefined
          }
          id="shortReview"
          label="한 줄 감상"
          name="shortReview"
          onChange={onInputChange}
          placeholder="목록과 상세 상단에 남길 짧은 감상"
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
              ? '한줄평보다 길게 남기는 개인 감상 입력입니다.'
              : undefined
          }
          id="review"
          label="상세 감상"
          name="review"
          onChange={onInputChange}
          placeholder="길게 남기고 싶은 장면, 인상, 생각"
          ref={reviewInputRef}
          rows={8}
          value={values.review}
        />
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <StarRatingInput
            label="고급별점"
            onChange={onRatingChange}
            value={normalizedRating}
          />
          <Textarea
            id="description"
            label="작품 메모"
            name="description"
            onChange={onInputChange}
            placeholder="줄거리나 기억해둘 배경"
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
            onChange={(items) => onTextListChange('personalTagsText', items)}
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
