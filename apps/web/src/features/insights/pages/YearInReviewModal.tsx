import { useRef, useState } from 'react';
import { Box, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { toPng } from 'html-to-image';

import { getWorkTypeLabel } from '@features/works';
import { useYearInReview } from '../hooks/useYearInReview';
import styles from './YearInReviewModal.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text className={cn(css.statValue)}>{value}</Text>
      <Text className={cn(css.statLabel)}>{label}</Text>
    </Stack>
  );
}

interface YearInReviewModalProps {
  onClose: () => void;
  opened: boolean;
  year?: number;
}

export function YearInReviewModal({
  onClose,
  opened,
  year = new Date().getFullYear(),
}: YearInReviewModalProps) {
  const { data, isLoading } = useYearInReview(year);
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!cardRef.current) {
      return;
    }

    try {
      setExporting(true);
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: '#0c0b0a',
        cacheBust: true,
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `work-archive-${year}-결산.png`;
      link.href = dataUrl;
      link.click();
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
      title={`${year} 연말 결산`}
    >
      {isLoading || !data ? (
        <Text c="dimmed" p="md" size="sm">
          결산을 계산하는 중입니다…
        </Text>
      ) : data.completedCount === 0 ? (
        <Text c="dimmed" p="md" size="sm">
          {year}년에 완료한 작품이 아직 없습니다. 작품을 완료로 표시하면 결산이
          채워집니다.
        </Text>
      ) : (
        <Stack gap="md">
          <Box className={cn(css.card)} ref={cardRef}>
            <Text className={cn(css.eyebrow)}>YEAR IN REVIEW</Text>
            <Text className={cn(css.year)}>{data.year}</Text>

            <Box className={cn(css.heroStat)}>
              <Text className={cn(css.heroNumber)}>{data.completedCount}</Text>
              <Text className={cn(css.heroLabel)}>편 완료</Text>
            </Box>

            <Group className={cn(css.subStats)} gap="xl">
              <Stat
                label="평균 별점"
                value={
                  data.averageRating !== null
                    ? `★ ${data.averageRating.toFixed(1)}`
                    : '—'
                }
              />
              {data.topGenre && (
                <Stat label="최애 장르" value={data.topGenre.genre} />
              )}
              {data.busiestMonth && (
                <Stat
                  label="가장 바빴던 달"
                  value={`${data.busiestMonth.month}월`}
                />
              )}
            </Group>

            {data.topWorks.length > 0 && (
              <Box className={cn(css.section)}>
                <Text className={cn(css.sectionTitle)}>올해의 작품</Text>
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
              닫기
            </Button>
            <Button loading={exporting} onClick={() => void handleExport()}>
              이미지로 저장
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
