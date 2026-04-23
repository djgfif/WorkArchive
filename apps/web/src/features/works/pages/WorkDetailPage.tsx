import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { Accordion, Group, NativeSelect, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';

import {
  canUseProgressUnitForWorkType,
  getDefaultProgressUnitForWorkType,
  isProgressOnlyWorkType,
  isVolumeRecordableWorkType,
  type ProgressUnit,
  type UserReleaseRecord,
  type WorkRecord,
  type WorkStatus,
} from '@work-archive/shared-types';

import {
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  PageSection,
  SectionCard,
  SectionIntro,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { DetailPageTemplate } from '../../../shared/components/PageTemplates';
import { confirmDialogAdapter } from '../../../shared/runtime/dialog-adapter';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { WorkDetailPanel } from '../components/WorkDetailPanel';
import { useWorkDetail } from '../hooks/useWorkDetail';
import { releaseRecordsService } from '../services/release-records.service';
import {
  fetchRelatedCatalogTitles,
  fetchUserRecordReleases,
  type RelatedCatalogTitlesResponse,
  type UserRecordReleasesResponse,
} from '../services/user-records.api';
import { worksService } from '../services/works.service';
import { createUpsertWorkInputFromRecord } from '../utils/work-form';
import {
  getWorkTypeLabel,
  workStatusOptions,
} from '../utils/work-options';

const ratingOptions = Array.from({ length: 10 }, (_, index) => {
  const value = (index + 1) * 0.5;

  return {
    label: `${value.toFixed(1)}점`,
    value,
  };
});

const progressUnitLabels: Record<ProgressUnit, string> = {
  chapter: '화',
  episode: '회',
  volume: '권',
};

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

function coerceNumberInputValue(value: number | string) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? null : parsed;
}

function ProgressOnlySection({
  onError,
  work,
}: {
  onError(message: string | null): void;
  work: WorkRecord;
}) {
  const defaultUnit = getDefaultProgressUnitForWorkType(work.type);
  const [current, setCurrent] = useState<number | null>(
    work.progressCurrent ?? null,
  );
  const [total, setTotal] = useState<number | null>(work.progressTotal ?? null);
  const [lastLabel, setLastLabel] = useState(work.lastConsumedLabel ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCurrent(work.progressCurrent ?? null);
    setTotal(work.progressTotal ?? null);
    setLastLabel(work.lastConsumedLabel ?? '');
  }, [
    work.id,
    work.lastConsumedLabel,
    work.progressCurrent,
    work.progressTotal,
  ]);

  if (!isProgressOnlyWorkType(work.type) || defaultUnit === null) {
    return null;
  }

  async function handleSave() {
    if (defaultUnit === null) {
      return;
    }

    if (!canUseProgressUnitForWorkType(work.type, defaultUnit)) {
      onError('이 작품 유형에는 진행도 기록을 사용할 수 없습니다.');

      return;
    }

    if (current !== null && total !== null && current > total) {
      onError('현재 진행도가 전체 진행도보다 클 수 없습니다.');

      return;
    }

    try {
      setIsSaving(true);
      onError(null);
      await worksService.updateProgress(work.id, {
        lastConsumedLabel: lastLabel,
        progressCurrent: current,
        progressTotal: total,
        progressUnit: defaultUnit,
      });
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : '진행도를 저장하지 못했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageSection
      description="회차별 별점과 리뷰는 만들지 않고, title-level 진행도만 기록합니다."
      eyebrow="진행도"
      title={`${getWorkTypeLabel(work.type)} 진행 상황`}
    >
      <SectionCard gap="md" padding="lg" tone="default">
        <Group align="flex-end" grow>
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            label={`현재 ${progressUnitLabels[defaultUnit]}`}
            min={0}
            onChange={(value) => setCurrent(coerceNumberInputValue(value))}
            value={current ?? ''}
          />
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            label={`전체 ${progressUnitLabels[defaultUnit]}`}
            min={0}
            onChange={(value) => setTotal(coerceNumberInputValue(value))}
            value={total ?? ''}
          />
        </Group>
        <TextInput
          label="마지막으로 본 위치"
          maxLength={120}
          onChange={(event) => setLastLabel(event.currentTarget.value)}
          placeholder={`예: ${current ?? 18}${progressUnitLabels[defaultUnit]}`}
          value={lastLabel}
        />
        <Group justify="space-between">
          <Text c="var(--app-text-muted)" size="sm">
            애니/드라마는 시즌·OVA·극장판을 별도 작품으로 관리하고, 에피소드는 진행도만 남깁니다.
          </Text>
          <AppButton
            disabled={isSaving}
            onClick={() => void handleSave()}
            tone="primary"
            type="button"
          >
            진행도 저장
          </AppButton>
        </Group>
      </SectionCard>
    </PageSection>
  );
}

function ReleaseRecordRow({
  record,
  release,
  workId,
  onError,
}: {
  record: UserReleaseRecord | null;
  release: UserRecordReleasesResponse['releases'][number];
  workId: string;
  onError(message: string | null): void;
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
      } else {
        await releaseRecordsService.deleteReleaseRecord(record.id);
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
    release.displayLabel || release.title || `#${release.sequence ?? release.id}`;

  return (
    <SectionCard gap="md" padding="lg" tone="subtle">
      <Stack gap="xs">
        <Text fw={700}>{label}</Text>
        <Text c="var(--app-text-muted)" size="sm">
          {release.isbn ? `ISBN ${release.isbn}` : release.releaseType || '하위 릴리스'}
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
        <Text c="var(--app-text-muted)" size="sm">
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
  releaseData,
  work,
}: {
  localRecords: UserReleaseRecord[];
  onError(message: string | null): void;
  releaseData: UserRecordReleasesResponse | null;
  work: WorkRecord;
}) {
  if (!isVolumeRecordableWorkType(work.type) || !releaseData) {
    return null;
  }

  if (!releaseData.policy.releaseRecordsSupported || releaseData.releases.length === 0) {
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
          <Accordion.Control>
            권별 별점과 짧은 감상 남기기
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              {releaseData.releases.map((release) => (
                <ReleaseRecordRow
                  key={release.id}
                  onError={onError}
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

function RelatedTitlesSection({
  relatedData,
}: {
  relatedData: RelatedCatalogTitlesResponse | null;
}) {
  if (!relatedData || relatedData.relations.length === 0) {
    return null;
  }

  return (
    <PageSection
      description="같은 Franchise 안의 후속작, 외전, 각색 작품은 별도 title-level 기록 대상으로 봅니다."
      eyebrow="관련 작품"
      title="같은 IP의 다른 타이틀"
    >
      <Stack gap="md">
        {relatedData.relations.map((relation) => (
          <SectionCard
            key={`${relation.relationType}-${relation.targetTitle.id}`}
            gap="xs"
            padding="lg"
            tone="subtle"
          >
            <Group justify="space-between">
              <Text fw={700}>{relation.targetTitle.title}</Text>
              <Text c="var(--app-text-muted)" size="sm">
                {relationTypeLabels[relation.relationType] ??
                  relation.relationType}
              </Text>
            </Group>
            <Text c="var(--app-text-muted)" size="sm">
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
  const navigate = useNavigate();
  const { archiveScopeKey, mode } = useAuthSession();
  const { error, isLoading, work } = useWorkDetail(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isQuickUpdating, setIsQuickUpdating] = useState(false);
  const [releaseData, setReleaseData] =
    useState<UserRecordReleasesResponse | null>(null);
  const [relatedData, setRelatedData] =
    useState<RelatedCatalogTitlesResponse | null>(null);
  const [localReleaseRecords, setLocalReleaseRecords] = useState<
    UserReleaseRecord[]
  >([]);

  useEffect(() => {
    if (!work) {
      setLocalReleaseRecords([]);

      return undefined;
    }

    const subscription = liveQuery(() =>
      releaseRecordsService.listByUserWorkRecord(work.id),
    ).subscribe({
      next: setLocalReleaseRecords,
      error: () => {
        setLocalReleaseRecords([]);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey, work?.id]);

  useEffect(() => {
    let isActive = true;

    async function loadReleaseData() {
      if (
        !work ||
        mode !== 'authenticated' ||
        !work.catalogTitleId ||
        !isVolumeRecordableWorkType(work.type)
      ) {
        setReleaseData(null);

        return;
      }

      try {
        const response = await fetchUserRecordReleases(work.id);

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
  }, [mode, work?.catalogTitleId, work?.id, work?.type]);

  useEffect(() => {
    let isActive = true;

    async function loadRelatedTitles() {
      if (!work?.catalogTitleId || mode !== 'authenticated') {
        setRelatedData(null);

        return;
      }

      try {
        const response = await fetchRelatedCatalogTitles(work.catalogTitleId);

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
  }, [mode, work?.catalogTitleId]);

  async function handleDelete() {
    if (!work) {
      return;
    }

    const shouldDelete = await confirmDialogAdapter.confirm({
      description: '현재는 목록에서 숨겨집니다.',
      title: `"${work.title}"을 삭제할까요?`,
    });

    if (!shouldDelete) {
      return;
    }

    try {
      setActionError(null);
      await worksService.deleteWork(work.id);
      navigate('/works');
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : '작품을 삭제하지 못했습니다.',
      );
    }
  }

  async function handleQuickUpdate(nextValues: {
    rating?: number | null;
    status?: (typeof workStatusOptions)[number]['value'];
  }) {
    if (!work) {
      return;
    }

    try {
      setActionError(null);
      setIsQuickUpdating(true);

      const latestWork = await worksService.getWorkById(work.id);

      if (!latestWork) {
        throw new Error('작품을 찾을 수 없습니다.');
      }

      await worksService.updateWork(work.id, {
        ...createUpsertWorkInputFromRecord(latestWork),
        ...nextValues,
      });
    } catch (updateError) {
      setActionError(
        updateError instanceof Error
          ? updateError.message
          : '작품 기록을 바로 수정하지 못했습니다.',
      );
    } finally {
      setIsQuickUpdating(false);
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
    return (
      <StateMessage
        description="잠시만 기다려주세요."
        title="작품 정보를 불러오는 중입니다."
        tone="loading"
      />
    );
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

  return (
    <DetailPageTemplate>
      {actionError && <FeedbackMessage tone="error">{actionError}</FeedbackMessage>}

      <WorkDetailPanel
        actions={
          <>
            <AppLinkButton to="/works" tone="quiet">
              작품으로 돌아가기
            </AppLinkButton>
            <AppLinkButton to={`/works/${work.id}/edit?focus=review`} tone="primary">
              {work.shortReview.trim() || work.review.trim() ? '리뷰 수정' : '리뷰 쓰기'}
            </AppLinkButton>
            <AppLinkButton to={`/works/${work.id}/edit`} tone="ghost">
              수정
            </AppLinkButton>
            <AppButton onClick={() => void handleDelete()} tone="danger" type="button">
              삭제
            </AppButton>
          </>
        }
        quickEdit={
          <Stack gap="md">
            <SectionIntro
              description="상태와 별점은 여기서 바로 반영하고, 긴 리뷰 수정은 상단 액션에서 이어집니다."
              eyebrow="빠른 수정"
              title="기록 상태 조정"
              titleOrder={3}
            />

            <NativeSelect
              aria-label={`${work.title} 상세 상태`}
              disabled={isQuickUpdating}
              id={`detail-status-${work.id}`}
              label="상태"
              onChange={(event) =>
                void handleQuickUpdate({
                  status: event.currentTarget
                    .value as (typeof workStatusOptions)[number]['value'],
                })
              }
              value={work.status}
            >
              {workStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>

            <NativeSelect
              aria-label={`${work.title} 상세 별점`}
              disabled={isQuickUpdating}
              id={`detail-rating-${work.id}`}
              label="별점"
              onChange={(event) => {
                const nextValue =
                  event.currentTarget.value === ''
                    ? null
                    : Number.parseFloat(event.currentTarget.value);

                void handleQuickUpdate({
                  rating: Number.isNaN(nextValue) ? null : nextValue,
                });
              }}
              value={work.rating?.toString() ?? ''}
            >
              <option value="">미평가</option>
              {ratingOptions.map((option) => (
                <option key={option.value} value={option.value.toString()}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>

            <Text c="var(--app-text-muted)" size="sm">
              {isQuickUpdating
                ? '변경 사항을 반영하고 있습니다.'
                : '상태와 별점은 저장 없이 즉시 반영됩니다.'}
            </Text>
          </Stack>
        }
        work={work}
      >
        <ProgressOnlySection onError={setActionError} work={work} />
        <VolumeRecordsSection
          localRecords={localReleaseRecords}
          onError={setActionError}
          releaseData={releaseData}
          work={work}
        />
        <RelatedTitlesSection relatedData={relatedData} />
      </WorkDetailPanel>
    </DetailPageTemplate>
  );
}
