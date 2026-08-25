import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Stack } from '@mantine/core';

import type { WorkRecord } from '@work-archive/shared-types';

import { confirmDialogAdapter } from '@shared/runtime/dialog-adapter';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { useAppTranslation } from '@app/i18n';
import { JsonBackupReminderCard } from '@features/archive';
import { useJsonArchiveExport } from '@features/archive';
import { useJsonBackupReminder } from '@features/archive';
import { useAuthSession } from '@features/auth';
import { ArchiveSkeleton } from '../components/ArchiveComponents';
import { AddWorkDialog } from '../components/AddWorkDialog';
import { WorksList } from '../components/WorksList';
import { WorksContinueShelf } from '../components/WorksContinueShelf';
import { WorksListEmptyState } from '../components/WorksListEmptyState';
import { WorksListErrorState } from '../components/WorksListErrorState';
import { WorksListFeedback } from '../components/WorksListFeedback';
import { WorksListPageHeader } from '../components/WorksListPageHeader';
import { SavedWorksViews } from '../components/SavedWorksViews';
import type { WorkQuickProgressUpdate } from '../components/WorkListRow';
import { WorksToolbar } from '../components/WorksToolbar';
import { WorksTrashList } from '../components/WorksTrashList';
import { WorksTrashToolbar } from '../components/WorksTrashToolbar';
import { useLibraryDensity } from '../hooks/useLibraryDensity';
import { useWorksList } from '../hooks/useWorksList';
import { useWorksListUrlState } from '../hooks/useWorksListUrlState';
import { worksService, WorksService } from '../services/works.service';
import { createUpsertWorkInputFromRecord } from '../utils/work-form';
import {
  getDeletedWorkFromRouteState,
  hasActiveWorksListFilters,
} from '../utils/works-list-url-state';

export function WorksListPage() {
  const { t } = useAppTranslation();
  usePageTitle(t('works.list.pageTitle'));
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
  const [density, setDensity] = useLibraryDensity();
  const [addDialogOpened, setAddDialogOpened] = useState(false);
  const [addDialogMode, setAddDialogMode] = useState<'manual' | 'search'>(
    'manual',
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deletedNotice, setDeletedNotice] = useState<WorkRecord | null>(null);
  const [updatingWorkId, setUpdatingWorkId] = useState<string | null>(null);
  const [restoringWorkId, setRestoringWorkId] = useState<string | null>(null);
  const [deletingWorkId, setDeletingWorkId] = useState<string | null>(null);
  const [selectedTrashIds, setSelectedTrashIds] = useState<Set<string>>(
    () => new Set(),
  );
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
  const retentionDays = WorksService.TRASH_RETENTION_DAYS;
  const selectedTrashCount = works.reduce(
    (count, work) => (selectedTrashIds.has(work.id) ? count + 1 : count),
    0,
  );
  const allTrashSelected =
    works.length > 0 && selectedTrashCount === works.length;

  function openAddDialog(dialogMode: 'manual' | 'search' = 'manual') {
    setAddDialogMode(dialogMode);
    setAddDialogOpened(true);
  }

  // 보존 기간이 지난 휴지통 항목은 진입 시 1회 자동 정리한다(반응형 목록이 갱신).
  useEffect(() => {
    void worksService.purgeExpiredTrash().catch(() => {
      // 자동 정리 실패는 조용히 무시한다. 수동 비우기로 대체 가능.
    });
  }, []);

  // 스코프를 벗어나면 선택을 초기화한다.
  useEffect(() => {
    if (collectionScope !== 'trash') {
      setSelectedTrashIds((current) =>
        current.size > 0 ? new Set() : current,
      );
    }
  }, [collectionScope]);

  function toggleTrashSelect(id: string) {
    setSelectedTrashIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleSelectAllTrash() {
    setSelectedTrashIds(
      allTrashSelected ? new Set() : new Set(works.map((work) => work.id)),
    );
  }

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
      description: t('works.list.deleteDescription'),
      title: t('works.list.deleteTitle', { title: work.title }),
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
          : t('works.list.deleteError'),
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
      setActionSuccess(t('works.list.restored'));
    } catch (restoreError) {
      setActionError(
        restoreError instanceof Error
          ? restoreError.message
          : t('works.list.restoreError'),
      );
    } finally {
      setRestoringWorkId(null);
    }
  }

  function removeFromSelection(ids: string[]) {
    setSelectedTrashIds((current) => {
      if (current.size === 0) return current;
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  async function handlePermanentDelete(work: WorkRecord) {
    const confirmed = await confirmDialogAdapter.confirm({
      description: t('works.list.permanentDeleteConfirmDescription'),
      title: t('works.list.permanentDeleteConfirmTitle', { title: work.title }),
    });

    if (!confirmed) return;

    try {
      setActionError(null);
      setActionSuccess(null);
      setDeletingWorkId(work.id);
      await worksService.permanentlyDeleteWork(work.id);
      removeFromSelection([work.id]);
      setActionSuccess(t('works.list.permanentDeleted'));
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : t('works.list.permanentDeleteError'),
      );
    } finally {
      setDeletingWorkId(null);
    }
  }

  async function handleEmptyTrash() {
    const confirmed = await confirmDialogAdapter.confirm({
      description: t('works.list.emptyTrashConfirmDescription', {
        total: totalDeletedCount,
      }),
      title: t('works.list.emptyTrashConfirmTitle'),
    });

    if (!confirmed) return;

    try {
      setActionError(null);
      setActionSuccess(null);
      await worksService.emptyTrash();
      setSelectedTrashIds(new Set());
      setActionSuccess(t('works.list.trashCleared'));
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : t('works.list.permanentDeleteError'),
      );
    }
  }

  async function handleRestoreAll() {
    try {
      setActionError(null);
      setActionSuccess(null);
      const restored = await worksService.restoreWorks(
        works.map((work) => work.id),
      );
      setSelectedTrashIds(new Set());
      setActionSuccess(t('works.list.restoredCount', { total: restored }));
    } catch (restoreError) {
      setActionError(
        restoreError instanceof Error
          ? restoreError.message
          : t('works.list.restoreError'),
      );
    }
  }

  async function handleRestoreSelected() {
    const ids = works
      .map((work) => work.id)
      .filter((id) => selectedTrashIds.has(id));

    if (ids.length === 0) return;

    try {
      setActionError(null);
      setActionSuccess(null);
      const restored = await worksService.restoreWorks(ids);
      setSelectedTrashIds(new Set());
      setActionSuccess(t('works.list.restoredCount', { total: restored }));
    } catch (restoreError) {
      setActionError(
        restoreError instanceof Error
          ? restoreError.message
          : t('works.list.restoreError'),
      );
    }
  }

  async function handlePermanentDeleteSelected() {
    const ids = works
      .map((work) => work.id)
      .filter((id) => selectedTrashIds.has(id));

    if (ids.length === 0) return;

    const confirmed = await confirmDialogAdapter.confirm({
      description: t('works.list.permanentDeleteConfirmDescription'),
      title: t('works.list.permanentDeleteSelectedConfirmTitle', {
        total: ids.length,
      }),
    });

    if (!confirmed) return;

    try {
      setActionError(null);
      setActionSuccess(null);
      await worksService.permanentlyDeleteWorks(ids);
      setSelectedTrashIds(new Set());
      setActionSuccess(t('works.list.permanentDeleted'));
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : t('works.list.permanentDeleteError'),
      );
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
      if (!latestWork) throw new Error(t('works.list.workMissing'));

      await worksService.updateWork(work.id, {
        ...createUpsertWorkInputFromRecord(latestWork),
        ...nextValues,
      });
    } catch (updateError) {
      setActionError(
        updateError instanceof Error
          ? updateError.message
          : t('works.list.quickEditError'),
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
      setActionError(t('works.progress.invalidRange'));
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
          : t('works.progress.quickEditError'),
      );
    } finally {
      setUpdatingWorkId(null);
    }
  }

  const isTrashScope = collectionScope === 'trash';
  const continueWorks =
    !isTrashScope && !hasActiveFilters
      ? works.filter((work) => work.status === 'in_progress').slice(0, 6)
      : [];

  return (
    <Box maw={1520} mx="auto" px={{ base: 'md', sm: 'xl', lg: '2rem' }} pb="xl">
      <Stack gap="md">
        {!error && (
          <WorksListPageHeader
            activeStatus={query.status}
            isLoading={isLoading}
            isTrashScope={isTrashScope}
            onAddWork={() => openAddDialog('search')}
            onSelectStatus={(status) => handleQueryChange({ ...query, status })}
            statusCounts={statusCounts}
            totalActiveCount={totalActiveCount}
            totalDeletedCount={totalDeletedCount}
          />
        )}

        {!error && !isTrashScope && <SavedWorksViews />}

        <WorksToolbar
          collectionScope={collectionScope}
          density={density}
          filteredCount={works.length}
          onClearFilters={handleClearFilters}
          onCollectionScopeChange={handleCollectionScopeChange}
          onDensityChange={setDensity}
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

        {!error && !isLoading && <WorksContinueShelf works={continueWorks} />}

        {/* 백업 넛지는 활성 서재에서만 — 휴지통(복구 작업 공간)에서는 숨긴다 */}
        {!isTrashScope && (
          <JsonBackupReminderCard
            feedback={jsonArchiveExport.feedback}
            isExporting={jsonArchiveExport.isExporting}
            onExportJson={jsonArchiveExport.exportJson}
            reminder={backupReminder}
          />
        )}

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
            onOpenAddDialog={() => openAddDialog('search')}
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
            onOpenAddDialog={() => openAddDialog('search')}
            onReturnToActiveCollection={() =>
              handleCollectionScopeChange('active')
            }
          />
        )}

        {!error &&
          !isLoading &&
          works.length > 0 &&
          (collectionScope === 'trash' ? (
            <>
              <WorksTrashToolbar
                allSelected={allTrashSelected}
                onClearSelection={() => setSelectedTrashIds(new Set())}
                onEmptyTrash={() => void handleEmptyTrash()}
                onPermanentDeleteSelected={() =>
                  void handlePermanentDeleteSelected()
                }
                onRestoreAll={() => void handleRestoreAll()}
                onRestoreSelected={() => void handleRestoreSelected()}
                onToggleSelectAll={toggleSelectAllTrash}
                retentionDays={retentionDays}
                selectedCount={selectedTrashCount}
              />
              <WorksTrashList
                deletingWorkId={deletingWorkId}
                onPermanentDelete={handlePermanentDelete}
                onRestore={handleRestore}
                onToggleSelect={toggleTrashSelect}
                restoringWorkId={restoringWorkId}
                retentionDays={retentionDays}
                selectedIds={selectedTrashIds}
                works={works}
              />
            </>
          ) : (
            <WorksList
              density={density}
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
        initialMode={addDialogMode}
        onClose={() => setAddDialogOpened(false)}
        opened={addDialogOpened}
      />
    </Box>
  );
}
