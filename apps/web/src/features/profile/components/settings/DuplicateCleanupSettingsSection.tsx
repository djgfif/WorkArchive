import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { appI18n, formatAppNumber, useAppTranslation } from '@app/i18n';
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

function formatCount(value: number) {
  return formatAppNumber(value);
}

interface DuplicateCleanupSettingsSectionProps {
  archiveScopeKey: string;
}

interface DuplicateGroupCardProps {
  group: DuplicateCandidateGroup;
  onChanged: () => Promise<void>;
}

function formatMergeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return appI18n.t('settings.duplicateCleanup.emptyValue');
  }

  if (typeof value === 'boolean') {
    return value
      ? appI18n.t('settings.duplicateCleanup.yes')
      : appI18n.t('settings.duplicateCleanup.no');
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

    return refs.length > 0
      ? refs.join(', ')
      : appI18n.t('settings.duplicateCleanup.hasImportSource');
  }

  return JSON.stringify(value);
}

function formatWorkSummary(work: DuplicateCandidateGroup['works'][number]) {
  const rating =
    work.rating === null
      ? appI18n.t('settings.duplicateCleanup.noRating')
      : `★ ${work.rating}`;

  return [
    getWorkTypeLabel(work.type),
    getWorkStatusLabel(work.status),
    rating,
    formatWorkUpdatedAt(work.updatedAt),
  ].join(' · ');
}

function DuplicateGroupCard({ group, onChanged }: DuplicateGroupCardProps) {
  const { t } = useAppTranslation();
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
            : t('settings.duplicateCleanup.ignoreError'),
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
            : t('settings.duplicateCleanup.previewError'),
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
        message: t('settings.duplicateCleanup.mergeSuccess'),
        tone: 'success',
      });
      await onChanged();
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : t('settings.duplicateCleanup.mergeError'),
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
            <Text fw={850}>
              {group.works[0]?.title ?? t('settings.duplicateCleanup.candidate')}
            </Text>
            <Text c="dimmed" size="sm">
              {t('settings.duplicateCleanup.groupSummary', {
                count: formatCount(group.works.length),
                reason: group.reasons[0]?.label,
              })}
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
                {work.author.trim() || t('settings.duplicateCleanup.authorMissing')}
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
            label={t('settings.duplicateCleanup.targetLabel')}
            onChange={changeTarget}
            value={targetWorkId}
          />

          <Stack gap={6}>
            <Text fw={750} size="sm">
              {t('settings.duplicateCleanup.sourceLabel')}
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
                {t('settings.duplicateCleanup.mergeSummary', {
                  genres: formatCount(preview.unionGenres.length),
                  releaseRecords: formatCount(preview.releaseRecordCopies),
                  tags: formatCount(preview.unionPersonalTags.length),
                  timelineEntries: formatCount(preview.timelineEntryCopies),
                })}
              </Text>
            </div>

            {preview.conflicts.map((conflict) => (
              <Radio.Group
                key={conflict.field}
                label={t('settings.duplicateCleanup.conflictLabel', {
                  label: conflict.label,
                })}
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
                      label={
                        option.isSuggested
                          ? t('settings.duplicateCleanup.suggestedOption', {
                              value: formatMergeValue(option.value),
                            })
                          : formatMergeValue(option.value)
                      }
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
            {t('settings.duplicateCleanup.notDuplicate')}
          </AppButton>
          <Group gap="sm">
            <AppButton
              disabled={sourceWorkIds.length === 0 || isWorking}
              loading={isWorking && !preview}
              onClick={() => void prepareMerge()}
              type="button"
            >
              {t('settings.duplicateCleanup.reviewMerge')}
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
              {t('settings.duplicateCleanup.mergeSelected')}
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
  const { t } = useAppTranslation();
  const [groups, setGroups] = useState<DuplicateCandidateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    setFeedback(null);

    try {
      setGroups(await duplicateCleanupService.listDuplicateCandidateGroups());
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : t('settings.duplicateCleanup.loadError'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadGroups();
  }, [archiveScopeKey, loadGroups]);

  return (
    <SectionCard>
      <SectionIntro
        description={t('settings.duplicateCleanup.description')}
        eyebrow={t('settings.duplicateCleanup.eyebrow')}
        title={t('settings.duplicateCleanup.title')}
      />

      <ActionRow justify="space-between">
        <Group gap="sm">
          <AppBadge tone={groups.length > 0 ? 'warning' : 'success'}>
            {t('settings.duplicateCleanup.groupCount', {
              count: formatCount(groups.length),
            })}
          </AppBadge>
          <Text c="dimmed" size="sm">
            {t('settings.duplicateCleanup.compareDescription')}
          </Text>
        </Group>
        <AppButton
          disabled={isLoading}
          loading={isLoading}
          onClick={() => void loadGroups()}
          type="button"
        >
          {t('settings.duplicateCleanup.retry')}
        </AppButton>
      </ActionRow>

      {feedback && <FeedbackMessage>{feedback}</FeedbackMessage>}

      {!isLoading && groups.length === 0 && !feedback && (
        <FeedbackMessage tone="success">
          {t('settings.duplicateCleanup.empty')}
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
