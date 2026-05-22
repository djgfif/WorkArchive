import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import {
  Accordion,
  Group,
  NativeSelect,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import {
  canUseProgressUnitForWorkType,
  getDefaultProgressUnitForWorkType,
  isProgressOnlyWorkType,
  isVolumeRecordableWorkType,
  type ProgressUnit,
  type TimelineEntryRecord,
  type TimelineEntryType,
  type UserReleaseRecord,
  type WorkRecord,
  type WorkStatus,
} from '@work-archive/shared-types';

import {
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  LoadingState,
  PageSection,
  SectionCard,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { DetailPageTemplate } from '../../../shared/components/PageTemplates';
import { confirmDialogAdapter } from '../../../shared/runtime/dialog-adapter';
import { useAuthSession } from '../../auth';
import { WorkDetailPanel } from '../components/WorkDetailPanel';
import { QuickProgressControl } from '../components/ArchiveComponents';
import { useWorkDetail } from '../hooks/useWorkDetail';
import {
  graphRepository,
  type WorkGraphSnapshot,
} from '../services/graph.repository';
import { releaseRecordsService } from '../services/release-records.service';
import { recentWorkViewsService } from '../services/recent-work-views.service';
import { timelineEntriesRepository } from '../services/timeline-entries.repository';
import { timelineEntriesService } from '../services/timeline-entries.service';
import {
  fetchRelatedCatalogTitles,
  fetchUserRecordReleases,
  type RelatedCatalogTitlesResponse,
  type UserRecordReleasesResponse,
} from '../services/user-records.api';
import { worksRepository } from '../services/works.repository';
import { worksService } from '../services/works.service';
import { getSeriesTagValues } from '../utils/graph-tags';
import {
  getWorkTypeLabel,
  workStatusOptions,
} from '../utils/work-options';
import { createUpsertWorkInputFromRecord } from '../utils/work-form';

const ratingOptions = Array.from({ length: 10 }, (_, index) => {
  const value = (index + 1) * 0.5;

  return {
    label: `${value.toFixed(1)}점`,
    value,
  };
});

const relationTypeLabels: Record<string, string> = {
  adaptation: '각색',
  alternate_version: '다른 버전',
  compilation: '합본',
  original: '원작',
  prequel: '이전 이야기',
  remake: '리메이크',
  sequel: '후속작',
  side_story: '외전',
  spin_off: '스핀오프',
};

function getRouteFeedback(state: unknown) {
  if (!state || typeof state !== 'object' || !('feedback' in state)) {
    return null;
  }

  const feedback = (state as { feedback?: unknown }).feedback;

  return typeof feedback === 'string' ? feedback : null;
}

function getSavedFeedback(value: string | null) {
  return value === 'edit' ? '로컬에 저장됨' : null;
}

function WorkQuickRecordSection({
  onError,
  onSuccess,
  work,
}: {
  onError(message: string | null): void;
  onSuccess(message: string): void;
  work: WorkRecord;
}) {
  const [status, setStatus] = useState<WorkStatus>(work.status);
  const [rating, setRating] = useState(work.rating?.toString() ?? '');
  const [favorite, setFavorite] = useState(work.favorite);
  const [shortReview, setShortReview] = useState(work.shortReview);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStatus(work.status);
    setRating(work.rating?.toString() ?? '');
    setFavorite(work.favorite);
    setShortReview(work.shortReview);
  }, [work.favorite, work.id, work.rating, work.shortReview, work.status]);

  const parsedRating = rating === '' ? null : Number.parseFloat(rating);
  const nextRating = Number.isNaN(parsedRating) ? null : parsedRating;
  const hasChanges =
    status !== work.status ||
    nextRating !== work.rating ||
    favorite !== work.favorite ||
    shortReview !== work.shortReview;

  async function handleSave() {
    try {
      setIsSaving(true);
      onError(null);
      await worksService.updateWork(work.id, {
        ...createUpsertWorkInputFromRecord(work),
        favorite,
        rating: nextRating,
        shortReview,
        status,
      });
      onSuccess('빠른 기록을 저장했습니다.');
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '빠른 기록을 저장하지 못했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageSection
      description="상태, 별점, 즐겨찾기, 한줄평만 빠르게 정리합니다."
      eyebrow="바로 수정"
      title="빠른 기록"
    >
      <SectionCard gap="md" padding="lg" tone="default">
        <Group align="flex-end" grow>
          <NativeSelect
            aria-label={`${work.title} 빠른 상태`}
            label="상태"
            onChange={(event) =>
              setStatus(event.currentTarget.value as WorkStatus)
            }
            value={status}
          >
            {workStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label={`${work.title} 빠른 별점`}
            label="별점"
            onChange={(event) => setRating(event.currentTarget.value)}
            value={rating}
          >
            <option value="">미평가</option>
            {ratingOptions.map((option) => (
              <option key={option.value} value={option.value.toString()}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </Group>
        <TextInput
          aria-label={`${work.title} 빠른 한줄평`}
          label="한줄평"
          maxLength={500}
          onChange={(event) => setShortReview(event.currentTarget.value)}
          placeholder="짧게 남겨두기"
          value={shortReview}
        />
        <Group justify="space-between">
          <AppButton
            aria-pressed={favorite}
            onClick={() => setFavorite((current) => !current)}
            tone={favorite ? 'primary' : 'secondary'}
            type="button"
          >
            {favorite ? '즐겨찾기 해제' : '즐겨찾기'}
          </AppButton>
          <AppButton
            disabled={!hasChanges || isSaving}
            onClick={() => void handleSave()}
            tone="primary"
            type="button"
          >
            빠른 기록 저장
          </AppButton>
        </Group>
      </SectionCard>
    </PageSection>
  );
}

function ProgressOnlySection({
  onError,
  onSuccess,
  work,
}: {
  onError(message: string | null): void;
  onSuccess(message: string): void;
  work: WorkRecord;
}) {
  const defaultUnit = getDefaultProgressUnitForWorkType(work.type);
  if (!isProgressOnlyWorkType(work.type) || defaultUnit === null) {
    return null;
  }
  const progressUnit = defaultUnit;

  async function handleSave(nextValues: {
    lastConsumedLabel: string;
    progressCurrent: number | null;
    progressTotal: number | null;
    progressUnit: ProgressUnit;
  }) {
    if (!canUseProgressUnitForWorkType(work.type, progressUnit)) {
      onError('이 작품 유형에는 진행도 기록을 사용할 수 없습니다.');

      return;
    }

    if (
      nextValues.progressCurrent !== null &&
      nextValues.progressTotal !== null &&
      nextValues.progressCurrent > nextValues.progressTotal
    ) {
      onError('현재 진행도가 전체 진행도보다 클 수 없습니다.');

      return;
    }

    try {
      onError(null);
      await worksService.updateProgress(work.id, nextValues);
      onSuccess('진행도를 저장했습니다.');
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '진행도를 저장하지 못했습니다.',
      );
    }
  }

  return (
    <PageSection
      eyebrow="진행도"
      title={`${getWorkTypeLabel(work.type)} 진행 상황`}
    >
      <QuickProgressControl onSave={handleSave} work={work} />
    </PageSection>
  );
}

function ReleaseRecordRow({
  record,
  release,
  workId,
  onError,
  onSuccess,
}: {
  record: UserReleaseRecord | null;
  release: UserRecordReleasesResponse['releases'][number];
  workId: string;
  onError(message: string | null): void;
  onSuccess(message: string): void;
}) {
  const [status, setStatus] = useState<WorkStatus>(record?.status ?? 'planned');
  const [rating, setRating] = useState(record?.rating?.toString() ?? '');
  const [shortReview, setShortReview] = useState(record?.shortReview ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStatus(record?.status ?? 'planned');
    setRating(record?.rating?.toString() ?? '');
    setShortReview(record?.shortReview ?? '');
  }, [record?.id, record?.rating, record?.shortReview, record?.status]);

  async function handleSave() {
    const parsedRating = rating === '' ? null : Number.parseFloat(rating);

    try {
      setIsSaving(true);
      onError(null);
      await releaseRecordsService.upsertReleaseRecord({
        catalogReleaseId: release.id,
        rating: Number.isNaN(parsedRating) ? null : parsedRating,
        shortReview,
        status,
        userWorkRecordId: workId,
      });
      onSuccess('권별 기록을 저장했습니다.');
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '권별 기록을 저장하지 못했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteOrRestore() {
    if (!record) {
      return;
    }

    try {
      setIsSaving(true);
      onError(null);

      if (record.deletedAt) {
        await releaseRecordsService.restoreReleaseRecord(record.id);
        onSuccess('권별 기록을 복원했습니다.');
      } else {
        await releaseRecordsService.deleteReleaseRecord(record.id);
        onSuccess('권별 기록을 삭제했습니다.');
      }
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '권별 기록 상태를 바꾸지 못했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const label =
    release.displayLabel ||
    release.title ||
    `#${release.sequence ?? release.id}`;

  return (
    <SectionCard gap="md" padding="lg" tone="subtle">
      <Stack gap="xs">
        <Text fw={700}>{label}</Text>
        <Text c="var(--mantine-color-dimmed)" size="sm">
          {release.isbn
            ? `ISBN ${release.isbn}`
            : release.releaseType || '하위 릴리스'}
          {record?.deletedAt ? ' · 삭제됨' : ''}
        </Text>
      </Stack>
      <Group align="flex-end" grow>
        <NativeSelect
          label="상태"
          onChange={(event) =>
            setStatus(event.currentTarget.value as WorkStatus)
          }
          value={status}
        >
          {workStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          label="권별 별점"
          onChange={(event) => setRating(event.currentTarget.value)}
          value={rating}
        >
          <option value="">미평가</option>
          {ratingOptions.map((option) => (
            <option key={option.value} value={option.value.toString()}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </Group>
      <TextInput
        label="권별 짧은 감상"
        maxLength={500}
        onChange={(event) => setShortReview(event.currentTarget.value)}
        placeholder="선택 입력"
        value={shortReview}
      />
      <Group justify="space-between">
        <Text c="var(--mantine-color-dimmed)" size="sm">
          이 기록은 작품 전체 별점/리뷰와 별도로 저장됩니다.
        </Text>
        <Group>
          {record && (
            <AppButton
              disabled={isSaving}
              onClick={() => void handleDeleteOrRestore()}
              tone="ghost"
              type="button"
            >
              {record.deletedAt ? '복원' : '삭제'}
            </AppButton>
          )}
          <AppButton
            disabled={isSaving}
            onClick={() => void handleSave()}
            tone="primary"
            type="button"
          >
            권별 기록 저장
          </AppButton>
        </Group>
      </Group>
    </SectionCard>
  );
}

function VolumeRecordsSection({
  localRecords,
  onError,
  onSuccess,
  releaseData,
  work,
}: {
  localRecords: UserReleaseRecord[];
  onError(message: string | null): void;
  onSuccess(message: string): void;
  releaseData: UserRecordReleasesResponse | null;
  work: WorkRecord;
}) {
  if (!isVolumeRecordableWorkType(work.type) || !releaseData) {
    return null;
  }

  if (
    !releaseData.policy.releaseRecordsSupported ||
    releaseData.releases.length === 0
  ) {
    return null;
  }

  const localByReleaseId = new Map(
    localRecords.map((record) => [record.catalogReleaseId, record]),
  );

  return (
    <PageSection
      description="작품 등록은 항상 title-level로 유지하고, 권별 기록은 필요할 때만 접어서 남깁니다."
      eyebrow="선택 기록"
      title="권별 기록"
    >
      <Accordion variant="separated">
        <Accordion.Item value="volume-records">
          <Accordion.Control>권별 별점과 짧은 감상 남기기</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              {releaseData.releases.map((release) => (
                <ReleaseRecordRow
                  key={release.id}
                  onError={onError}
                  onSuccess={onSuccess}
                  record={
                    localByReleaseId.get(release.id) ??
                    release.userReleaseRecord
                  }
                  release={release}
                  workId={work.id}
                />
              ))}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </PageSection>
  );
}

function LocalSeriesSection({
  currentWork,
  graph,
  works,
}: {
  currentWork: WorkRecord;
  graph: WorkGraphSnapshot | null;
  works: WorkRecord[];
}) {
  const seriesById = new Map(
    graph?.series.map((series) => [series.id, series]) ?? [],
  );
  const currentSeriesIds = new Set(
    graph?.workSeriesLinks
      .filter((link) => link.workId === currentWork.id)
      .map((link) => link.seriesId) ?? [],
  );
  const seriesValues =
    currentSeriesIds.size > 0
      ? Array.from(currentSeriesIds)
          .map((seriesId) => seriesById.get(seriesId)?.title ?? '')
          .filter(Boolean)
      : getSeriesTagValues(currentWork.personalTags);

  if (seriesValues.length === 0) {
    return null;
  }

  const sameSeriesWorks =
    currentSeriesIds.size > 0 && graph
      ? works
          .filter((work) => work.id !== currentWork.id)
          .filter((work) =>
            graph.workSeriesLinks.some(
              (link) =>
                link.workId === work.id && currentSeriesIds.has(link.seriesId),
            ),
          )
          .sort((left, right) => left.title.localeCompare(right.title))
          .slice(0, 8)
      : (() => {
          const normalizedSeriesValues = new Set(
            seriesValues.map((value) => value.trim().toLowerCase()),
          );

          return works
            .filter((work) => work.id !== currentWork.id)
            .filter((work) =>
              getSeriesTagValues(work.personalTags).some((value) =>
                normalizedSeriesValues.has(value.trim().toLowerCase()),
              ),
            )
            .sort((left, right) => left.title.localeCompare(right.title))
            .slice(0, 8);
        })();

  if (sameSeriesWorks.length === 0) {
    return null;
  }

  return (
    <PageSection
      description="로컬 기록의 시리즈/세계관 태그로 묶은 작품입니다."
      eyebrow="시리즈"
      title="이 시리즈 안에서"
    >
      <Stack gap="md">
        {sameSeriesWorks.map((work) => (
          <SectionCard key={work.id} gap="xs" padding="lg" tone="subtle">
            <Group justify="space-between">
              <Stack gap={4}>
                <Text fw={700}>{work.title}</Text>
                <Text c="var(--mantine-color-dimmed)" size="sm">
                  {getWorkTypeLabel(work.type)}
                  {work.rating !== null ? ` · ★ ${work.rating.toFixed(1)}` : ''}
                </Text>
              </Stack>
              <AppLinkButton to={`/works/${work.id}`} tone="quiet">
                보기
              </AppLinkButton>
            </Group>
          </SectionCard>
        ))}
      </Stack>
    </PageSection>
  );
}

function RelatedTitlesSection({
  relatedData,
}: {
  relatedData: RelatedCatalogTitlesResponse | null;
}) {
  if (!relatedData) {
    return null;
  }

  const seenTitleIds = new Set<string>();
  const relatedEntries = [
    ...relatedData.sameFranchiseTitles.map((title) => {
      seenTitleIds.add(title.id);

      return {
        relationDirection: title.relationDirection ?? null,
        relationType: title.relationType ?? null,
        targetTitle: title,
      };
    }),
    ...relatedData.relations
      .map((relation) => ({
        relationDirection: relation.relationDirection,
        relationType: relation.relationType,
        targetTitle: relation.targetTitle,
      }))
      .filter((title) => {
        if (seenTitleIds.has(title.targetTitle.id)) {
          return false;
        }

        seenTitleIds.add(title.targetTitle.id);

        return true;
      }),
  ];

  if (relatedEntries.length === 0) {
    return null;
  }

  return (
    <PageSection
      description="같은 Franchise 안의 후속작, 외전, 각색 작품은 별도 title-level 기록 대상으로 봅니다."
      eyebrow="관련 작품"
      title="관련 작품"
    >
      <Stack gap="md">
        {relatedEntries.map((relation) => (
          <SectionCard
            key={relation.targetTitle.id}
            gap="xs"
            padding="lg"
            tone="subtle"
          >
            <Group justify="space-between">
              <Text fw={700}>{relation.targetTitle.title}</Text>
              {relation.relationType ? (
                <Text c="var(--mantine-color-dimmed)" size="sm">
                  {relationTypeLabels[relation.relationType] ??
                    relation.relationType}
                </Text>
              ) : null}
            </Group>
            <Text c="var(--mantine-color-dimmed)" size="sm">
              {getWorkTypeLabel(relation.targetTitle.mediumType)}
              {relation.targetTitle.subType
                ? ` · ${relation.targetTitle.subType}`
                : ''}
              {relation.targetTitle.releaseYear
                ? ` · ${relation.targetTitle.releaseYear}`
                : ''}
            </Text>
          </SectionCard>
        ))}
      </Stack>
    </PageSection>
  );
}

export function WorkDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { archiveScopeKey, mode } = useAuthSession();
  const { error, isLoading, work } = useWorkDetail(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const routeFeedback =
    getRouteFeedback(location.state) ?? getSavedFeedback(searchParams.get('saved'));
  const [actionSuccess, setActionSuccess] = useState<string | null>(
    () => routeFeedback,
  );
  const [releaseData, setReleaseData] =
    useState<UserRecordReleasesResponse | null>(null);
  const [relatedData, setRelatedData] =
    useState<RelatedCatalogTitlesResponse | null>(null);
  const [localReleaseRecords, setLocalReleaseRecords] = useState<
    UserReleaseRecord[]
  >([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntryRecord[]>(
    [],
  );
  const [localWorks, setLocalWorks] = useState<WorkRecord[]>([]);
  const [localGraph, setLocalGraph] = useState<WorkGraphSnapshot | null>(null);
  const workCatalogTitleId = work?.catalogTitleId ?? null;
  const workId = work?.id ?? null;
  const workType = work?.type ?? null;

  function handleActionError(message: string | null) {
    setActionError(message);

    if (message) {
      setActionSuccess(null);
    }
  }

  function handleActionSuccess(message: string) {
    setActionError(null);
    setActionSuccess(message);
  }

  useEffect(() => {
    if (!workId) {
      return;
    }

    recentWorkViewsService.recordView(archiveScopeKey, workId);
  }, [archiveScopeKey, workId]);

  useEffect(() => {
    if (!routeFeedback) {
      return;
    }

    setActionError(null);
    setActionSuccess(routeFeedback);
  }, [routeFeedback]);

  useEffect(() => {
    if (!actionSuccess) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setActionSuccess(null);
    }, 30_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionSuccess]);

  useEffect(() => {
    if (!workId) {
      setLocalReleaseRecords([]);

      return undefined;
    }

    const subscription = liveQuery(() =>
      releaseRecordsService.listByUserWorkRecord(workId),
    ).subscribe({
      next: setLocalReleaseRecords,
      error: () => {
        setLocalReleaseRecords([]);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey, workId]);

  useEffect(() => {
    if (!workId) {
      setTimelineEntries([]);

      return undefined;
    }

    const subscription = liveQuery(() =>
      timelineEntriesRepository.listByWorkId(workId),
    ).subscribe({
      next: setTimelineEntries,
      error: () => {
        setTimelineEntries([]);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey, workId]);

  useEffect(() => {
    const subscription = liveQuery(() => worksRepository.listActive()).subscribe({
      next: setLocalWorks,
      error: () => setLocalWorks([]),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

  useEffect(() => {
    const subscription = liveQuery(() =>
      graphRepository.listActiveGraph(),
    ).subscribe({
      next: setLocalGraph,
      error: () => setLocalGraph(null),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

  useEffect(() => {
    let isActive = true;

    async function loadReleaseData() {
      if (
        !workId ||
        mode !== 'authenticated' ||
        !workCatalogTitleId ||
        !workType ||
        !isVolumeRecordableWorkType(workType)
      ) {
        setReleaseData(null);

        return;
      }

      try {
        const response = await fetchUserRecordReleases(workId);

        if (isActive) {
          setReleaseData(response);
        }
      } catch {
        if (isActive) {
          setReleaseData(null);
        }
      }
    }

    void loadReleaseData();

    return () => {
      isActive = false;
    };
  }, [mode, workCatalogTitleId, workId, workType]);

  useEffect(() => {
    let isActive = true;

    async function loadRelatedTitles() {
      if (!workCatalogTitleId || mode !== 'authenticated') {
        setRelatedData(null);

        return;
      }

      try {
        const response = await fetchRelatedCatalogTitles(workCatalogTitleId);

        if (isActive) {
          setRelatedData(response);
        }
      } catch {
        if (isActive) {
          setRelatedData(null);
        }
      }
    }

    void loadRelatedTitles();

    return () => {
      isActive = false;
    };
  }, [mode, workCatalogTitleId]);

  async function handleDelete() {
    if (!work) {
      return;
    }

    const shouldDelete = await confirmDialogAdapter.confirm({
      description:
        '작품 목록에서는 숨겨지고 휴지통에서 복원할 수 있습니다.',
      title: `"${work.title}"을 삭제할까요?`,
    });

    if (!shouldDelete) {
      return;
    }

    try {
      setActionError(null);
      setActionSuccess(null);
      await worksService.deleteWork(work.id);
      navigate('/works', {
        state: {
          deletedWork: work,
        },
      });
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : '작품을 삭제하지 못했습니다.',
      );
    }
  }

  async function handleCreateTimelineEntry(input: {
    note: string;
    occurredAt: string;
    type: TimelineEntryType;
  }) {
    if (!work) {
      return;
    }

    try {
      setActionError(null);
      setActionSuccess(null);
      await timelineEntriesService.createTimelineEntry({
        ...input,
        workId: work.id,
      });
      handleActionSuccess('타임라인 기록을 추가했습니다.');
    } catch (timelineError) {
      setActionError(
        timelineError instanceof Error
          ? timelineError.message
          : '타임라인 기록을 추가하지 못했습니다.',
      );
    }
  }

  async function handleDeleteTimelineEntry(id: string) {
    try {
      setActionError(null);
      setActionSuccess(null);
      await timelineEntriesService.deleteTimelineEntry(id);
      handleActionSuccess('타임라인 기록을 삭제했습니다.');
    } catch (timelineError) {
      setActionError(
        timelineError instanceof Error
          ? timelineError.message
          : '타임라인 기록을 삭제하지 못했습니다.',
      );
    }
  }

  if (error) {
    return (
      <StateMessage
        description={error}
        title="작품 정보를 불러오지 못했습니다."
        tone="error"
      />
    );
  }

  if (isLoading) {
    return <LoadingState rows={3} title="작품 정보를 불러오는 중입니다" />;
  }

  if (!work) {
    return (
      <StateMessage
        actions={
          <AppLinkButton to="/works" tone="primary">
            작품으로 돌아가기
          </AppLinkButton>
        }
        description="삭제되었거나 주소가 올바르지 않을 수 있습니다."
        eyebrow="찾을 수 없음"
        title="해당 작품을 찾을 수 없습니다."
        tone="info"
      />
    );
  }

  const currentWorkGraph: WorkGraphSnapshot | null = localGraph
    ? {
        contributors: localGraph.contributors,
        relations: localGraph.relations.filter(
          (relation) =>
            relation.sourceWorkId === work.id || relation.targetWorkId === work.id,
        ),
        series: localGraph.series,
        workContributors: localGraph.workContributors.filter(
          (link) => link.workId === work.id,
        ),
        workRelations: localGraph.workRelations.filter(
          (relation) =>
            relation.sourceWorkId === work.id || relation.targetWorkId === work.id,
        ),
        workSeriesLinks: localGraph.workSeriesLinks.filter(
          (link) => link.workId === work.id,
        ),
      }
    : null;

  return (
    <DetailPageTemplate>
      {actionError && (
        <FeedbackMessage tone="error">{actionError}</FeedbackMessage>
      )}
      {actionSuccess && (
        <FeedbackMessage tone="success">{actionSuccess}</FeedbackMessage>
      )}

      <WorkDetailPanel
        actions={
          <>
            <AppLinkButton to="/works" tone="quiet">
              작품으로 돌아가기
            </AppLinkButton>
            <AppLinkButton
              to={`/works/${work.id}/edit?focus=review`}
              tone="primary"
            >
              {work.shortReview.trim() || work.review.trim()
                ? '리뷰 수정'
                : '리뷰 쓰기'}
            </AppLinkButton>
            <AppLinkButton to={`/works/${work.id}/edit`} tone="ghost">
              수정
            </AppLinkButton>
          </>
        }
        onCreateTimelineEntry={handleCreateTimelineEntry}
        onDeleteTimelineEntry={handleDeleteTimelineEntry}
        graph={currentWorkGraph}
        overviewSections={
          <WorkQuickRecordSection
            onError={handleActionError}
            onSuccess={handleActionSuccess}
            work={work}
          />
        }
        progressSections={
          <>
            <ProgressOnlySection
              onError={handleActionError}
              onSuccess={handleActionSuccess}
              work={work}
            />
            <VolumeRecordsSection
              localRecords={localReleaseRecords}
              onError={handleActionError}
              onSuccess={handleActionSuccess}
              releaseData={releaseData}
              work={work}
            />
          </>
        }
        relatedSections={
          <>
            <LocalSeriesSection
              currentWork={work}
              graph={localGraph}
              works={localWorks}
            />
            <RelatedTitlesSection relatedData={relatedData} />
          </>
        }
        timelineEntries={timelineEntries}
        work={work}
      />

      <PageSection
        description="삭제하면 작품 목록에서는 숨겨지고, 휴지통에서 복원할 수 있습니다."
        eyebrow="위험 작업"
        title="기록 관리"
      >
        <SectionCard gap="md" padding="lg" tone="subtle">
          <Group align="center" justify="space-between" wrap="wrap">
            <Stack gap={4}>
              <Text fw={700}>작품을 휴지통으로 이동</Text>
              <Text c="var(--mantine-color-dimmed)" size="sm">
                기록은 즉시 완전 삭제되지 않습니다. 작품의 휴지통 보기에서 다시 복원할 수 있습니다.
              </Text>
            </Stack>
            <AppButton
              onClick={() => void handleDelete()}
              tone="danger"
              type="button"
            >
              휴지통으로 이동
            </AppButton>
          </Group>
        </SectionCard>
      </PageSection>
    </DetailPageTemplate>
  );
}
