import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Stack } from '@mantine/core';

import type { WorkRecord } from '@work-archive/shared-types';

import { confirmDialogAdapter } from '@shared/runtime/dialog-adapter';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { JsonBackupReminderCard } from '@features/archive';
import { useJsonArchiveExport } from '@features/archive';
import { useJsonBackupReminder } from '@features/archive';
import { useAuthSession } from '@features/auth';
import { ArchiveSkeleton } from '../components/ArchiveComponents';
import { AddWorkDialog } from '../components/AddWorkDialog';
import { WorksList } from '../components/WorksList';
import { WorksListEmptyState } from '../components/WorksListEmptyState';
import { WorksListErrorState } from '../components/WorksListErrorState';
import { WorksListFeedback } from '../components/WorksListFeedback';
import { WorksListPageHeader } from '../components/WorksListPageHeader';
import { SavedWorksViews } from '../components/SavedWorksViews';
import type { WorkQuickProgressUpdate } from '../components/WorkListRow';
import { WorksToolbar } from '../components/WorksToolbar';
import { WorksTrashList } from '../components/WorksTrashList';
import { useWorksList } from '../hooks/useWorksList';
import { useWorksListUrlState } from '../hooks/useWorksListUrlState';
import { worksService } from '../services/works.service';
import { createUpsertWorkInputFromRecord } from '../utils/work-form';
import {
  getDeletedWorkFromRouteState,
  hasActiveWorksListFilters,
} from '../utils/works-list-url-state';

export function WorksListPage() {
  usePageTitle('작품 서재');
  const location = useLocation();
  const navigate = useNavigate();
  const { archiveScopeKey } = useAuthSession();
  const {
    collectionScope,
    handleClearFilters,
    handleCollectionScopeChange,
    handleQueryChange,
    handleViewModeChange,
    query,
    viewMode,
  } = useWorksListUrlState();
  const [addDialogOpened, setAddDialogOpened] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deletedNotice, setDeletedNotice] = useState<WorkRecord | null>(null);
  const [updatingWorkId, setUpdatingWorkId] = useState<string | null>(null);
  const [restoringWorkId, setRestoringWorkId] = useState<string | null>(null);
  const {
    error,
    genreSuggestions,
    isLoading,
    organizationContributorSuggestions,
    personContributorSuggestions,
    retry,
    seriesSuggestions,
    statusCounts,
    tagSuggestions,
    totalActiveCount,
    totalDeletedCount,
    typeCounts,
    works,
  } = useWorksList(query, collectionScope);
  const jsonArchiveExport = useJsonArchiveExport();
  const backupReminder = useJsonBackupReminder(
    totalActiveCount,
    archiveScopeKey,
  );
  const hasActiveFilters = hasActiveWorksListFilters(query);

  useEffect(() => {
    const routeDeletedWork = getDeletedWorkFromRouteState(location.state);

    if (!routeDeletedWork) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setDeletedNotice(routeDeletedWork);
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [
    location.key,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ]);

  async function handleDelete(work: WorkRecord) {
    const shouldDelete = await confirmDialogAdapter.confirm({
      description: '서재에서는 숨겨지고 휴지통에서 다시 복원할 수 있습니다.',
      title: `"${work.title}"을 휴지통으로 이동할까요?`,
    });

    if (!shouldDelete) return;

    try {
      setActionError(null);
      setActionSuccess(null);
      await worksService.deleteWork(work.id);
      setDeletedNotice(work);
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : '작품을 삭제하지 못했습니다.',
      );
    }
  }

  async function handleRestore(work: WorkRecord) {
    try {
      setActionError(null);
      setActionSuccess(null);
      setRestoringWorkId(work.id);
      await worksService.restoreWork(work.id);
      setDeletedNotice((currentNotice) =>
        currentNotice?.id === work.id ? null : currentNotice,
      );
      setActionSuccess('되돌렸습니다.');
    } catch (restoreError) {
      setActionError(
        restoreError instanceof Error
          ? restoreError.message
          : '작품을 복원하지 못했습니다.',
      );
    } finally {
      setRestoringWorkId(null);
    }
  }

  async function handleQuickUpdate(
    work: WorkRecord,
    nextValues: {
      favorite?: boolean;
      rating?: number | null;
      status?: WorkRecord['status'];
    },
  ) {
    try {
      setActionError(null);
      setUpdatingWorkId(work.id);

      const latestWork = await worksService.getWorkById(work.id);
      if (!latestWork) throw new Error('작품을 찾을 수 없습니다.');

      await worksService.updateWork(work.id, {
        ...createUpsertWorkInputFromRecord(latestWork),
        ...nextValues,
      });
    } catch (updateError) {
      setActionError(
        updateError instanceof Error
          ? updateError.message
          : '작품을 바로 수정하지 못했습니다.',
      );
    } finally {
      setUpdatingWorkId(null);
    }
  }

  async function handleQuickProgressUpdate(
    work: WorkRecord,
    nextValues: WorkQuickProgressUpdate,
  ) {
    if (
      nextValues.progressCurrent !== null &&
      nextValues.progressTotal !== null &&
      nextValues.progressCurrent > nextValues.progressTotal
    ) {
      setActionError('현재 진행량이 전체 진행량보다 클 수 없습니다.');
      return;
    }

    try {
      setActionError(null);
      setUpdatingWorkId(work.id);
      await worksService.updateProgress(work.id, nextValues);
    } catch (updateError) {
      setActionError(
        updateError instanceof Error
          ? updateError.message
          : '진행도를 바로 수정하지 못했습니다.',
      );
    } finally {
      setUpdatingWorkId(null);
    }
  }

  const isTrashScope = collectionScope === 'trash';

  return (
    <Box maw={1440} mx="auto" px={{ base: 'md', sm: 'xl', lg: '2rem' }} pb="xl">
      <Stack gap="md">
        {!error && (
          <WorksListPageHeader
            activeStatus={query.status}
            isLoading={isLoading}
            isTrashScope={isTrashScope}
            onAddWork={() => setAddDialogOpened(true)}
            onSelectStatus={(status) => handleQueryChange({ ...query, status })}
            statusCounts={statusCounts}
            totalActiveCount={totalActiveCount}
            totalDeletedCount={totalDeletedCount}
          />
        )}

        {!error && !isTrashScope && <SavedWorksViews />}

        <WorksToolbar
          collectionScope={collectionScope}
          filteredCount={works.length}
          onClearFilters={handleClearFilters}
          onCollectionScopeChange={handleCollectionScopeChange}
          onQueryChange={handleQueryChange}
          onViewModeChange={handleViewModeChange}
          query={query}
          genreSuggestions={genreSuggestions}
          organizationContributorSuggestions={
            organizationContributorSuggestions
          }
          personContributorSuggestions={personContributorSuggestions}
          seriesSuggestions={seriesSuggestions}
          statusCounts={statusCounts}
          tagSuggestions={tagSuggestions}
          totalActiveCount={totalActiveCount}
          totalDeletedCount={totalDeletedCount}
          typeCounts={typeCounts}
          viewMode={viewMode}
        />

        <JsonBackupReminderCard
          feedback={jsonArchiveExport.feedback}
          isExporting={jsonArchiveExport.isExporting}
          onExportJson={jsonArchiveExport.exportJson}
          reminder={backupReminder}
        />

        <WorksListFeedback
          actionError={actionError}
          actionSuccess={actionSuccess}
          deletedNotice={deletedNotice}
          onDismissDeletedNotice={() => setDeletedNotice(null)}
          onRestoreDeletedNotice={(work) => void handleRestore(work)}
          restoringWorkId={restoringWorkId}
          showDeletedNotice={collectionScope === 'active'}
        />

        {error && (
          <WorksListErrorState
            error={error}
            onOpenAddDialog={() => setAddDialogOpened(true)}
            onRetry={retry}
          />
        )}

        {!error && isLoading && (
          <ArchiveSkeleton count={collectionScope === 'trash' ? 4 : 10} />
        )}

        {!error && !isLoading && works.length === 0 && (
          <WorksListEmptyState
            collectionScope={collectionScope}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
            onOpenAddDialog={() => setAddDialogOpened(true)}
            onReturnToActiveCollection={() =>
              handleCollectionScopeChange('active')
            }
          />
        )}

        {!error &&
          !isLoading &&
          works.length > 0 &&
          (collectionScope === 'trash' ? (
            <WorksTrashList
              onRestore={handleRestore}
              restoringWorkId={restoringWorkId}
              works={works}
            />
          ) : (
            <WorksList
              onDelete={handleDelete}
              onQuickProgressUpdate={handleQuickProgressUpdate}
              onQuickUpdate={handleQuickUpdate}
              updatingWorkId={updatingWorkId}
              viewMode={viewMode}
              works={works}
            />
          ))}
      </Stack>

      <AddWorkDialog
        onClose={() => setAddDialogOpened(false)}
        opened={addDialogOpened}
      />
    </Box>
  );
}
