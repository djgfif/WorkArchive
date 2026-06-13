import { Box } from '@mantine/core';
import type { WorkStatus } from '@work-archive/shared-types';

import { AppButton } from '@shared/components/AppPrimitives';
import { useAppTranslation } from '@app/i18n';
import styles from './ArchiveComponents.module.css';
import { cn } from '@shared/utils/class-names';

const css = styles;

interface WorksListPageHeaderProps {
  activeStatus?: WorkStatus | 'all';
  isLoading: boolean;
  isTrashScope: boolean;
  onAddWork: () => void;
  onSelectStatus?: (status: WorkStatus | 'all') => void;
  statusCounts: Record<WorkStatus, number>;
  totalActiveCount: number;
  totalDeletedCount: number;
}

export function WorksListPageHeader({
  activeStatus,
  isLoading,
  isTrashScope,
  onAddWork,
  onSelectStatus,
  statusCounts,
  totalActiveCount,
  totalDeletedCount,
}: WorksListPageHeaderProps) {
  const { t } = useAppTranslation();
  // 카운트 세그먼트 — onSelectStatus가 있으면 클릭 시 상태 필터를 적용하는 버튼,
  // 없으면 정적 텍스트. (홈 화면 stat strip과 일관)
  const renderCount = (
    label: string,
    count: number,
    status: WorkStatus | 'all',
  ) => {
    const inner = (
      <>
        {label} <strong>{t('works.list.count', { count })}</strong>
      </>
    );

    if (!onSelectStatus) {
      return <span>{inner}</span>;
    }

    const active = activeStatus === status;

    return (
      <Box
        aria-label={t('works.list.scopeLabel', { count, label })}
        aria-pressed={active}
        className={cn(css.libraryPageMetaButton)}
        component="button"
        data-active={active ? 'true' : 'false'}
        onClick={() => onSelectStatus(status)}
        type="button"
      >
        {inner}
      </Box>
    );
  };

  return (
    <Box className={cn(css.libraryPageHeader)}>
      <Box>
        <Box component="h1" className={cn(css.libraryPageTitle)}>
          {isTrashScope
            ? t('works.list.titleTrash')
            : t('works.list.pageTitle')}
        </Box>
        {!isLoading && !isTrashScope && totalActiveCount > 0 && (
          <Box className={cn(css.libraryPageMeta)}>
            {renderCount(
              t('works.list.allWorksLabel'),
              totalActiveCount,
              'all',
            )}
            {statusCounts.in_progress > 0 && (
              <>
                <span className={cn(css.libraryPageDot)} />
                {renderCount(
                  t('works.status.in_progress'),
                  statusCounts.in_progress,
                  'in_progress',
                )}
              </>
            )}
            {statusCounts.completed > 0 && (
              <>
                <span className={cn(css.libraryPageDot)} />
                {renderCount(
                  t('works.status.completed'),
                  statusCounts.completed,
                  'completed',
                )}
              </>
            )}
            {statusCounts.planned > 0 &&
              statusCounts.in_progress === 0 &&
              statusCounts.completed === 0 && (
                <>
                  <span className={cn(css.libraryPageDot)} />
                  {renderCount(
                    t('works.status.planned'),
                    statusCounts.planned,
                    'planned',
                  )}
                </>
              )}
          </Box>
        )}
        {!isLoading && isTrashScope && totalDeletedCount > 0 && (
          <Box className={cn(css.libraryPageMeta)}>
            <span>
              {t('works.list.deletedWorks')}{' '}
              <strong>
                {t('works.list.count', { count: totalDeletedCount })}
              </strong>
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
          {t('navigation.addWork')}
        </AppButton>
      )}
    </Box>
  );
}
