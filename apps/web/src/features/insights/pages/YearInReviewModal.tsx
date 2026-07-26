import { useRef, useState } from 'react';
import { Box, Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { toPng } from 'html-to-image';

import { useAppTranslation } from '@app/i18n';
import { getWorkTypeLabel } from '@features/works';
import { cn } from '@shared/utils/class-names';
import { downloadUrl } from '@shared/utils/download-file';
import { useYearInReview } from '../hooks/useYearInReview';
import styles from './YearInReviewModal.module.css';

const css = styles;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text className={cn(css.statValue)}>{value}</Text>
      <Text className={cn(css.statLabel)}>{label}</Text>
    </Stack>
  );
}

function formatSigned(value: number, fractionDigits = 0) {
  const formatted = value.toFixed(fractionDigits);
  return value > 0 ? '+' + formatted : formatted;
}

interface YearInReviewModalProps {
  onClose: () => void;
  opened: boolean;
  year?: number;
}

export function YearInReviewModal({
  onClose,
  opened,
  year: initialYear = new Date().getFullYear(),
}: YearInReviewModalProps) {
  const { t } = useAppTranslation();
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const { availableYears, comparison, data, isLoading } =
    useYearInReview(selectedYear);
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const reviewYear = data?.year ?? selectedYear;
  const monthlyMax = Math.max(1, ...(data?.monthlyCompletedCounts ?? []));

  async function handleExport() {
    if (!cardRef.current) {
      return;
    }

    try {
      setExporting(true);
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: '#0a0a0c',
        cacheBust: true,
        pixelRatio: 2,
      });
      downloadUrl(
        t('insights.year.exportFileName', { year: reviewYear }),
        dataUrl,
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      opened={opened}
      radius="lg"
      size="md"
      title={t('insights.year.modalTitle', { year: reviewYear })}
    >
      {isLoading || !data ? (
        <Text c="dimmed" p="md" size="sm">
          {t('insights.year.loading')}
        </Text>
      ) : data.completedCount === 0 ? (
        <Text c="dimmed" p="md" size="sm">
          {t('insights.year.empty', { year: reviewYear })}
        </Text>
      ) : (
        <Stack gap="md">
          {availableYears.length > 1 ? (
            <Select
              allowDeselect={false}
              aria-label={t('insights.year.selectYear')}
              data={availableYears.map((availableYear) => ({
                label: String(availableYear),
                value: String(availableYear),
              }))}
              onChange={(value) => {
                if (value) {
                  setSelectedYear(Number(value));
                }
              }}
              value={String(reviewYear)}
            />
          ) : null}

          <Box className={cn(css.card)} ref={cardRef}>
            <Text className={cn(css.eyebrow)}>YEAR IN REVIEW</Text>
            <Text className={cn(css.year)}>{data.year}</Text>

            <Box className={cn(css.heroStat)}>
              <Text className={cn(css.heroNumber)}>{data.completedCount}</Text>
              <Text className={cn(css.heroLabel)}>
                {t('insights.year.completed')}
              </Text>
            </Box>

            <Group className={cn(css.subStats)} gap="xl">
              <Stat
                label={t('insights.year.averageRating')}
                value={
                  data.averageRating !== null
                    ? `★ ${data.averageRating.toFixed(1)}`
                    : '—'
                }
              />
              {data.topGenre && (
                <Stat
                  label={t('insights.year.topGenre')}
                  value={data.topGenre.genre}
                />
              )}
              {data.busiestMonth && (
                <Stat
                  label={t('insights.year.busiestMonth')}
                  value={t('insights.year.month', {
                    month: data.busiestMonth.month,
                  })}
                />
              )}
            </Group>

            <Box className={cn(css.monthlySection)}>
              <Text className={cn(css.sectionTitle)}>
                {t('insights.year.monthlyActivity')}
              </Text>
              <Box className={cn(css.monthlyChart)}>
                {data.monthlyCompletedCounts.map((count, index) => (
                  <Box
                    aria-label={t('insights.year.monthCount', {
                      count,
                      month: index + 1,
                    })}
                    className={cn(css.monthColumn)}
                    key={index}
                  >
                    <Box className={cn(css.monthBarTrack)}>
                      <Box
                        className={cn(css.monthBar)}
                        data-empty={count === 0}
                        style={{
                          height: String((count / monthlyMax) * 100) + '%',
                        }}
                      />
                    </Box>
                    <Text className={cn(css.monthLabel)}>{index + 1}</Text>
                  </Box>
                ))}
              </Box>
            </Box>

            {comparison ? (
              <Box className={cn(css.comparison)}>
                <Text className={cn(css.sectionTitle)}>
                  {t('insights.year.comparisonTitle')}
                </Text>
                <Text className={cn(css.comparisonText)}>
                  {t('insights.year.comparisonCompleted', {
                    count: comparison.previous.completedCount,
                    delta: formatSigned(comparison.completedDelta),
                    year: comparison.previous.year,
                  })}
                </Text>
                {comparison.averageRatingDelta !== null &&
                data.averageRating !== null ? (
                  <Text className={cn(css.comparisonMeta)}>
                    {t('insights.year.comparisonRating', {
                      delta: formatSigned(comparison.averageRatingDelta, 1),
                      rating: data.averageRating.toFixed(1),
                    })}
                  </Text>
                ) : null}
              </Box>
            ) : null}

            {data.topWorks.length > 0 && (
              <Box className={cn(css.section)}>
                <Text className={cn(css.sectionTitle)}>
                  {t('insights.year.topWorks')}
                </Text>
                <Stack gap={7}>
                  {data.topWorks.map((work, index) => (
                    <Group justify="space-between" key={work.id} wrap="nowrap">
                      <Group gap={8} miw={0} wrap="nowrap">
                        <Text className={cn(css.rank)}>{index + 1}</Text>
                        <Text className={cn(css.workTitle)} truncate>
                          {work.title}
                        </Text>
                      </Group>
                      {work.rating !== null && (
                        <Text className={cn(css.workRating)}>
                          ★ {work.rating.toFixed(1)}
                        </Text>
                      )}
                    </Group>
                  ))}
                </Stack>
              </Box>
            )}

            {data.typeBreakdown.length > 0 && (
              <Group className={cn(css.typeRow)} gap={6}>
                {data.typeBreakdown.map((entry) => (
                  <Text className={cn(css.typeChip)} key={entry.type}>
                    {getWorkTypeLabel(entry.type)} {entry.count}
                  </Text>
                ))}
              </Group>
            )}

            <Text className={cn(css.brand)}>WORK ARCHIVE</Text>
          </Box>

          <Group justify="flex-end">
            <Button color="gray" onClick={onClose} variant="default">
              {t('insights.year.close')}
            </Button>
            <Button loading={exporting} onClick={() => void handleExport()}>
              {t('insights.year.download')}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
