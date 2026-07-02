import type { WorkRecord } from '@work-archive/shared-types';
import { Box, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';

import { useAppTranslation } from '@app/i18n';
import { AppButton } from '@shared/components/AppPrimitives';
import type { LibraryDensity } from '../hooks/useLibraryDensity';
import { WorkPosterCard } from './ArchiveComponents';
import styles from './ArchiveComponents.module.css';
import {
  WorkListRow,
  type WorkQuickProgressUpdate,
  type WorkQuickUpdate,
} from './WorkListRow';

export type WorksViewMode = 'grid' | 'list';

const GRID_COLS: Record<
  LibraryDensity,
  { base: number; sm: number; md: number; lg: number; xl: number }
> = {
  comfortable: { base: 2, sm: 3, md: 4, lg: 5, xl: 6 },
  compact: { base: 3, sm: 4, md: 6, lg: 8, xl: 10 },
};

const GRID_RENDER_LIMIT = 60;
const LIST_RENDER_LIMIT = 40;
const RENDER_INCREMENT = 40;
const css = styles;

interface WorksListProps {
  density?: LibraryDensity;
  onDelete: (work: WorkRecord) => Promise<void>;
  onQuickProgressUpdate: (
    work: WorkRecord,
    update: WorkQuickProgressUpdate,
  ) => Promise<void>;
  onQuickUpdate: (work: WorkRecord, update: WorkQuickUpdate) => Promise<void>;
  updatingWorkId: string | null;
  viewMode: WorksViewMode;
  works: WorkRecord[];
}

export function WorksList({
  density = 'comfortable',
  onDelete,
  onQuickProgressUpdate,
  onQuickUpdate,
  updatingWorkId,
  viewMode,
  works,
}: WorksListProps) {
  const { t } = useAppTranslation();
  const renderLimit =
    viewMode === 'grid' ? GRID_RENDER_LIMIT : LIST_RENDER_LIMIT;
  const workListSignature = useMemo(
    () => works.map((work) => work.id).join('|'),
    [works],
  );
  const [visibleCount, setVisibleCount] = useState(renderLimit);
  const visibleWorks = useMemo(
    () => works.slice(0, visibleCount),
    [visibleCount, works],
  );
  const hasHiddenWorks = visibleWorks.length < works.length;

  useEffect(() => {
    setVisibleCount(renderLimit);
  }, [renderLimit, workListSignature]);

  function handleShowMore() {
    setVisibleCount((currentCount) =>
      Math.min(currentCount + RENDER_INCREMENT, works.length),
    );
  }

  const renderProgress =
    works.length > renderLimit ? (
      <Paper className={css.loadMoreControl ?? ''} withBorder>
        <Group justify="space-between" wrap="wrap">
          <Stack gap={4}>
            <Text fw={800}>
              {t('works.list.loadMoreProgress', {
                total: works.length,
                visible: visibleWorks.length,
              })}
            </Text>
            <Text c="dimmed" size="sm">
              {t('works.list.loadMoreDescription')}
            </Text>
          </Stack>
          {hasHiddenWorks && (
            <AppButton
              aria-label={t('works.list.loadMoreAria', {
                count: Math.min(
                  RENDER_INCREMENT,
                  works.length - visibleWorks.length,
                ),
              })}
              onClick={handleShowMore}
              tone="secondary"
              type="button"
            >
              {t('works.list.loadMore')}
            </AppButton>
          )}
        </Group>
      </Paper>
    ) : null;

  if (viewMode === 'grid') {
    return (
      <Stack
        aria-label={t('works.list.sectionPosterAria')}
        component="section"
        gap="xl"
      >
        <SimpleGrid
          cols={GRID_COLS[density]}
          spacing={{ base: 'sm', md: 'md' }}
          verticalSpacing={{ base: 'md', md: 'lg' }}
        >
          {visibleWorks.map((work) => (
            <Box className={css.gridItemSlot ?? ''} key={work.id}>
              <WorkPosterCard
                isUpdating={updatingWorkId === work.id}
                work={work}
              />
            </Box>
          ))}
        </SimpleGrid>
        {renderProgress}
      </Stack>
    );
  }

  return (
    <section
      aria-label={t('works.list.sectionListAria')}
      className={css.listSection ?? ''}
    >
      <Stack gap={0}>
        {visibleWorks.map((work, index) => (
          <Box key={work.id}>
            <WorkListRow
              index={index}
              isLast={index === visibleWorks.length - 1}
              isUpdating={updatingWorkId === work.id}
              onDelete={onDelete}
              onQuickProgressUpdate={onQuickProgressUpdate}
              onQuickUpdate={onQuickUpdate}
              work={work}
            />
          </Box>
        ))}
      </Stack>
      {renderProgress}
    </section>
  );
}
