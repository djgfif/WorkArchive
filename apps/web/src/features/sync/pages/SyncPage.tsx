import { useState } from 'react';
import { Badge, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';

import {
  AppButton,
  AppLinkButton,
  FeedbackMessage,
  KeyValueGrid,
  MetricPill,
  SectionCard,
  SectionIntro,
  StateMessage,
} from '../../../shared/components/AppPrimitives';
import { AccountPageTemplate } from '../../../shared/components/PageTemplates';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import type { SyncRunState } from '../services/sync.service';

import { useSyncDashboard } from '../hooks/useSyncDashboard';
import { type ManualSyncResult, syncService } from '../services/sync.service';
import {
  formatWorkDateTime,
  getWorkSyncStatusLabel,
} from '../../works/utils/work-options';

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

export function SyncPage() {
  const { mode, user } = useAuthSession();
  const { queueItems, conflictWorks, error, isLoading, lastSuccessfulPullAt } =
    useSyncDashboard();
  const [syncState, setSyncState] = useState<SyncRunState>('idle');
  const [lastRun, setLastRun] = useState<ManualSyncResult | null>(null);
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

  return (
    <AccountPageTemplate
      actions={
        <>
          <AppLinkButton to="/account">계정 홈으로 돌아가기</AppLinkButton>
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
          ? '게스트 모드에서는 이 기기에만 저장됩니다. 로그인하면 계정 관리 맥락에서 동기화를 사용할 수 있습니다.'
          : `${user?.email}로 로그인되어 있습니다. 지금 기록을 동기화해 최신 상태로 맞출 수 있습니다.`
      }
      eyebrow="동기화"
      meta={
        <>
          <MetricPill label="대기 중" value={queueItems.length} />
          <MetricPill label="충돌" value={conflictWorks.length} />
          <MetricPill label="최근 동기화" value={formatOptionalDate(lastSuccessfulPullAt)} />
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

        {lastRun && (
          <SectionCard>
            <SectionIntro
              description={`실행 시각 ${formatWorkDateTime(lastRun.completedAt)}`}
              eyebrow="최근 실행"
              title="최근 동기화 결과"
            />

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <SectionCard padding="lg" tone="subtle">
                <Title order={4}>보내기</Title>
                <Text c="var(--app-text-muted)">
                  보내기 {lastRun.push.attemptedCount}건, 반영 {lastRun.push.appliedCount}건,
                  충돌 {lastRun.push.conflictCount}건, 실패 {lastRun.push.failedCount}건.
                </Text>
                <Text c="var(--app-text-muted)">
                  처리 시각 {formatOptionalDate(lastRun.push.processedAt)}
                </Text>
              </SectionCard>

              <SectionCard padding="lg" tone="subtle">
                <Title order={4}>가져오기</Title>
                <Text c="var(--app-text-muted)">
                  가져온 {lastRun.pull.pulledCount}건 중 반영 {lastRun.pull.appliedCount}건,
                  보류 {lastRun.pull.skippedCount}건.
                </Text>
                <Text c="var(--app-text-muted)">
                  가져온 시각 {formatOptionalDate(lastRun.pull.pulledAt)}
                </Text>
              </SectionCard>
            </SimpleGrid>

            <Stack gap="xs">
              {lastRun.push.messages.map((message, index) => (
                <Text c="var(--app-text-muted)" key={`push-${index}-${message}`}>
                  보내기: {message}
                </Text>
              ))}
              {lastRun.pull.messages.map((message, index) => (
                <Text c="var(--app-text-muted)" key={`pull-${index}-${message}`}>
                  가져오기: {message}
                </Text>
              ))}
            </Stack>
          </SectionCard>
        )}

        <SectionCard>
          <SectionIntro eyebrow="대기열" title="동기화 대기 중" />

          {isLoading && <Text c="var(--app-text-muted)">동기화 상태를 불러오는 중입니다.</Text>}

          {!isLoading && queueItems.length === 0 && (
            <Text c="var(--app-text-muted)">지금은 동기화할 내용이 없습니다.</Text>
          )}

          {!isLoading && queueItems.length > 0 && (
            <Stack gap="md">
              {queueItems.map((item) => (
                <SectionCard key={item.id} padding="lg" tone="subtle">
                  <Group align="flex-start" justify="space-between" wrap="wrap">
                    <Stack gap={4}>
                      <Title order={4}>{item.payload.title}</Title>
                      <Text c="var(--app-text-muted)">
                        {getSyncOperationLabel(item.operation)} 요청
                      </Text>
                    </Stack>
                    <Badge>재시도 {item.retryCount}회</Badge>
                  </Group>

                  <KeyValueGrid
                    items={[
                      {
                        label: '최근 수정',
                        value: formatWorkDateTime(item.payload.updatedAt),
                      },
                      {
                        label: '동기화 상태',
                        value: getWorkSyncStatusLabel(item.payload.syncStatus),
                      },
                      { label: '서버 버전', value: item.payload.serverVersion },
                    ]}
                  />

                  {item.lastError && (
                    <FeedbackMessage tone="error">{item.lastError}</FeedbackMessage>
                  )}
                </SectionCard>
              ))}
            </Stack>
          )}
        </SectionCard>

        <SectionCard>
          <SectionIntro eyebrow="충돌" title="확인이 필요한 작품" />

          {!isLoading && conflictWorks.length === 0 && (
            <Text c="var(--app-text-muted)">지금은 확인이 필요한 충돌이 없습니다.</Text>
          )}

          {!isLoading && conflictWorks.length > 0 && (
            <Stack gap="md">
              {conflictWorks.map((work) => (
                <SectionCard key={work.id} padding="lg" tone="subtle">
                  <Group align="flex-start" justify="space-between" wrap="wrap">
                    <Stack gap={4}>
                      <Title order={4}>{work.title}</Title>
                      <Text c="var(--app-text-muted)">
                        동기화 상태를 확인해주세요.
                      </Text>
                    </Stack>
                    <Badge color="red">충돌</Badge>
                  </Group>

                  <KeyValueGrid
                    items={[
                      { label: '최근 수정', value: formatWorkDateTime(work.updatedAt) },
                      { label: '삭제됨', value: formatOptionalDate(work.deletedAt, '없음') },
                      { label: '서버 버전', value: work.serverVersion },
                    ]}
                  />
                </SectionCard>
              ))}
            </Stack>
          )}
        </SectionCard>
      </Stack>
    </AccountPageTemplate>
  );
}
