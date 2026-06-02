import { useEffect, useMemo, useState } from 'react';
import {
  Checkbox,
  Divider,
  Group,
  Radio,
  Select,
  Stack,
  Text,
} from '@mantine/core';

import {
  ActionRow,
  AppBadge,
  AppButton,
  FeedbackMessage,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import {
  type DuplicateCandidateGroup,
  duplicateCleanupService,
  formatWorkUpdatedAt,
  getWorkStatusLabel,
  getWorkTypeLabel,
  type DuplicateMergePreview,
  type DuplicateMergeScalarField,
} from '@features/works';
import styles from './SettingsControlCenter.module.css';
import { cx } from '@shared/utils/class-names';

const css = styles;

interface DuplicateCleanupSettingsSectionProps {
  archiveScopeKey: string;
}

interface DuplicateGroupCardProps {
  group: DuplicateCandidateGroup;
  onChanged: () => Promise<void>;
}

function formatMergeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '비어 있음';
  }

  if (typeof value === 'boolean') {
    return value ? '예' : '아니요';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'externalRefs' in value &&
    Array.isArray(value.externalRefs)
  ) {
    const refs = value.externalRefs
      .map((ref) =>
        typeof ref === 'object' &&
        ref !== null &&
        'provider' in ref &&
        'externalId' in ref
          ? `${String(ref.provider)}:${String(ref.externalId)}`
          : '',
      )
      .filter(Boolean);

    return refs.length > 0 ? refs.join(', ') : '가져오기 원본 있음';
  }

  return JSON.stringify(value);
}

function formatWorkSummary(work: DuplicateCandidateGroup['works'][number]) {
  const rating = work.rating === null ? '미평가' : `★ ${work.rating}`;

  return [
    getWorkTypeLabel(work.type),
    getWorkStatusLabel(work.status),
    rating,
    formatWorkUpdatedAt(work.updatedAt),
  ].join(' · ');
}

function DuplicateGroupCard({ group, onChanged }: DuplicateGroupCardProps) {
  const [targetWorkId, setTargetWorkId] = useState(group.works[0]?.id ?? '');
  const [sourceWorkIds, setSourceWorkIds] = useState<string[]>(
    group.works.slice(1).map((work) => work.id),
  );
  const [preview, setPreview] = useState<DuplicateMergePreview | null>(null);
  const [scalarSelections, setScalarSelections] = useState<
    Partial<Record<DuplicateMergeScalarField, string>>
  >({});
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: 'error' | 'success';
  } | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const targetOptions = group.works.map((work) => ({
    label: `${work.title} · ${formatWorkUpdatedAt(work.updatedAt)}`,
    value: work.id,
  }));
  const sourceCandidates = group.works.filter(
    (work) => work.id !== targetWorkId,
  );
  const selectedSourceSet = useMemo(
    () => new Set(sourceWorkIds),
    [sourceWorkIds],
  );
  const hasUnresolvedConflict = preview
    ? preview.conflicts.some((conflict) => !scalarSelections[conflict.field])
    : true;

  useEffect(() => {
    setTargetWorkId(group.works[0]?.id ?? '');
    setSourceWorkIds(group.works.slice(1).map((work) => work.id));
    setPreview(null);
    setScalarSelections({});
    setFeedback(null);
  }, [group.id, group.works]);

  function changeTarget(nextTargetWorkId: string | null) {
    if (!nextTargetWorkId) {
      return;
    }

    setTargetWorkId(nextTargetWorkId);
    setSourceWorkIds(
      group.works
        .filter((work) => work.id !== nextTargetWorkId)
        .map((work) => work.id),
    );
    setPreview(null);
    setScalarSelections({});
  }

  function toggleSource(workId: string, checked: boolean) {
    setSourceWorkIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(workId);
      } else {
        next.delete(workId);
      }

      return [...next];
    });
    setPreview(null);
    setScalarSelections({});
  }

  async function ignoreGroup() {
    setIsWorking(true);
    setFeedback(null);

    try {
      await duplicateCleanupService.markGroupNotDuplicate(
        group.works.map((work) => work.id),
      );
      await onChanged();
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : '중복 제외 결정을 저장하지 못했습니다.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function prepareMerge() {
    setIsWorking(true);
    setFeedback(null);

    try {
      const nextPreview = await duplicateCleanupService.getMergePreview({
        sourceWorkIds,
        targetWorkId,
      });

      setScalarSelections({});
      setPreview(nextPreview);
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : '병합 미리보기를 만들지 못했습니다.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function mergeGroup() {
    setIsWorking(true);
    setFeedback(null);

    try {
      await duplicateCleanupService.mergeDuplicates({
        scalarSelections,
        sourceWorkIds,
        targetWorkId,
      });
      setFeedback({
        message: '선택한 중복 작품을 병합했습니다.',
        tone: 'success',
      });
      await onChanged();
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : '선택한 중복 작품을 병합하지 못했습니다.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className={css.duplicateGroupCard ?? ''}>
      <Stack gap="md">
        <Group align="flex-start" justify="space-between">
          <Stack gap={4}>
            <Text fw={850}>{group.works[0]?.title ?? '중복 후보'}</Text>
            <Text c="dimmed" size="sm">
              {group.works.length}개 기록 · {group.reasons[0]?.label}
            </Text>
          </Stack>
          <AppBadge tone="warning">
            {Math.round((group.reasons[0]?.confidence ?? 0) * 100)}%
          </AppBadge>
        </Group>

        <div className={css.duplicateReasonList ?? ''}>
          {group.reasons.map((reason) => (
            <div
              key={`${reason.rule}:${reason.evidence}`}
              className={css.duplicateReason ?? ''}
            >
              <Text fw={750} size="sm">
                {reason.label}
              </Text>
              <Text c="dimmed" size="xs">
                {reason.evidence}
              </Text>
            </div>
          ))}
        </div>

        <div className={css.duplicateWorkGrid ?? ''}>
          {group.works.map((work) => (
            <div
              className={cx(
                css.duplicateWorkCard ?? '',
                work.id === targetWorkId && (css.duplicateWorkCardTarget ?? ''),
              )}
              key={work.id}
            >
              <Text fw={800} lineClamp={2}>
                {work.title}
              </Text>
              <Text c="dimmed" lineClamp={1} size="sm">
                {work.author.trim() || '작가 미입력'}
              </Text>
              <Text c="dimmed" size="xs">
                {formatWorkSummary(work)}
              </Text>
            </div>
          ))}
        </div>

        <Divider />

        <Stack gap="sm">
          <Select
            data={targetOptions}
            label="남길 기준 기록"
            onChange={changeTarget}
            value={targetWorkId}
          />

          <Stack gap={6}>
            <Text fw={750} size="sm">
              병합할 중복 기록
            </Text>
            {sourceCandidates.map((work) => (
              <Checkbox
                checked={selectedSourceSet.has(work.id)}
                key={work.id}
                label={`${work.title} · ${formatWorkUpdatedAt(work.updatedAt)}`}
                onChange={(event) =>
                  toggleSource(work.id, event.currentTarget.checked)
                }
              />
            ))}
          </Stack>
        </Stack>

        {preview && (
          <Stack gap="md">
            <div className={css.duplicateMergeSummary ?? ''}>
              <Text size="sm">
                태그 {preview.unionPersonalTags.length}개, 장르{' '}
                {preview.unionGenres.length}개를 합치고 타임라인{' '}
                {preview.timelineEntryCopies}개, 릴리스 기록{' '}
                {preview.releaseRecordCopies}개를 기준 기록으로 복사합니다.
              </Text>
            </div>

            {preview.conflicts.map((conflict) => (
              <Radio.Group
                key={conflict.field}
                label={`${conflict.label} 선택`}
                onChange={(value) =>
                  setScalarSelections((current) => ({
                    ...current,
                    [conflict.field]: value,
                  }))
                }
                value={scalarSelections[conflict.field] ?? ''}
              >
                <Stack gap={6} mt={6}>
                  {conflict.options.map((option) => (
                    <Radio
                      key={`${conflict.field}:${option.workId}`}
                      label={`${formatMergeValue(option.value)}${
                        option.isSuggested ? ' · 최신 수정 기준' : ''
                      }`}
                      value={option.workId}
                    />
                  ))}
                </Stack>
              </Radio.Group>
            ))}
          </Stack>
        )}

        {feedback && (
          <FeedbackMessage tone={feedback.tone}>
            {feedback.message}
          </FeedbackMessage>
        )}

        <ActionRow justify="space-between">
          <AppButton
            disabled={isWorking}
            onClick={() => void ignoreGroup()}
            tone="quiet"
            type="button"
          >
            중복 아님
          </AppButton>
          <Group gap="sm">
            <AppButton
              disabled={sourceWorkIds.length === 0 || isWorking}
              loading={isWorking && !preview}
              onClick={() => void prepareMerge()}
              type="button"
            >
              병합 검토
            </AppButton>
            <AppButton
              disabled={
                !preview ||
                hasUnresolvedConflict ||
                sourceWorkIds.length === 0 ||
                isWorking
              }
              loading={isWorking && Boolean(preview)}
              onClick={() => void mergeGroup()}
              tone="primary"
              type="button"
            >
              선택 기록 병합
            </AppButton>
          </Group>
        </ActionRow>
      </Stack>
    </div>
  );
}

export function DuplicateCleanupSettingsSection({
  archiveScopeKey,
}: DuplicateCleanupSettingsSectionProps) {
  const [groups, setGroups] = useState<DuplicateCandidateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadGroups() {
    setIsLoading(true);
    setFeedback(null);

    try {
      setGroups(await duplicateCleanupService.listDuplicateCandidateGroups());
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : '중복 후보를 불러오지 못했습니다.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadGroups();
  }, [archiveScopeKey]);

  return (
    <SectionCard>
      <SectionIntro
        description="현재 브라우저의 로컬 아카이브 안에서만 중복 후보를 찾고 병합합니다. 제외 결정도 로컬에만 저장됩니다."
        eyebrow="데이터 안전"
        title="중복 정리"
      />

      <ActionRow justify="space-between">
        <Group gap="sm">
          <AppBadge tone={groups.length > 0 ? 'warning' : 'success'}>
            {groups.length}개 후보 그룹
          </AppBadge>
          <Text c="dimmed" size="sm">
            카탈로그 ID, 가져오기 원본, 제목/유형/작가를 보수적으로 비교합니다.
          </Text>
        </Group>
        <AppButton
          disabled={isLoading}
          loading={isLoading}
          onClick={() => void loadGroups()}
          type="button"
        >
          다시 검사
        </AppButton>
      </ActionRow>

      {feedback && <FeedbackMessage>{feedback}</FeedbackMessage>}

      {!isLoading && groups.length === 0 && !feedback && (
        <FeedbackMessage tone="success">
          현재 확인할 중복 후보가 없습니다.
        </FeedbackMessage>
      )}

      <Stack gap="md">
        {groups.map((group) => (
          <DuplicateGroupCard
            group={group}
            key={group.id}
            onChanged={loadGroups}
          />
        ))}
      </Stack>
    </SectionCard>
  );
}
