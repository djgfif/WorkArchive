import { Group, Paper, Stack, Text, Title } from '@mantine/core';

import { useAppTranslation } from '@app/i18n';
import {
  ActionRow,
  AppBadge,
  MetricPill,
} from '@shared/components/AppPrimitives';
import { RatingDisplay, WorkPoster } from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';
import type { WorkFormValuesProps } from './add-work-form.types';
import {
  getDisplayAuthorFromWorkFormValues,
  parseCommaSeparatedTextList,
} from '../utils/work-form';
import { getWorkStatusLabel, getWorkTypeLabel } from '../utils/work-options';
import { normalizeWorkGenres } from '../utils/work-genres';
import { cn } from '@shared/utils/class-names';

const css = styles;

export function WorkFormPreview({ values }: WorkFormValuesProps) {
  const { t } = useAppTranslation();
  const previewTitle = values.title.trim() || t('works.form.previewUntitled');
  const posterUrl = values.thumbnailUrl.trim();
  const ratingValue =
    values.rating.trim() === '' ? null : Number.parseFloat(values.rating);
  const normalizedRating =
    ratingValue !== null && Number.isFinite(ratingValue) ? ratingValue : null;
  const genreValues = normalizeWorkGenres(
    parseCommaSeparatedTextList(values.genresText),
  );
  const personalTagValues = parseCommaSeparatedTextList(
    values.personalTagsText,
  );
  const previewTags = [...genreValues, ...personalTagValues].slice(0, 3);
  const shortReviewLength = values.shortReview.trim().length;
  const reviewLength = values.review.trim().length;

  return (
    <Paper
      className={cn(css.quickCapturePreview)}
      p="lg"
      radius="lg"
      shadow="md"
      withBorder
    >
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
            {values.favorite && (
              <AppBadge tone="accent">{t('works.form.favorite')}</AppBadge>
            )}
          </Group>

          <div>
            <Title order={3}>{previewTitle}</Title>
            <Text c="dimmed">
              {getDisplayAuthorFromWorkFormValues(values) ||
                t('works.form.creatorMissing')}
            </Text>
          </div>

          <RatingDisplay value={normalizedRating} />

          <Text c="dimmed">
            {values.shortReview.trim() ||
              values.description.trim() ||
              t('works.form.previewDescriptionFallback')}
          </Text>

          <ActionRow>
            {previewTags.length > 0 ? (
              previewTags.map((tag) => <AppBadge key={tag}>{tag}</AppBadge>)
            ) : (
              <AppBadge tone="muted">{t('works.form.noCategory')}</AppBadge>
            )}
          </ActionRow>

          <MetricPill
            label={t('works.form.previewReviewLengthLabel')}
            value={
              reviewLength > 0
                ? t('works.form.previewReviewLengthDetail', {
                    count: reviewLength,
                  })
                : shortReviewLength > 0
                  ? t('works.form.previewReviewLengthShort', {
                      count: shortReviewLength,
                    })
                  : t('works.form.previewReviewLengthEmpty')
            }
          />
        </Stack>
      </Stack>
    </Paper>
  );
}
