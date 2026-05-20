import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import {
  Group,
  NativeSelect,
  Paper,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  Title,
} from '@mantine/core';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { WORK_STATUSES, WORK_TYPES } from '@work-archive/shared-types';
import type { WorkRecord } from '@work-archive/shared-types';

import {
  ActionRow,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { LibraryTemplate } from '../../../shared/components/PageTemplates';
import { confirmDialogAdapter } from '../../../shared/runtime/dialog-adapter';
import { appMetaRepository } from '../../sync/services/app-meta.repository';
import { LAST_JSON_EXPORT_AT_META_KEY } from '../../profile/hooks/useSettingsOverviewStats';
import {
  ArchiveEmptyState,
  ArchiveSkeleton,
  WorkPoster,
} from '../components/ArchiveComponents';
import { AddWorkDialog } from '../components/AddWorkDialog';
import { WorksList, type WorksViewMode } from '../components/WorksList';
import type { WorkQuickProgressUpdate } from '../components/WorkListRow';
import { WorksToolbar } from '../components/WorksToolbar';
import { WorksTrashList } from '../components/WorksTrashList';
import { useRecentWorkViews } from '../hooks/useRecentWorkViews';
import { useWorksList } from '../hooks/useWorksList';
import {
  worksService,
  type WorksCollectionScope,
} from '../services/works.service';
import {
  DEFAULT_WORKS_LIST_QUERY,
  getDefaultSortDirection,
  type WorksListQuery,
} from '../utils/query-works';
import { createUpsertWorkInputFromRecord } from '../utils/work-form';
import {
  formatWorkDateTime,
  getWorkStatusLabel,
  getWorkTypeLabel,
  workStatusOptions,
} from '../utils/work-options';

function normalizeStatusQueryParam(
  value: string | null,
): WorksListQuery['status'] {
  return value &&
    WORK_STATUSES.includes(value as (typeof WORK_STATUSES)[number])
    ? (value as WorksListQuery['status'])
    : DEFAULT_WORKS_LIST_QUERY.status;
}

function getCollectionScopeFromSearchParams(
  searchParams: URLSearchParams,
): WorksCollectionScope {
  return searchParams.get('scope') === 'trash' ? 'trash' : 'active';
}

function getViewModeFromSearchParams(
  searchParams: URLSearchParams,
): WorksViewMode {
  return searchParams.get('view') === 'list' ? 'list' : 'grid';
}

function getDeletedWorkFromRouteState(state: unknown) {
  if (!state || typeof state !== 'object' || !('deletedWork' in state)) {
    return null;
  }

  const deletedWork = (state as { deletedWork?: unknown }).deletedWork;

  if (!deletedWork || typeof deletedWork !== 'object') {
    return null;
  }

  return deletedWork as WorkRecord;
}

function getQueryFromSearchParams(
  searchParams: URLSearchParams,
): WorksListQuery {
  const ratingFromUrl = Number.parseFloat(searchParams.get('rating') ?? '');
  const statusFromUrl = searchParams.get('status');
  const typeFromUrl = searchParams.get('type');
  const sortByFromUrl = searchParams.get('sort');
  const sortDirectionFromUrl = searchParams.get('dir');
  const sortBy =
    sortByFromUrl === 'title' ||
    sortByFromUrl === 'rating' ||
    sortByFromUrl === 'createdAt' ||
    sortByFromUrl === 'lastConsumedAt' ||
    sortByFromUrl === 'startedAt' ||
    sortByFromUrl === 'completedAt'
      ? sortByFromUrl
      : DEFAULT_WORKS_LIST_QUERY.sortBy;

  return {
    ...DEFAULT_WORKS_LIST_QUERY,
    contributor: searchParams.get('contributor') ?? '',
    genre: searchParams.get('genre') ?? '',
    organizationContributor: searchParams.get('organizationContributor') ?? '',
    personContributor: searchParams.get('personContributor') ?? '',
    rating:
      Number.isFinite(ratingFromUrl) && ratingFromUrl >= 0 && ratingFromUrl <= 5
        ? ratingFromUrl
        : DEFAULT_WORKS_LIST_QUERY.rating,
    searchTerm: searchParams.get('q') ?? '',
    series: searchParams.get('series') ?? '',
    tag: searchParams.get('tag') ?? '',
    sortBy,
    sortDirection:
      sortDirectionFromUrl === 'asc' || sortDirectionFromUrl === 'desc'
        ? sortDirectionFromUrl
        : getDefaultSortDirection(sortBy),
    status: normalizeStatusQueryParam(statusFromUrl),
    type:
      typeFromUrl &&
      WORK_TYPES.includes(typeFromUrl as (typeof WORK_TYPES)[number])
        ? (typeFromUrl as WorksListQuery['type'])
        : DEFAULT_WORKS_LIST_QUERY.type,
  };
}

function buildSearchParams(
  query: WorksListQuery,
  scope: WorksCollectionScope,
  viewMode: WorksViewMode,
) {
  const nextSearchParams = new URLSearchParams();

  if (query.searchTerm.trim()) nextSearchParams.set('q', query.searchTerm.trim());
  if (query.series?.trim()) nextSearchParams.set('series', query.series.trim());
  if (query.contributor?.trim()) {
    nextSearchParams.set('contributor', query.contributor.trim());
  }
  if (query.personContributor?.trim()) {
    nextSearchParams.set('personContributor', query.personContributor.trim());
  }
  if (query.organizationContributor?.trim()) {
    nextSearchParams.set(
      'organizationContributor',
      query.organizationContributor.trim(),
    );
  }
  if (query.genre?.trim()) nextSearchParams.set('genre', query.genre.trim());
  if (query.status !== 'all') nextSearchParams.set('status', query.status);
  if (query.rating !== null) nextSearchParams.set('rating', query.rating.toString());
  if (query.tag?.trim()) nextSearchParams.set('tag', query.tag.trim());
  if (query.type !== 'all') nextSearchParams.set('type', query.type);
  if (query.sortBy !== DEFAULT_WORKS_LIST_QUERY.sortBy) {
    nextSearchParams.set('sort', query.sortBy);
  }
  const sortDirection =
    query.sortDirection ?? getDefaultSortDirection(query.sortBy);
  if (sortDirection !== getDefaultSortDirection(query.sortBy)) {
    nextSearchParams.set('dir', sortDirection);
  }
  if (scope === 'trash') nextSearchParams.set('scope', 'trash');
  if (scope === 'active' && viewMode === 'list') nextSearchParams.set('view', 'list');

  return nextSearchParams;
}

function WorkShortcutShelf({
  eyebrow,
  title,
  works,
}: {
  eyebrow: string;
  title: string;
  works: WorkRecord[];
}) {
  if (works.length === 0) {
    return null;
  }

  return (
    <Stack gap="md">
      <Group align="flex-end" justify="space-between" wrap="wrap">
        <Stack gap={2}>
          <Text c="dimmed" fw={800} size="xs" tt="uppercase">
            {eyebrow}
          </Text>
          <Title order={2} size="h3">
            {title}
          </Title>
        </Stack>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
        {works.map((work) => (
          <Paper
            component={Link}
            key={`${eyebrow}:${work.id}`}
            p="sm"
            radius="md"
            style={{
              background: 'var(--app-surface-subtle)',
              borderColor: 'var(--app-border-subtle)',
              color: 'inherit',
              textDecoration: 'none',
            }}
            to={`/works/${work.id}`}
            withBorder
          >
            <Group gap="sm" wrap="nowrap">
              <WorkPoster
                coverSeed={work.id}
                thumbnailUrl={work.thumbnailUrl}
                title={work.title}
                typeLabel={getWorkTypeLabel(work.type)}
                variant="row"
              />
              <Stack gap={3} miw={0}>
                <Text c="dimmed" fw={700} size="xs">
                  바로가기
                </Text>
                <Text fw={800} lineClamp={1}>
                  {eyebrow} · {work.title}
                </Text>
                {work.author && (
                  <Text c="dimmed" lineClamp={1} size="xs">
                    {work.author}
                  </Text>
                )}
              </Stack>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

function formatLastJsonBackupLabel(value: string | null) {
  return value ? formatWorkDateTime(value) : '아직 없음';
}

export function WorksListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collectionScope, setCollectionScope] = useState<WorksCollectionScope>(
    () => getCollectionScopeFromSearchParams(searchParams),
  );
  const [query, setQuery] = useState<WorksListQuery>(() =>
    getQueryFromSearchParams(searchParams),
  );
  const [viewMode, setViewMode] = useState<WorksViewMode>(() =>
    getViewModeFromSearchParams(searchParams),
  );
  const [addDialogOpened, setAddDialogOpened] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deletedNotice, setDeletedNotice] = useState<WorkRecord | null>(null);
  const [bulkTagDraft, setBulkTagDraft] = useState<string[]>([]);
  const [bulkStatusDraft, setBulkStatusDraft] = useState<WorkRecord['status'] | ''>(
    '',
  );
  const [bulkWorking, setBulkWorking] = useState(false);
  const [lastJsonExportAt, setLastJsonExportAt] = useState<string | null>(null);
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [updatingWorkId, setUpdatingWorkId] = useState<string | null>(null);
  const [restoringWorkId, setRestoringWorkId] = useState<string | null>(null);
  const {
    error,
    genreSuggestions,
    isLoading,
    organizationContributorSuggestions,
    personContributorSuggestions,
    recentModifiedWorks,
    retry,
    seriesSuggestions,
    statusCounts,
    tagSuggestions,
    totalActiveCount,
    totalDeletedCount,
    works,
  } = useWorksList(query, collectionScope);
  const recentViewedWorks = useRecentWorkViews(8);
  const hasActiveFilters =
    query.searchTerm.trim() !== '' ||
    (query.series?.trim() ?? '') !== '' ||
    (query.contributor?.trim() ?? '') !== '' ||
    (query.personContributor?.trim() ?? '') !== '' ||
    (query.organizationContributor?.trim() ?? '') !== '' ||
    (query.genre?.trim() ?? '') !== '' ||
    (query.tag?.trim() ?? '') !== '' ||
    query.rating !== null ||
    query.type !== 'all' ||
    query.status !== 'all' ||
    query.sortBy !== 'updatedAt' ||
    (query.sortDirection ?? getDefaultSortDirection(query.sortBy)) !==
      getDefaultSortDirection(query.sortBy);
  const shouldShowShortcutShelves =
    collectionScope === 'active' &&
    !hasActiveFilters &&
    !isLoading &&
    !error &&
    totalActiveCount > 0;
  const selectedWorks = works.filter((work) => selectedWorkIds.has(work.id));
  const selectedCount = selectedWorks.length;

  useEffect(() => {
    const nextQuery = getQueryFromSearchParams(searchParams);
    const nextScope = getCollectionScopeFromSearchParams(searchParams);
    const nextViewMode = getViewModeFromSearchParams(searchParams);

    setCollectionScope((currentScope) =>
      currentScope === nextScope ? currentScope : nextScope,
    );
    setQuery((currentQuery) =>
      JSON.stringify(currentQuery) === JSON.stringify(nextQuery)
        ? currentQuery
        : nextQuery,
    );
    setViewMode((currentViewMode) =>
      currentViewMode === nextViewMode ? currentViewMode : nextViewMode,
    );
  }, [searchParams]);

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
  }, [location.key]);

  useEffect(() => {
    const subscription = liveQuery(() =>
      appMetaRepository.getValue(LAST_JSON_EXPORT_AT_META_KEY),
    ).subscribe({
      next: setLastJsonExportAt,
      error: () => setLastJsonExportAt(null),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const visibleWorkIds = new Set(works.map((work) => work.id));

    setSelectedWorkIds((currentSelection) => {
      const nextSelection = new Set(
        [...currentSelection].filter((workId) => visibleWorkIds.has(workId)),
      );

      return nextSelection.size === currentSelection.size
        ? currentSelection
        : nextSelection;
    });
  }, [works]);

  function handleQueryChange(nextQuery: WorksListQuery) {
    setQuery(nextQuery);
    setSearchParams(buildSearchParams(nextQuery, collectionScope, viewMode), {
      replace: true,
    });
  }

  function handleCollectionScopeChange(nextScope: WorksCollectionScope) {
    setCollectionScope(nextScope);
    setSearchParams(buildSearchParams(query, nextScope, viewMode), {
      replace: true,
    });
  }

  function handleViewModeChange(nextViewMode: WorksViewMode) {
    setViewMode(nextViewMode);
    setSearchParams(buildSearchParams(query, collectionScope, nextViewMode), {
      replace: true,
    });
  }

  function handleClearFilters() {
    setQuery(DEFAULT_WORKS_LIST_QUERY);
    setSearchParams(
      buildSearchParams(DEFAULT_WORKS_LIST_QUERY, collectionScope, viewMode),
      { replace: true },
    );
  }

  function handleSelectionChange(workId: string, selected: boolean) {
    setSelectedWorkIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      if (selected) {
        nextSelection.add(workId);
      } else {
        nextSelection.delete(workId);
      }

      return nextSelection;
    });
  }

  function handleSelectAllVisibleWorks() {
    setSelectedWorkIds(new Set(works.map((work) => work.id)));
  }

  function handleClearSelection() {
    setSelectedWorkIds(new Set());
  }

  async function handleBulkTagAdd() {
    const tagsToAdd = bulkTagDraft.map((tag) => tag.trim()).filter(Boolean);

    if (selectedWorks.length === 0 || tagsToAdd.length === 0) {
      return;
    }

    try {
      setBulkWorking(true);
      setActionError(null);
      setActionSuccess(null);

      for (const work of selectedWorks) {
        const latestWork = await worksService.getWorkById(work.id);
        if (!latestWork) continue;

        await worksService.updateWork(latestWork.id, {
          ...createUpsertWorkInputFromRecord(latestWork),
          personalTags: Array.from(
            new Set([...latestWork.personalTags, ...tagsToAdd]),
          ),
        });
      }

      setBulkTagDraft([]);
      setActionSuccess(`${selectedWorks.length}개 작품에 태그를 추가했습니다.`);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : '일괄 태그 추가를 완료하지 못했습니다.',
      );
    } finally {
      setBulkWorking(false);
    }
  }

  async function handleBulkStatusChange() {
    if (selectedWorks.length === 0 || !bulkStatusDraft) {
      return;
    }

    const nextStatus = bulkStatusDraft;

    try {
      setBulkWorking(true);
      setActionError(null);
      setActionSuccess(null);

      for (const work of selectedWorks) {
        const latestWork = await worksService.getWorkById(work.id);
        if (!latestWork) continue;

        await worksService.updateWork(latestWork.id, {
          ...createUpsertWorkInputFromRecord(latestWork),
          status: nextStatus,
        });
      }

      setBulkStatusDraft('');
      setActionSuccess(
        `${selectedWorks.length}개 작품 상태를 ${getWorkStatusLabel(nextStatus)}(으)로 변경했습니다.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : '일괄 상태 변경을 완료하지 못했습니다.',
      );
    } finally {
      setBulkWorking(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedWorks.length === 0) {
      return;
    }

    const shouldDelete = await confirmDialogAdapter.confirm({
      description:
        '선택한 작품을 휴지통으로 이동합니다. 휴지통에서 다시 복원할 수 있습니다.',
      title: `선택한 작품 ${selectedWorks.length}개를 휴지통으로 이동할까요?`,
    });

    if (!shouldDelete) return;

    try {
      setBulkWorking(true);
      setActionError(null);
      setActionSuccess(null);

      for (const work of selectedWorks) {
        await worksService.deleteWork(work.id);
      }

      setDeletedNotice(null);
      setSelectedWorkIds(new Set());
      setActionSuccess(`${selectedWorks.length}개 작품을 휴지통으로 이동했습니다.`);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : '선택한 작품을 휴지통으로 이동하지 못했습니다.',
      );
    } finally {
      setBulkWorking(false);
    }
  }

  async function handleDelete(work: WorkRecord) {
    const shouldDelete = await confirmDialogAdapter.confirm({
      description: '목록에서는 숨겨지고 휴지통에서 다시 복원할 수 있습니다.',
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

  return (
    <LibraryTemplate>
      <WorksToolbar
        collectionScope={collectionScope}
        filteredCount={works.length}
        isLoading={isLoading}
        onClearFilters={handleClearFilters}
        onCollectionScopeChange={handleCollectionScopeChange}
        onCreateWork={() => setAddDialogOpened(true)}
        onQueryChange={handleQueryChange}
        onViewModeChange={handleViewModeChange}
        query={query}
        genreSuggestions={genreSuggestions}
        organizationContributorSuggestions={organizationContributorSuggestions}
        personContributorSuggestions={personContributorSuggestions}
        seriesSuggestions={seriesSuggestions}
        statusCounts={statusCounts}
        tagSuggestions={tagSuggestions}
        totalActiveCount={totalActiveCount}
        totalDeletedCount={totalDeletedCount}
        viewMode={viewMode}
      />

      <Paper
        p="md"
        radius="lg"
        style={{
          background: 'var(--app-surface-subtle)',
          borderColor: 'var(--app-border-subtle)',
        }}
        withBorder
      >
        <Stack gap="md">
          <Group align="center" justify="space-between" wrap="wrap">
            <Stack gap={2}>
              <Text c="dimmed" fw={800} size="xs" tt="uppercase">
                관리
              </Text>
              <Text fw={800}>마지막 JSON 백업: {formatLastJsonBackupLabel(lastJsonExportAt)}</Text>
            </Stack>
            {collectionScope === 'active' && totalActiveCount > 0 && (
              <ActionRow justify="flex-end">
                <AppButton
                  onClick={() => {
                    setSelectionMode((currentValue) => !currentValue);
                    setSelectedWorkIds(new Set());
                  }}
                  tone={selectionMode ? 'primary' : 'secondary'}
                  type="button"
                >
                  {selectionMode ? '선택 모드 종료' : '일괄 선택'}
                </AppButton>
              </ActionRow>
            )}
          </Group>

          {selectionMode && collectionScope === 'active' && (
            <Stack gap="sm">
              <Group align="center" justify="space-between" wrap="wrap">
                <Text c="dimmed" size="sm">
                  선택 {selectedCount}개 / 현재 결과 {works.length}개
                </Text>
                <ActionRow justify="flex-end">
                  <AppButton
                    disabled={works.length === 0 || bulkWorking}
                    onClick={handleSelectAllVisibleWorks}
                    size="compact-sm"
                    tone="secondary"
                    type="button"
                  >
                    현재 결과 전체 선택
                  </AppButton>
                  <AppButton
                    disabled={selectedCount === 0 || bulkWorking}
                    onClick={handleClearSelection}
                    size="compact-sm"
                    tone="ghost"
                    type="button"
                  >
                    선택 해제
                  </AppButton>
                </ActionRow>
              </Group>

              <Group align="flex-end" gap="sm" wrap="wrap">
                <TagsInput
                  clearable
                  disabled={bulkWorking}
                  label="일괄 태그 추가"
                  onChange={setBulkTagDraft}
                  placeholder="태그 입력 후 적용"
                  splitChars={[',']}
                  style={{ flex: '1 1 16rem' }}
                  value={bulkTagDraft}
                />
                <AppButton
                  aria-label="선택 작품 태그 추가"
                  disabled={
                    selectedCount === 0 ||
                    bulkTagDraft.length === 0 ||
                    bulkWorking
                  }
                  onClick={() => void handleBulkTagAdd()}
                  tone="secondary"
                  type="button"
                >
                  태그 추가
                </AppButton>

                <NativeSelect
                  disabled={bulkWorking}
                  label="일괄 상태 변경"
                  onChange={(event) =>
                    setBulkStatusDraft(
                      event.currentTarget.value as WorkRecord['status'] | '',
                    )
                  }
                  style={{ flex: '1 1 12rem' }}
                  value={bulkStatusDraft}
                >
                  <option value="">상태 선택</option>
                  {workStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
                <AppButton
                  aria-label="선택 작품 상태 변경"
                  disabled={selectedCount === 0 || !bulkStatusDraft || bulkWorking}
                  onClick={() => void handleBulkStatusChange()}
                  tone="secondary"
                  type="button"
                >
                  상태 변경
                </AppButton>
                <AppButton
                  aria-label="선택 작품 휴지통 이동"
                  disabled={selectedCount === 0 || bulkWorking}
                  onClick={() => void handleBulkDelete()}
                  tone="danger"
                  type="button"
                >
                  휴지통으로 이동
                </AppButton>
              </Group>
            </Stack>
          )}
        </Stack>
      </Paper>

      {actionError && <FeedbackMessage tone="error">{actionError}</FeedbackMessage>}
      {actionSuccess && (
        <FeedbackMessage tone="success">{actionSuccess}</FeedbackMessage>
      )}

      {deletedNotice && collectionScope === 'active' && (
        <FeedbackMessage title="휴지통으로 이동했습니다." tone="success">
          <ActionRow justify="space-between">
            <span>{deletedNotice.title} 기록을 되돌릴 수 있습니다.</span>
            <ActionRow justify="flex-end">
              <AppButton
                disabled={restoringWorkId === deletedNotice.id}
                onClick={() => void handleRestore(deletedNotice)}
                size="compact-sm"
                tone="secondary"
                type="button"
              >
                되돌리기
              </AppButton>
              <AppButton
                onClick={() => setDeletedNotice(null)}
                size="compact-sm"
                tone="ghost"
                type="button"
              >
                닫기
              </AppButton>
            </ActionRow>
          </ActionRow>
        </FeedbackMessage>
      )}

      {shouldShowShortcutShelves && (
        <Stack gap="xl">
          <WorkShortcutShelf
            eyebrow="최근 본 작품"
            title="방금 열어본 기록"
            works={recentViewedWorks}
          />

          <WorkShortcutShelf
            eyebrow="최근 수정한 작품"
            title="최근 손본 기록"
            works={recentModifiedWorks}
          />
        </Stack>
      )}

      {error && (
        <StateMessage
          actions={
            <>
              <AppButton onClick={retry} tone="primary" type="button">
                다시 불러오기
              </AppButton>
              <AppButton
                aria-label="목록 오류 상태에서 작품 추가"
                onClick={() => setAddDialogOpened(true)}
                tone="secondary"
                type="button"
              >
                작품 추가
              </AppButton>
            </>
          }
          description={error}
          title="작품 목록을 불러오지 못했습니다."
          tone="error"
        />
      )}

      {!error && isLoading && (
        <ArchiveSkeleton count={collectionScope === 'trash' ? 4 : 10} />
      )}

      {!error && !isLoading && works.length === 0 && (
        <ArchiveEmptyState
          actions={
            <>
              {collectionScope === 'trash' ? (
                <AppButton onClick={() => handleCollectionScopeChange('active')} type="button">
                  작품 목록
                </AppButton>
              ) : hasActiveFilters ? (
                <>
                  <AppButton onClick={handleClearFilters} type="button">
                    필터 초기화
                  </AppButton>
                  <AppLinkButton to="/works/new" tone="secondary">
                    직접 추가
                  </AppLinkButton>
                </>
              ) : (
                <>
                  <AppLinkButton to="/works/new" tone="primary">
                    직접 추가
                  </AppLinkButton>
                  <AppButton
                    onClick={() => setAddDialogOpened(true)}
                    tone="secondary"
                    type="button"
                  >
                    검색으로 추가
                  </AppButton>
                  <AppLinkButton to="/account/settings" tone="quiet">
                    JSON 백업 가져오기
                  </AppLinkButton>
                </>
              )}
            </>
          }
          description={
            collectionScope === 'trash'
              ? '숨긴 작품은 이곳에서 다시 확인하거나 복원할 수 있습니다.'
              : hasActiveFilters
                ? '검색어나 필터를 바꿔 다시 찾아보세요.'
                : '제목만 직접 남기거나, 검색으로 기본 정보를 불러오거나, 기존 JSON 백업에서 다시 시작할 수 있습니다.'
          }
          eyebrow={
            collectionScope === 'trash'
              ? '휴지통'
              : hasActiveFilters
                ? '검색 결과 없음'
                : '빈 선반'
          }
          title={
            collectionScope === 'trash'
              ? '휴지통이 비어 있습니다.'
              : hasActiveFilters
                ? '조건에 맞는 작품이 없습니다.'
                : '아직 기록한 작품이 없습니다.'
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
            onSelectionChange={handleSelectionChange}
            selectedWorkIds={selectedWorkIds}
            selectionMode={selectionMode}
            updatingWorkId={updatingWorkId}
            viewMode={viewMode}
            works={works}
          />
        ))}

      <AddWorkDialog
        onClose={() => setAddDialogOpened(false)}
        opened={addDialogOpened}
      />
    </LibraryTemplate>
  );
}
