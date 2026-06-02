import { Group, Paper, Stack, Text, Title } from '@mantine/core';

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
  const previewTitle = values.title.trim() || '제목 없는 작품';
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
  );
}
