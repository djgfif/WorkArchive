import { Group, Stack, Text } from '@mantine/core';
import type { AuthUserResponse } from '@work-archive/shared-types';

import {
  AppBadge,
  KeyValueGrid,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import { JsonBackupReminderCard } from '@features/archive';
import { getJsonBackupReminderStatus } from '@features/archive';
import type { LocalArchiveImportPreview } from '@features/archive';
import type { SettingsFeedback } from '../../hooks/useImportProviderSettings';
import type { SettingsOverviewStats } from '../../hooks/useSettingsOverviewStats';
import styles from './SettingsControlCenter.module.css';

type SettingsAuthMode = 'authenticated' | 'guest';
const css = styles;
type SummaryIconName = 'data' | 'google' | 'key' | 'security';

interface SettingsOverviewProps {
  archiveFeedback: SettingsFeedback | null;
  archiveImportPreview: LocalArchiveImportPreview | null;
  isExportingArchive: boolean;
  mode: SettingsAuthMode;
  onExportJson: () => void;
  stats: SettingsOverviewStats;
  user: AuthUserResponse | null;
}

function MiniIcon({ name }: { name: SummaryIconName }) {
  const iconProps = {
    'aria-hidden': true,
    fill: 'none',
    height: 18,
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    viewBox: '0 0 24 24',
    width: 18,
  } as const;

  return (
    <span className={css.summaryIcon ?? ''}>
      {name === 'google' && (
        <svg {...iconProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9.5" cy="7" r="4" />
          <path d="m16 11 2 2 4-4" />
        </svg>
      )}
      {name === 'data' && (
        <svg {...iconProps}>
          <path d="M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Z" />
          <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
          <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
        </svg>
      )}
      {name === 'key' && (
        <svg {...iconProps}>
          <circle cx="8" cy="15" r="4" />
          <path d="m11 12 8-8" />
          <path d="m15 8 2 2" />
          <path d="m17 6 2 2" />
        </svg>
      )}
      {name === 'security' && (
        <svg {...iconProps}>
          <path d="M12 3 5 6v6c0 4.4 2.9 7.3 7 9 4.1-1.7 7-4.6 7-9V6l-7-3Z" />
          <path d="m9.5 12 1.7 1.7 3.4-3.7" />
        </svg>
      )}
    </span>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '아직 없음';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function SettingsOverview({
  archiveFeedback,
  archiveImportPreview,
  isExportingArchive,
  mode,
  onExportJson,
  stats,
  user,
}: SettingsOverviewProps) {
  const googleAccount = user?.authAccounts?.find(
    (account) => account.provider === 'google',
  );
  const backupQueueLabel =
    stats.syncQueueItemCount === 0
      ? '백업 대기 없음'
      : `백업 대기 ${stats.syncQueueItemCount}개`;
  const hasStorageOriginWarning = stats.isNonStandardLocalOrigin;
  const hasLocalOnlyWarning =
    mode === 'authenticated' && stats.localOnlyWorkCount > 0;
  const dataSafetyTone =
    stats.conflictQueueItemCount > 0 || stats.failedQueueItemCount > 0
      ? 'warning'
      : stats.syncQueueItemCount > 0
        ? 'accent'
        : 'success';
  const backupReminder = getJsonBackupReminderStatus({
    activeWorkCount: stats.activeWorkCount,
    lastJsonExportAt: stats.lastJsonExportAt,
  });

  const cards = [
    {
      description:
        mode === 'authenticated'
          ? `${googleAccount?.email ?? user?.email ?? 'Google 계정'}에 연결된 로컬 아카이브입니다. 현재 저장소는 ${stats.databaseName || '확인 중'}입니다.`
          : '게스트 모드입니다. 기록은 이 브라우저의 로컬 저장소에만 보관됩니다.',
      icon: 'google',
      label: '저장 범위',
      tone: hasStorageOriginWarning
        ? 'warning'
        : mode === 'authenticated'
          ? 'success'
          : 'muted',
      value: mode === 'authenticated' ? 'Google 연결' : '로컬 전용',
    },
    {
      description: [
        `활성 작품 ${stats.activeWorkCount}개`,
        `휴지통 ${stats.deletedWorkCount}개`,
        `타임라인 ${stats.timelineEntryCount}개`,
        `릴리스 기록 ${stats.releaseRecordCount}개`,
      ].join(' · '),
      icon: 'data',
      label: '로컬 데이터',
      tone: 'success',
      value: `${stats.activeWorkCount}개 작품`,
    },
    {
      description:
        mode === 'authenticated'
          ? [
              `전체 ${stats.syncQueueItemCount}개`,
              `직접 확인 ${stats.conflictQueueItemCount}개`,
              `실패 ${stats.failedQueueItemCount}개`,
              `자동 병합 후 재시도 ${stats.autoMergedQueueItemCount}개`,
              `로컬 전용 작품 ${stats.localOnlyWorkCount}개`,
            ].join(' · ')
          : '게스트 모드에서는 서버 백업을 사용하지 않습니다.',
      icon: 'key',
      label: '백업 대기 중인 기록',
      tone:
        mode === 'authenticated' && hasLocalOnlyWarning
          ? 'warning'
          : mode === 'authenticated'
            ? dataSafetyTone
            : 'muted',
      value: mode === 'authenticated' ? backupQueueLabel : '로컬 전용',
    },
    {
      description: archiveImportPreview
        ? 'JSON 가져오기 미리보기를 확인 중입니다.'
        : archiveFeedback?.tone === 'success'
          ? archiveFeedback.message
          : '마지막 내보내기 시각은 이 브라우저에만 기록됩니다.',
      icon: 'security',
      label: '마지막 JSON 백업',
      tone: archiveImportPreview
        ? 'warning'
        : stats.lastJsonExportAt
          ? 'success'
          : 'muted',
      value: formatDateTime(stats.lastJsonExportAt),
    },
  ] as const;

  return (
    <Stack gap="md">
      <SectionIntro
        description="현재 브라우저에 저장된 기록, 백업 대기 상태, 마지막 JSON 백업 시각을 즉시 확인합니다."
        eyebrow="설정과 백업"
        title="설정 개요"
      />
      <div className={css.overviewGrid ?? ''}>
        {cards.map((card) => (
          <SectionCard
            className={css.summaryCard ?? ''}
            gap="sm"
            key={card.label}
            padding="lg"
            tone="subtle"
          >
            <Group justify="space-between" wrap="nowrap">
              <MiniIcon name={card.icon} />
              <AppBadge tone={card.tone}>{card.value}</AppBadge>
            </Group>
            <Stack gap={4}>
              <Text fw={800}>{card.label}</Text>
              <Text c="dimmed" size="sm">
                {card.description}
              </Text>
            </Stack>
          </SectionCard>
        ))}
      </div>
      {(hasStorageOriginWarning || hasLocalOnlyWarning) && (
        <SectionCard padding="lg" tone="subtle">
          <Group justify="space-between" wrap="wrap">
            <Stack gap={4}>
              <Text fw={850}>스토리지 진단</Text>
              <Text c="dimmed" size="sm">
                작품 데이터는 브라우저 origin과 사용자 DB별로 분리됩니다.
                표준 로컬 주소는 http://localhost:18730입니다.
              </Text>
            </Stack>
            <Group gap="xs">
              {hasStorageOriginWarning && (
                <AppBadge tone="warning">비표준 origin</AppBadge>
              )}
              {hasLocalOnlyWarning && (
                <AppBadge tone="warning">백업 전 작품 있음</AppBadge>
              )}
            </Group>
          </Group>
          <KeyValueGrid
            columns={2}
            items={[
              {
                label: '현재 origin',
                value: stats.currentOrigin || '확인 중',
              },
              {
                label: '현재 DB',
                value: stats.databaseName || '확인 중',
              },
              {
                label: '저장 범위 키',
                value: stats.archiveScopeKey || '확인 중',
              },
              {
                label: '로컬 전용 작품',
                value: `${stats.localOnlyWorkCount}개`,
              },
            ]}
          />
          {hasStorageOriginWarning && (
            <Text c="var(--app-state-warning)" size="sm">
              이 주소에서 만든 기록은 localhost:18730의 기록과 같은 목록에
              보이지 않습니다. JSON 백업으로 옮긴 뒤 표준 주소만 사용하세요.
            </Text>
          )}
          {hasLocalOnlyWarning && (
            <Text c="var(--app-state-warning)" size="sm">
              로컬 전용 작품은 아직 서버 백업이 완료되지 않았습니다. JSON
              백업을 만들고 대기 중인 기록을 처리하세요.
            </Text>
          )}
        </SectionCard>
      )}
      <JsonBackupReminderCard
        feedback={archiveFeedback}
        isExporting={isExportingArchive}
        onExportJson={onExportJson}
        reminder={backupReminder}
      />
    </Stack>
  );
}
