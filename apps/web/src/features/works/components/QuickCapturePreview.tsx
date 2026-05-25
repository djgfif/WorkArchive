import { Paper, Stack, Text, Title } from '@mantine/core';

import { ActionRow, AppBadge } from '@shared/components/AppPrimitives';
import { WorkPoster } from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';
import {
  getDisplayAuthorFromWorkFormValues,
  parseCommaSeparatedTextList,
  type WorkFormValues,
} from '../utils/work-form';
import { workStatusOptions, workTypeOptions } from '../utils/work-options';

const css = styles as Record<string, string>;

function cn(value: string | undefined) {
  return value ?? '';
}

interface QuickCapturePreviewProps {
  duplicateCount?: number;
  sourceLabel?: string | null;
  values: WorkFormValues;
}

function getPreviewChips(values: WorkFormValues, sourceLabel?: string | null) {
  const genres = parseCommaSeparatedTextList(values.genresText);
  const personalTags = parseCommaSeparatedTextList(values.personalTagsText);
  const relations = [
    ...parseCommaSeparatedTextList(values.seriesText),
    ...parseCommaSeparatedTextList(values.universeText),
  ];
  const creatorSummary = getDisplayAuthorFromWorkFormValues(values);
  const chips = [
    genres[0] ? `대표 장르 ${genres[0]}` : null,
    personalTags[0] ? `개인 태그 ${personalTags[0]}` : null,
    relations[0] ? `관계 ${relations[0]}` : null,
    creatorSummary ? `제작 ${creatorSummary}` : null,
    sourceLabel ? `검색 출처 ${sourceLabel}` : '직접 입력',
  ].filter(Boolean) as string[];

  return chips.slice(0, 5);
}

export function QuickCapturePreview({
  duplicateCount = 0,
  sourceLabel = null,
  values,
}: QuickCapturePreviewProps) {
  const previewTitle = values.title.trim() || '제목 없는 작품';
  const typeLabel =
    workTypeOptions.find((option) => option.value === values.type)?.label ??
    '작품';
  const statusLabel =
    workStatusOptions.find((option) => option.value === values.status)?.label ??
    '기록';
  const shortReview = values.shortReview.trim();
  const chips = getPreviewChips(values, sourceLabel);

  return (
    <Paper className={cn(css.quickCapturePreview)} withBorder>
      <Stack gap="lg">
        <WorkPoster
          coverSeed={`quick:${values.type}:${previewTitle}`}
          thumbnailUrl={values.thumbnailUrl}
          title={previewTitle}
          typeLabel={typeLabel}
          variant="form"
        />
        <Stack gap="sm">
          <ActionRow justify="space-between">
            <Text c="var(--mantine-color-dimmed)" fw={800} size="xs">
              저장 전 미리보기
            </Text>
            {duplicateCount > 0 && (
              <AppBadge tone="warning">기존 기록 확인 필요</AppBadge>
            )}
          </ActionRow>
          <Title order={3}>{previewTitle}</Title>
          <Text c="var(--mantine-color-dimmed)" size="sm">
            {typeLabel} · {statusLabel}
            {values.rating
              ? ` · ★ ${Number.parseFloat(values.rating).toFixed(1)}`
              : ''}
          </Text>
          <ActionRow className={cn(css.previewChipRow)}>
            {chips.map((chip) => (
              <AppBadge key={chip} tone="muted">
                {chip}
              </AppBadge>
            ))}
          </ActionRow>
          {duplicateCount > 0 && (
            <Text c="var(--mantine-color-dimmed)" size="sm">
              비슷한 기록 {duplicateCount}개가 있습니다. 저장 전에 기존 기록을
              확인하세요.
            </Text>
          )}
          <Text c="var(--mantine-color-dimmed)" lineClamp={4}>
            {shortReview || '짧은 감상을 적지 않아도 먼저 저장할 수 있습니다.'}
          </Text>
        </Stack>
      </Stack>
    </Paper>
  );
}
