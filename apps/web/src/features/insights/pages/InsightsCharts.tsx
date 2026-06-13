import { Box, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { WorkType } from '@work-archive/shared-types';

import { getWorkTypeLabel } from '@features/works';
import { formatAppNumber, useAppTranslation } from '@app/i18n';
import styles from './PersonalInsightsPage.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

/* ── 별점 히스토그램 — 0.5~5.0 세로 막대 (AniList 점수 분포 패턴) ─────────── */
const RATING_BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export function RatingHistogramPanel({
  distribution,
}: {
  distribution: Array<{ count: number; rating: number }>;
}) {
  const { t } = useAppTranslation();
  const countByRating = new Map(
    distribution.map((entry) => [entry.rating, entry.count]),
  );
  const max = Math.max(1, ...distribution.map((entry) => entry.count));
  const hasData = distribution.some((entry) => entry.count > 0);

  return (
    <Paper className={cn(css.chartPanel)} p="lg" radius="md" withBorder>
      <Stack gap="md">
        <Title order={3}>{t('insights.charts.ratingTitle')}</Title>
        {hasData ? (
          <Box className={cn(css.histogram)}>
            {RATING_BUCKETS.map((rating) => {
              const count = countByRating.get(rating) ?? 0;
              const heightPct = (count / max) * 100;

              return (
                <Link
                  aria-label={t('insights.charts.ratingAria', {
                    count: formatAppNumber(count),
                    rating: rating.toFixed(1),
                  })}
                  className={cn(css.histColumn)}
                  key={rating}
                  to={`/works?rating=${encodeURIComponent(String(rating))}`}
                >
                  <Text className={cn(css.histCount)}>
                    {count > 0 ? count : ''}
                  </Text>
                  <Box aria-hidden="true" className={cn(css.histBarWrap)}>
                    <Box
                      className={cn(css.histBar)}
                      data-empty={count === 0 ? 'true' : undefined}
                      style={{ height: `${heightPct}%` }}
                    />
                  </Box>
                  <Text className={cn(css.histLabel)}>{rating.toFixed(1)}</Text>
                </Link>
              );
            })}
          </Box>
        ) : (
          <Text c="dimmed" size="sm">
            {t('insights.charts.ratingEmpty')}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

/* ── 매체 비율 도넛 ──────────────────────────────────────────────────────── */
const TYPE_COLORS: Record<WorkType, string> = {
  web_novel: '#c8922e',
  webtoon: '#5b9cf6',
  manga: '#e0b85a',
  novel: '#b07b3e',
  light_novel: '#d9a441',
  anime: '#a78bfa',
  movie: '#fb7185',
  drama: '#2dd4bf',
  other: '#8c7a6e',
};

export function MediaTypePanel({
  total,
  typeCounts,
}: {
  total: number;
  typeCounts: Record<WorkType, number>;
}) {
  const { t } = useAppTranslation();
  const entries = (Object.entries(typeCounts) as Array<[WorkType, number]>)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1]);
  const size = 132;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <Paper className={cn(css.chartPanel)} p="lg" radius="md" withBorder>
      <Stack gap="md">
        <Title order={3}>{t('insights.charts.mediaTitle')}</Title>
        {total > 0 ? (
          <Group align="center" gap="xl" wrap="wrap">
            <Box
              className={cn(css.donutWrap)}
              style={{ height: size, width: size }}
            >
              <svg
                aria-label={t('insights.charts.mediaAria')}
                height={size}
                role="img"
                viewBox={`0 0 ${size} ${size}`}
                width={size}
              >
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  fill="none"
                  r={radius}
                  stroke="var(--app-surface-subtle)"
                  strokeWidth={stroke}
                />
                {entries.map(([type, count]) => {
                  const segment = (count / total) * circumference;
                  const element = (
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      fill="none"
                      key={type}
                      r={radius}
                      stroke={TYPE_COLORS[type]}
                      strokeDasharray={`${segment} ${circumference - segment}`}
                      strokeDashoffset={-accumulated}
                      strokeWidth={stroke}
                      transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    />
                  );
                  accumulated += segment;

                  return element;
                })}
              </svg>
              <Box className={cn(css.donutCenter)}>
                <Text className={cn(css.donutTotal)}>
                  {formatAppNumber(total)}
                </Text>
                <Text className={cn(css.donutTotalLabel)}>
                  {t('insights.charts.workCountLabel')}
                </Text>
              </Box>
            </Box>
            <Stack flex={1} gap={4} miw={140}>
              {entries.map(([type, count]) => (
                <Link
                  aria-label={t('insights.countLabel', {
                    count: formatAppNumber(count),
                    value: getWorkTypeLabel(type),
                  })}
                  className={cn(css.legendRow)}
                  key={type}
                  to={`/works?type=${encodeURIComponent(type)}`}
                >
                  <Box
                    aria-hidden="true"
                    className={cn(css.legendSwatch)}
                    style={{ background: TYPE_COLORS[type] }}
                  />
                  <Text className={cn(css.legendLabel)}>
                    {getWorkTypeLabel(type)}
                  </Text>
                  <Text className={cn(css.legendValue)}>
                    {formatAppNumber(count)} ·{' '}
                    {Math.round((count / total) * 100)}%
                  </Text>
                </Link>
              ))}
            </Stack>
          </Group>
        ) : (
          <Text c="dimmed" size="sm">
            {t('insights.charts.mediaEmpty')}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
