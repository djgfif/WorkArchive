import { Box } from '@mantine/core';
import type { WorkStatus } from '@work-archive/shared-types';

import { AppButton } from '@shared/components/AppPrimitives';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface WorksListPageHeaderProps {
  isLoading: boolean;
  isTrashScope: boolean;
  onAddWork: () => void;
  statusCounts: Record<WorkStatus, number>;
  totalActiveCount: number;
  totalDeletedCount: number;
}

export function WorksListPageHeader({
  isLoading,
  isTrashScope,
  onAddWork,
  statusCounts,
  totalActiveCount,
  totalDeletedCount,
}: WorksListPageHeaderProps) {
  return (
    <Box className={cn(css.libraryPageHeader)}>
      <Box>
        <Box component="h1" className={cn(css.libraryPageTitle)}>
          {isTrashScope ? '휴지통' : '작품 서재'}
        </Box>
        {!isLoading && !isTrashScope && totalActiveCount > 0 && (
          <Box className={cn(css.libraryPageMeta)}>
            <span>
              작품 <strong>{totalActiveCount}개</strong>
            </span>
            {statusCounts.in_progress > 0 && (
              <>
                <span className={cn(css.libraryPageDot)} />
                <span>
                  진행 중 <strong>{statusCounts.in_progress}개</strong>
                </span>
              </>
            )}
            {statusCounts.completed > 0 && (
              <>
                <span className={cn(css.libraryPageDot)} />
                <span>
                  완료 <strong>{statusCounts.completed}개</strong>
                </span>
              </>
            )}
            {statusCounts.planned > 0 &&
              statusCounts.in_progress === 0 &&
              statusCounts.completed === 0 && (
                <>
                  <span className={cn(css.libraryPageDot)} />
                  <span>
                    볼 예정 <strong>{statusCounts.planned}개</strong>
                  </span>
                </>
              )}
          </Box>
        )}
        {!isLoading && isTrashScope && totalDeletedCount > 0 && (
          <Box className={cn(css.libraryPageMeta)}>
            <span>
              삭제된 작품 <strong>{totalDeletedCount}개</strong>
            </span>
          </Box>
        )}
      </Box>
      {!isTrashScope && (
        <AppButton
          leftSection={<span aria-hidden="true">+</span>}
          onClick={onAddWork}
          tone="primary"
          type="button"
        >
          작품 추가
        </AppButton>
      )}
    </Box>
  );
}
