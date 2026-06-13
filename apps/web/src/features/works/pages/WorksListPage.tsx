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
import { WorksListEmptyState } from '../components/WorksListEmptyState';
import { WorksListErrorState } from '../components/WorksListErrorState';
import { WorksListFeedback } from '../components/WorksListFeedback';
import { WorksListPageHeader } from '../components/WorksListPageHeader';
import { SavedWorksViews } from '../components/SavedWorksViews';
import type { WorkQuickProgressUpdate } from '../components/WorkListRow';
import { WorksToolbar } from '../components/WorksToolbar';
import { WorksTrashList } from '../components/WorksTrashList';
import { useLibraryDensity } from '../hooks/useLibraryDensity';
import { useWorksList } from '../hooks/useWorksList';
import { useWorksListUrlState } from '../hooks/useWorksListUrlState';
import { worksService } from '../services/works.service';
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
        onClose={() => setAddDialogOpened(false)}
        opened={addDialogOpened}
      />
    </Box>
  );
}
