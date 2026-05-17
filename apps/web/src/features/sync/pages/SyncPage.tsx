import {
  Accordion,
  Checkbox,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';

import type { UserReleaseRecord, WorkRecord } from '@work-archive/shared-types';

import {
  AppBadge,
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  KeyValueGrid,
  LoadingState,
  MetricPill,
  SectionCard,
  SectionIntro,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { AccountPageTemplate } from '../../../shared/components/PageTemplates';
import {
  localizeSyncQueueSource,
  localizeSyncResultCode,
} from '../../../shared/utils/localize-message';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import {
  formatWorkDateTime,
  getWorkSyncStatusLabel,
} from '../../works/utils/work-options';
import {
  useSyncDashboard,
  type SyncDashboardItem,
} from '../hooks/useSyncDashboard';
import {
  type ManualSyncResult,
  type SyncRunState,
  syncService,
} from '../services/sync.service';

function formatOptionalDate(value: string | null, fallback = '아직 없음') {
  return value ? formatWorkDateTime(value) : fallback;
}

function renderStateLabel(state: SyncRunState) {
  switch (state) {
    case 'syncing':
      return '동기화 중';
    case 'success':
      return '완료';
    case 'failed':
      return '실패';
    case 'idle':
    default:
      return '대기';
  }
}

function getLastRunSummary(result: ManualSyncResult) {
  const issueCount =
    result.push.failedCount +
    result.push.conflictCount +
    result.pull.skippedCount +
    (result.push.requestFailed ? 1 : 0) +
    (result.pull.requestFailed ? 1 : 0);

  if (result.state === 'success') {
    return {
      description:
        '대기 중인 변경과 원격 변경을 처리했습니다. 추가 조치가 필요한 항목은 없습니다.',
      label: '완료',
      title: '동기화가 완료되었습니다',
      tone: 'success' as const,
    };
  }

  return {
    description:
      issueCount > 0
        ? `확인이 필요한 항목 ${issueCount}건이 있습니다. 아래 실패/충돌/보류 내용을 확인한 뒤 다시 동기화하세요.`
        : '동기화가 끝났지만 일부 단계가 정상 완료되지 않았습니다. 아래 메시지를 확인한 뒤 다시 시도하세요.',
    label: '확인 필요',
    title: '동기화 후 확인이 필요합니다',
    tone: 'danger' as const,
  };
}

function getSyncOperationLabel(operation: string) {
  switch (operation) {
    case 'create':
      return '추가';
    case 'update':
      return '수정';
    case 'delete':
      return '삭제';
    default:
      return operation;
  }
}

function getEntityTypeLabel(entityType: SyncDashboardItem['entityType']) {
  switch (entityType) {
    case 'work':
      return '작품';
    case 'timeline_entry':
      return '타임라인 기록';
    case 'release_record':
    default:
      return '권별 기록';
  }
}

function getItemStateLabel(state: SyncDashboardItem['state']) {
  switch (state) {
    case 'conflict':
      return '충돌';
    case 'failed':
      return '실패';
    case 'pending':
    default:
      return '대기 중';
  }
}

function getItemStateTone(state: SyncDashboardItem['state']) {
  switch (state) {
    case 'conflict':
      return 'warning' as const;
    case 'failed':
      return 'danger' as const;
    case 'pending':
    default:
      return 'accent' as const;
  }
}

type FailedItemDiagnosticKind =
  | 'auth'
  | 'conflict'
  | 'network'
  | 'server'
  | 'unknown'
  | 'validation';

function getFailedItemDiagnosticKind(
  item: SyncDashboardItem,
): FailedItemDiagnosticKind {
  if (item.state === 'conflict' || item.conflictCode) {
    return 'conflict';
  }

  const message = (item.lastError ?? '').toLowerCase();

  if (
    message.includes('로그인') ||
    message.includes('인증') ||
    message.includes('token') ||
    message.includes('401')
  ) {
    return 'auth';
  }

  if (
    message.includes('network') ||
    message.includes('네트워크') ||
    message.includes('연결') ||
    message.includes('timed out') ||
    message.includes('timeout')
  ) {
    return 'network';
  }

  if (
    message.includes('validation') ||
    message.includes('유효') ||
    message.includes('필수') ||
    message.includes('형식')
  ) {
    return 'validation';
  }

  if (
    message.includes('server') ||
    message.includes('서버') ||
    message.includes('503') ||
    message.includes('500')
  ) {
    return 'server';
  }

  return 'unknown';
}

function getFailedItemDiagnostic(item: SyncDashboardItem) {
  switch (getFailedItemDiagnosticKind(item)) {
    case 'auth':
      return '인증 만료';
    case 'conflict':
      return '충돌';
    case 'network':
      return '네트워크';
    case 'server':
      return '서버 오류';
    case 'validation':
      return '서버 검증';
    case 'unknown':
    default:
      return '원인 미분류';
  }
}

function getFailedItemRecovery(item: SyncDashboardItem) {
  switch (getFailedItemDiagnosticKind(item)) {
    case 'auth':
      return {
        actionLabel: '다시 로그인',
        actionTo: '/auth/login',
        description:
          '로그인 세션이 만료됐을 수 있습니다. 다시 로그인한 뒤 수동 동기화를 실행하세요.',
        title: '세션 확인 필요',
      };
    case 'network':
      return {
        description:
          '네트워크가 안정된 뒤 다시 동기화를 시도하세요. 기록은 로컬 대기열에 남아 있습니다.',
        title: '연결 상태 확인',
      };
    case 'server':
      return {
        description:
          '서버 응답 문제일 수 있습니다. 잠시 후 다시 동기화를 실행하세요.',
        title: '잠시 후 재시도',
      };
    case 'validation':
      return {
        actionLabel: item.linkTo ? '기록 열기' : undefined,
        actionTo: item.linkTo ?? undefined,
        description:
          '서버가 일부 필드를 받지 못했습니다. 기록을 열어 필수값과 날짜/별점 형식을 확인하세요.',
        title: '기록 내용 확인',
      };
    case 'conflict':
      return {
        description:
          '로컬과 원격 변경이 동시에 존재합니다. 아래 충돌 해결 도구에서 유지할 값을 선택하세요.',
        title: '충돌 해결 필요',
      };
    case 'unknown':
    default:
      return {
        description:
          '오류 메시지를 확인한 뒤 다시 동기화를 시도하세요. 반복되면 기록을 열어 최근 수정 내용을 확인하세요.',
        title: '수동 확인 필요',
      };
  }
}

const WORK_CONFLICT_FIELDS = [
  { key: 'title', label: '제목' },
  { key: 'author', label: '작가/제작자' },
  { key: 'status', label: '상태' },
  { key: 'rating', label: '별점' },
  { key: 'shortReview', label: '한줄평' },
  { key: 'review', label: '감상' },
  { key: 'favorite', label: '즐겨찾기' },
  { key: 'tier', label: '티어' },
  { key: 'progressCurrent', label: '현재 진행도' },
  { key: 'progressTotal', label: '전체 진행도' },
  { key: 'progressUnit', label: '진행 단위' },
  { key: 'lastConsumedLabel', label: '마지막 감상 위치' },
  { key: 'startedAt', label: '시작일' },
  { key: 'completedAt', label: '완료일' },
  { key: 'droppedAt', label: '중단일' },
  { key: 'lastConsumedAt', label: '마지막 감상일' },
  { key: 'genres', label: '장르' },
  { key: 'personalTags', label: '개인 태그' },
  { key: 'description', label: '설명' },
  { key: 'thumbnailUrl', label: '표지 URL' },
  { key: 'deletedAt', label: '삭제 시각' },
] as const;

const RELEASE_RECORD_CONFLICT_FIELDS = [
  { key: 'status', label: '상태' },
  { key: 'rating', label: '별점' },
  { key: 'shortReview', label: '한줄평' },
  { key: 'review', label: '감상' },
  { key: 'favorite', label: '즐겨찾기' },
  { key: 'deletedAt', label: '삭제 시각' },
] as const;

function formatConflictValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '없음';
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '없음';
  }

  if (typeof value === 'boolean') {
    return value ? '예' : '아니오';
  }

  return String(value);
}

function getConflictFields(item: SyncDashboardItem) {
  if (item.entityType === 'timeline_entry') {
    return [
      { key: 'type', label: '유형' },
      { key: 'occurredAt', label: '발생일' },
      { key: 'note', label: '메모' },
      { key: 'deletedAt', label: '삭제 시각' },
    ] as const;
  }

  return item.entityType === 'work'
    ? WORK_CONFLICT_FIELDS
    : RELEASE_RECORD_CONFLICT_FIELDS;
}

function getConflictFieldValue(
  item: SyncDashboardItem,
  field: string,
  side: 'local' | 'remote',
) {
  const snapshot = side === 'local' ? item.localSnapshot : item.conflictRemote;

  if (!snapshot) {
    return null;
  }

  if (item.entityType === 'work') {
    return (snapshot as WorkRecord)[field as keyof WorkRecord];
  }

  if (item.entityType === 'timeline_entry') {
    return (snapshot as unknown as { [key: string]: unknown })[field];
  }

  return (snapshot as UserReleaseRecord)[field as keyof UserReleaseRecord];
}

function hasConflictFieldDifference(item: SyncDashboardItem, field: string) {
  return (
    formatConflictValue(getConflictFieldValue(item, field, 'local')) !==
    formatConflictValue(getConflictFieldValue(item, field, 'remote'))
  );
}

function getConflictSummaryFields(item: SyncDashboardItem) {
  if (item.entityType === 'release_record') {
    return [
      { key: 'status', label: '상태' },
      { key: 'rating', label: '별점' },
      { key: 'updatedAt', label: '수정 시각' },
      { key: 'deletedAt', label: '삭제 시각' },
    ];
  }

  if (item.entityType === 'timeline_entry') {
    return [
      { key: 'type', label: '유형' },
      { key: 'occurredAt', label: '발생일' },
      { key: 'updatedAt', label: '수정 시각' },
      { key: 'deletedAt', label: '삭제 시각' },
    ];
  }

  return [
    { key: 'title', label: '제목' },
    { key: 'status', label: '상태' },
    { key: 'rating', label: '별점' },
    { key: 'progressCurrent', label: '현재 진행도' },
    { key: 'progressTotal', label: '전체 진행도' },
    { key: 'updatedAt', label: '수정 시각' },
  ];
}

interface SyncQueueSectionProps {
  description: string;
  emptyMessage: string;
  isGuestMode: boolean;
  isRetryDisabled: boolean;
  items: SyncDashboardItem[];
  mergeSelections?: Record<string, string[]>;
  onMergeSelectionChange?: (itemId: string, fields: string[]) => void;
  onRetry: () => void;
  onResolveLocal?: (item: SyncDashboardItem) => void;
  onResolveMerge?: (item: SyncDashboardItem) => void;
  onResolveRemote?: (item: SyncDashboardItem) => void;
  resolvingItemId?: string | null;
  testId: string;
  title: string;
}

interface ConflictResolutionPanelProps {
  item: SyncDashboardItem;
  mergeSelections: Record<string, string[]>;
  onMergeSelectionChange: (itemId: string, fields: string[]) => void;
  onResolveLocal: (item: SyncDashboardItem) => void;
  onResolveMerge: (item: SyncDashboardItem) => void;
  onResolveRemote: (item: SyncDashboardItem) => void;
  resolvingItemId: string | null;
}

function ConflictResolutionPanel({
  item,
  mergeSelections,
  onMergeSelectionChange,
  onResolveLocal,
  onResolveMerge,
  onResolveRemote,
  resolvingItemId,
}: ConflictResolutionPanelProps) {
  const fields = getConflictFields(item);
  const selectedFields = mergeSelections[item.id] ?? [];
  const hasRemoteSnapshot = item.conflictRemote !== null;
  const isResolving = resolvingItemId === item.id;
  const conflictReason =
    item.conflictCode !== null
      ? localizeSyncResultCode(item.conflictCode)
      : '원격 변경과 충돌했습니다. 내용을 확인한 뒤 다시 동기화를 시도해 주세요.';
  const summaryFields = getConflictSummaryFields(item);
  const summaryFieldKeys = new Set(summaryFields.map((field) => field.key));
  const detailFields = fields.filter(
    (field) => !summaryFieldKeys.has(field.key),
  );
  const changedFieldCount = fields.filter((field) =>
    hasConflictFieldDifference(item, field.key),
  ).length;

  return (
    <Stack gap="sm">
      <Divider />
      <Stack gap={4}>
        <Title order={5}>충돌 해결</Title>
        <Text c="var(--app-text-muted)" size="sm">
          {conflictReason}
        </Text>
        {hasRemoteSnapshot && (
          <Text c="var(--app-text-muted)" size="sm">
            로컬과 원격이 다른 필드 {changedFieldCount}개를 비교 중입니다.
          </Text>
        )}
      </Stack>

      {!hasRemoteSnapshot && (
        <FeedbackMessage tone="error">
          서버가 비교 가능한 원격 스냅샷을 보내지 않아 로컬 유지 후 재동기화만
          사용할 수 있습니다.
        </FeedbackMessage>
      )}

      {hasRemoteSnapshot && (
        <Stack gap="md">
          <Stack gap="xs">
            <Text fw={700}>핵심 차이</Text>
            {summaryFields.map((field) => (
              <SimpleGrid
                cols={{ base: 1, md: 3 }}
                key={field.key}
                spacing="sm"
              >
                <Text fw={700}>{field.label}</Text>
                <Text c="var(--app-text-muted)" size="sm">
                  로컬:{' '}
                  {formatConflictValue(
                    getConflictFieldValue(item, field.key, 'local'),
                  )}
                </Text>
                <Text c="var(--app-text-muted)" size="sm">
                  원격:{' '}
                  {formatConflictValue(
                    getConflictFieldValue(item, field.key, 'remote'),
                  )}
                </Text>
              </SimpleGrid>
            ))}
          </Stack>

          {detailFields.length > 0 && (
            <Accordion variant="contained">
              <Accordion.Item value="all-conflict-fields">
                <Accordion.Control>
                  전체 비교 필드 보기
                  <Text c="var(--app-text-muted)" component="span" ml="xs" size="sm">
                    핵심 차이 외 {detailFields.length}개 항목
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    {detailFields.map((field) => (
                      <SimpleGrid
                        cols={{ base: 1, md: 3 }}
                        key={field.key}
                        spacing="sm"
                      >
                        <Text fw={700}>{field.label}</Text>
                        <Text c="var(--app-text-muted)" size="sm">
                          로컬:{' '}
                          {formatConflictValue(
                            getConflictFieldValue(item, field.key, 'local'),
                          )}
                        </Text>
                        <Text c="var(--app-text-muted)" size="sm">
                          원격:{' '}
                          {formatConflictValue(
                            getConflictFieldValue(item, field.key, 'remote'),
                          )}
                        </Text>
                      </SimpleGrid>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          )}
        </Stack>
      )}

      {hasRemoteSnapshot && (
        <Checkbox.Group
          label="필드별 병합에서 원격 값으로 가져올 항목"
          onChange={(fields) => onMergeSelectionChange(item.id, fields)}
          value={selectedFields}
        >
          <Group gap="sm" mt="xs" wrap="wrap">
            {fields.map((field) => (
              <Checkbox key={field.key} label={field.label} value={field.key} />
            ))}
          </Group>
        </Checkbox.Group>
      )}

      <Group gap="sm" wrap="wrap">
        <AppButton
          disabled={isResolving}
          onClick={() => onResolveLocal(item)}
          tone="primary"
          type="button"
        >
          로컬 유지
        </AppButton>
        <AppButton
          disabled={!hasRemoteSnapshot || isResolving}
          onClick={() => onResolveRemote(item)}
          tone="secondary"
          type="button"
        >
          원격 적용
        </AppButton>
        <AppButton
          disabled={
            !hasRemoteSnapshot || selectedFields.length === 0 || isResolving
          }
          onClick={() => onResolveMerge(item)}
          tone="secondary"
          type="button"
        >
          필드별 병합
        </AppButton>
      </Group>
    </Stack>
  );
}

function SyncQueueSection({
  description,
  emptyMessage,
  isGuestMode,
  isRetryDisabled,
  items,
  mergeSelections = {},
  onMergeSelectionChange,
  onRetry,
  onResolveLocal,
  onResolveMerge,
  onResolveRemote,
  resolvingItemId = null,
  testId,
  title,
}: SyncQueueSectionProps) {
  return (
    <SectionCard>
      <SectionIntro
        description={description}
        title={title}
        eyebrow="동기화 상태"
      />

      {items.length === 0 ? (
        <Text c="var(--app-text-muted)">{emptyMessage}</Text>
      ) : (
        <Stack data-testid={testId} gap="md">
          {items.map((item) => {
            const recovery =
              item.state === 'failed' ? getFailedItemRecovery(item) : null;

            return (
              <div data-testid={`sync-item-${item.id}`} key={item.id}>
              <SectionCard padding="lg" tone="subtle">
                <Group align="flex-start" justify="space-between" wrap="wrap">
                  <Stack gap={4}>
                    <Group gap="xs" wrap="wrap">
                      <AppBadge tone={getItemStateTone(item.state)}>
                        {getItemStateLabel(item.state)}
                      </AppBadge>
                      <AppBadge tone="muted">
                        {getEntityTypeLabel(item.entityType)}
                      </AppBadge>
                      <AppBadge>
                        {getSyncOperationLabel(item.operation)}
                      </AppBadge>
                      <AppBadge tone="muted">
                        {localizeSyncQueueSource(item.source)}
                      </AppBadge>
                    </Group>
                    <Title order={4}>{item.title}</Title>
                  </Stack>
                  <Text c="var(--app-text-muted)" size="sm">
                    재시도 {item.retryCount}회
                  </Text>
                </Group>

                <KeyValueGrid
                  items={[
                    { label: '엔티티 ID', value: item.entityId },
                    {
                      label: '변경 출처',
                      value: localizeSyncQueueSource(item.source),
                    },
                    {
                      label: '최근 수정',
                      value: formatWorkDateTime(item.updatedAt),
                    },
                    {
                      label: '로컬 동기화 상태',
                      value: getWorkSyncStatusLabel(item.syncStatus),
                    },
                    { label: '서버 버전', value: item.serverVersion },
                    {
                      label: '삭제됨',
                      value: formatOptionalDate(item.deletedAt, '없음'),
                    },
                  ]}
                />

                {(item.lastError || item.state === 'conflict') && (
                  <FeedbackMessage
                    title={
                      item.state === 'failed'
                        ? `실패 원인: ${getFailedItemDiagnostic(item)}`
                        : undefined
                    }
                    tone="error"
                  >
                    {item.lastError ??
                      '원격 변경과 충돌했습니다. 내용을 확인한 뒤 다시 동기화를 시도해 주세요.'}
                  </FeedbackMessage>
                )}

                {recovery && (
                  <Stack gap={6}>
                    <Text c="var(--app-text-strong)" fw={700} size="sm">
                      다음 행동: {recovery.title}
                    </Text>
                    <Text c="var(--app-text-muted)" size="sm">
                      {recovery.description}
                    </Text>
                    {recovery.actionTo && recovery.actionLabel && (
                      <Group>
                        <AppLinkButton to={recovery.actionTo} tone="quiet">
                          {recovery.actionLabel}
                        </AppLinkButton>
                      </Group>
                    )}
                  </Stack>
                )}

                <Group gap="sm" wrap="wrap">
                  {item.linkTo && (
                    <AppLinkButton to={item.linkTo} tone="quiet">
                      기록 보기
                    </AppLinkButton>
                  )}
                  {!isGuestMode && (
                    <AppButton
                      disabled={isRetryDisabled}
                      onClick={onRetry}
                      tone="primary"
                      type="button"
                    >
                      다시 동기화 시도
                    </AppButton>
                  )}
                </Group>

                {item.state === 'conflict' &&
                  onMergeSelectionChange &&
                  onResolveLocal &&
                  onResolveMerge &&
                  onResolveRemote && (
                    <ConflictResolutionPanel
                      item={item}
                      mergeSelections={mergeSelections}
                      onMergeSelectionChange={onMergeSelectionChange}
                      onResolveLocal={onResolveLocal}
                      onResolveMerge={onResolveMerge}
                      onResolveRemote={onResolveRemote}
                      resolvingItemId={resolvingItemId}
                    />
                  )}
              </SectionCard>
            </div>
            );
          })}
        </Stack>
      )}
    </SectionCard>
  );
}

export function SyncPage() {
  const { mode, user } = useAuthSession();
  const {
    pendingItems,
    failedItems,
    conflictItems,
    error,
    isLoading,
    lastSuccessfulPullAt,
  } = useSyncDashboard();
  const [syncState, setSyncState] = useState<SyncRunState>('idle');
  const [lastRun, setLastRun] = useState<ManualSyncResult | null>(null);
  const [mergeSelections, setMergeSelections] = useState<
    Record<string, string[]>
  >({});
  const [resolvingItemId, setResolvingItemId] = useState<string | null>(null);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const isGuestMode = mode !== 'authenticated';

  async function handleRunSync() {
    if (isGuestMode) {
      return;
    }

    setSyncState('syncing');

    try {
      const result = await syncService.runManualSync();

      setLastRun(result);
      setSyncState(result.state);
    } catch {
      setSyncState('failed');
    }
  }

  function handleMergeSelectionChange(itemId: string, fields: string[]) {
    setMergeSelections((current) => ({
      ...current,
      [itemId]: fields,
    }));
  }

  async function handleResolveLocal(item: SyncDashboardItem) {
    setResolvingItemId(item.id);
    setResolutionError(null);

    try {
      await syncService.resolveConflictWithLocal(item.id);
      setMergeSelections((current) => {
        const next = { ...current };

        delete next[item.id];

        return next;
      });
    } catch (error) {
      setResolutionError(
        error instanceof Error ? error.message : '충돌 해결에 실패했습니다.',
      );
    } finally {
      setResolvingItemId(null);
    }
  }

  async function handleResolveRemote(item: SyncDashboardItem) {
    setResolvingItemId(item.id);
    setResolutionError(null);

    try {
      await syncService.resolveConflictWithRemote(item.id);
      setMergeSelections((current) => {
        const next = { ...current };

        delete next[item.id];

        return next;
      });
    } catch (error) {
      setResolutionError(
        error instanceof Error ? error.message : '충돌 해결에 실패했습니다.',
      );
    } finally {
      setResolvingItemId(null);
    }
  }

  async function handleResolveMerge(item: SyncDashboardItem) {
    setResolvingItemId(item.id);
    setResolutionError(null);

    try {
      await syncService.resolveConflictWithMergedFields(
        item.id,
        mergeSelections[item.id] ?? [],
      );
      setMergeSelections((current) => {
        const next = { ...current };

        delete next[item.id];

        return next;
      });
    } catch (error) {
      setResolutionError(
        error instanceof Error ? error.message : '충돌 해결에 실패했습니다.',
      );
    } finally {
      setResolvingItemId(null);
    }
  }

  return (
    <AccountPageTemplate
      actions={
        <>
          <AppLinkButton to="/account">계정으로 돌아가기</AppLinkButton>
          <AppButton
            disabled={isGuestMode || syncState === 'syncing'}
            onClick={() => {
              void handleRunSync();
            }}
            tone="primary"
            type="button"
          >
            {isGuestMode
              ? '로그인 후 동기화'
              : syncState === 'syncing'
                ? '동기화 중...'
                : '수동 동기화'}
          </AppButton>
        </>
      }
      description={
        isGuestMode
          ? '게스트 모드에서는 기록이 이 기기에만 저장됩니다. 로그인하면 계정 관리 화면에서 동기화를 사용할 수 있습니다.'
          : `${user?.email}로 로그인되어 있습니다. 지금 기록을 동기화해 최신 상태로 맞출 수 있습니다.`
      }
      eyebrow="동기화"
      meta={
        <>
          <MetricPill label="대기 중" value={pendingItems.length} />
          <MetricPill label="실패" value={failedItems.length} />
          <MetricPill label="충돌" value={conflictItems.length} />
          <MetricPill
            label="최근 동기화"
            value={formatOptionalDate(lastSuccessfulPullAt)}
          />
          <MetricPill label="현재 상태" value={renderStateLabel(syncState)} />
        </>
      }
      title="동기화 상태"
    >
      <Stack gap="md">
        {isGuestMode && (
          <StateMessage
            actions={
              <>
                <AppLinkButton to="/auth/login">로그인</AppLinkButton>
                <AppLinkButton to="/auth/register">회원가입</AppLinkButton>
              </>
            }
            description="게스트 모드에서는 기록이 이 기기에만 저장됩니다. 계정으로 로그인하면 기록을 동기화할 수 있습니다."
            eyebrow="게스트 모드"
            title="로그인하면 동기화할 수 있습니다"
            tone="info"
          />
        )}

        {error && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
        {resolutionError && (
          <FeedbackMessage tone="error">{resolutionError}</FeedbackMessage>
        )}

        {lastRun && (
          <SectionCard>
            <SectionIntro
              description={`실행 시각 ${formatWorkDateTime(lastRun.completedAt)}`}
              eyebrow="최근 실행"
              title="최근 동기화 결과"
            />

            <Stack gap="sm">
              <Group align="flex-start" justify="space-between" wrap="wrap">
                <Stack gap={4}>
                  <AppBadge tone={getLastRunSummary(lastRun).tone}>
                    {getLastRunSummary(lastRun).label}
                  </AppBadge>
                  <Title order={3}>{getLastRunSummary(lastRun).title}</Title>
                  <Text c="var(--app-text-muted)">
                    {getLastRunSummary(lastRun).description}
                  </Text>
                </Stack>
                {lastRun.state === 'failed' && !isGuestMode && (
                  <AppButton
                    disabled={syncState === 'syncing'}
                    onClick={() => {
                      void handleRunSync();
                    }}
                    tone="primary"
                    type="button"
                  >
                    다시 동기화
                  </AppButton>
                )}
              </Group>

              <Group gap="sm" wrap="wrap">
                <MetricPill
                  label="보내기 실패"
                  value={lastRun.push.failedCount}
                />
                <MetricPill
                  label="보내기 충돌"
                  value={lastRun.push.conflictCount}
                />
                <MetricPill
                  label="가져오기 보류"
                  value={lastRun.pull.skippedCount}
                />
              </Group>
            </Stack>

            <SectionCard padding="lg" tone="subtle">
              <Title order={4}>보내기</Title>
              <Text c="var(--app-text-muted)">
                보내기 {lastRun.push.attemptedCount}건 반영{' '}
                {lastRun.push.appliedCount}건 충돌 {lastRun.push.conflictCount}
                건 실패 {lastRun.push.failedCount}건
              </Text>
              <Text c="var(--app-text-muted)">
                처리 시각 {formatOptionalDate(lastRun.push.processedAt)}
              </Text>
            </SectionCard>

            <SectionCard padding="lg" tone="subtle">
              <Title order={4}>가져오기</Title>
              <Text c="var(--app-text-muted)">
                가져온 {lastRun.pull.pulledCount}건 중 반영{' '}
                {lastRun.pull.appliedCount}건 보류 {lastRun.pull.skippedCount}건
              </Text>
              <Text c="var(--app-text-muted)">
                가져온 시각 {formatOptionalDate(lastRun.pull.pulledAt)}
              </Text>
            </SectionCard>

            <Stack gap="xs">
              {lastRun.push.messages.map((message, index) => (
                <Text
                  c="var(--app-text-muted)"
                  key={`push-${index}-${message}`}
                >
                  보내기 {message}
                </Text>
              ))}
              {lastRun.pull.messages.map((message, index) => (
                <Text
                  c="var(--app-text-muted)"
                  key={`pull-${index}-${message}`}
                >
                  가져오기 {message}
                </Text>
              ))}
            </Stack>
          </SectionCard>
        )}

        {!isLoading && (
          <>
            <SyncQueueSection
              description="아직 서버 백업에 반영되지 않은 local-first 변경입니다."
              emptyMessage="현재 대기 중인 변경 사항이 없습니다."
              isGuestMode={isGuestMode}
              isRetryDisabled={syncState === 'syncing'}
              items={pendingItems}
              onRetry={() => {
                void handleRunSync();
              }}
              testId="sync-section-pending"
              title="동기화 대기 중"
            />

            <SyncQueueSection
              description="전송을 시도했지만 네트워크나 서버 응답 문제로 멈춘 변경입니다."
              emptyMessage="현재 실패한 변경 사항이 없습니다."
              isGuestMode={isGuestMode}
              isRetryDisabled={syncState === 'syncing'}
              items={failedItems}
              onRetry={() => {
                void handleRunSync();
              }}
              testId="sync-section-failed"
              title="실패한 변경"
            />

            <SyncQueueSection
              description="원격 기록과 로컬 기록이 같은 기준으로 합쳐지지 않은 항목입니다. 로컬 유지, 원격 적용, 필드별 병합 중 하나로 해결할 수 있습니다."
              emptyMessage="현재 충돌한 변경 사항이 없습니다."
              isGuestMode={isGuestMode}
              isRetryDisabled={syncState === 'syncing'}
              items={conflictItems}
              mergeSelections={mergeSelections}
              onMergeSelectionChange={handleMergeSelectionChange}
              onRetry={() => {
                void handleRunSync();
              }}
              onResolveLocal={(item) => {
                void handleResolveLocal(item);
              }}
              onResolveMerge={(item) => {
                void handleResolveMerge(item);
              }}
              onResolveRemote={(item) => {
                void handleResolveRemote(item);
              }}
              resolvingItemId={resolvingItemId}
              testId="sync-section-conflict"
              title="충돌한 변경"
            />
          </>
        )}

        {isLoading && (
          <LoadingState rows={3} title="동기화 상태를 불러오는 중입니다" />
        )}
      </Stack>
    </AccountPageTemplate>
  );
}
