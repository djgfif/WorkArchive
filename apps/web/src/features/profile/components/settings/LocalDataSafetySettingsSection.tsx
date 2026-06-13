import { Group, Stack, Text } from '@mantine/core';

import {
  AppBadge,
  AppButton,
  FeedbackMessage,
  KeyValueGrid,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import type { AutomaticJsonBackupStatus } from '@features/archive';
import type { StoragePersistenceState } from '@shared/runtime/persistent-storage';
import type { SettingsFeedback } from '../../hooks/useImportProviderSettings';

interface LocalDataSafetySettingsSectionProps {
  autoBackupStatus: AutomaticJsonBackupStatus;
  feedback: SettingsFeedback | null;
  isChoosingBackupFolder: boolean;
  isLoading: boolean;
  isRequestingStorage: boolean;
  isRunningBackup: boolean;
  onChooseBackupFolder: () => Promise<void>;
  onDisableBackup: () => Promise<void>;
  onRequestStorageProtection: () => Promise<void>;
  onRunBackupNow: () => Promise<void>;
  storageState: StoragePersistenceState;
}

function formatBytes(value: number | null) {
  if (value === null) {
    return '확인 중';
  }

  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 1,
    style: 'unit',
    unit: value >= 1_073_741_824 ? 'gigabyte' : 'megabyte',
    unitDisplay: 'short',
  }).format(value / (value >= 1_073_741_824 ? 1_073_741_824 : 1_048_576));
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

function getStorageBadgeTone(state: StoragePersistenceState) {
  if (!state.supported) {
    return 'muted' as const;
  }

  return state.persisted ? 'success' : 'warning';
}

function getStorageLabel(state: StoragePersistenceState) {
  if (!state.supported) {
    return '브라우저 미지원';
  }

  return state.persisted ? '보호됨' : '보호 요청 가능';
}

function getAutoBackupLabel(status: AutomaticJsonBackupStatus) {
  if (!status.supported) {
    return '수동 백업 필요';
  }

  if (!status.enabled) {
    return '꺼짐';
  }

  if (!status.hasSessionFolder) {
    return '폴더 다시 선택 필요';
  }

  return '켜짐';
}

function getAutoBackupTone(status: AutomaticJsonBackupStatus) {
  if (!status.supported || !status.enabled) {
    return 'muted' as const;
  }

  return status.hasSessionFolder ? 'success' : 'warning';
}

function getAutoBackupPermissionLabel(
  permission: AutomaticJsonBackupStatus['permission'],
) {
  switch (permission) {
    case 'denied':
      return '거부됨';
    case 'granted':
      return '허용됨';
    case 'prompt':
      return '다시 확인 필요';
    case 'unsupported':
      return '브라우저 미지원';
    case 'unknown':
      return '확인 중';
  }
}

export function LocalDataSafetySettingsSection({
  autoBackupStatus,
  feedback,
  isChoosingBackupFolder,
  isLoading,
  isRequestingStorage,
  isRunningBackup,
  onChooseBackupFolder,
  onDisableBackup,
  onRequestStorageProtection,
  onRunBackupNow,
  storageState,
}: LocalDataSafetySettingsSectionProps) {
  const canRunBackupNow =
    autoBackupStatus.supported &&
    autoBackupStatus.enabled &&
    autoBackupStatus.hasSessionFolder;

  return (
    <SectionCard>
      <SectionIntro
        description="로컬 기록이 브라우저에서 오래 보존되도록 요청하고, 앱을 열어 둔 동안 선택한 폴더에 전체 백업 파일을 씁니다."
        eyebrow="데이터 안전"
        title="저장소 보호와 자동 폴더 백업"
      />

      <Stack gap="md">
        <SectionCard padding="lg" tone="subtle">
          <Group justify="space-between" wrap="wrap">
            <Stack gap={4}>
              <Text fw={850}>브라우저 로컬 저장소 보호</Text>
              <Text c="dimmed" size="sm">
                승인되면 브라우저가 공간 정리 중에도 IndexedDB 기록을 임의로
                지우지 않도록 더 강하게 보관합니다.
              </Text>
            </Stack>
            <AppBadge tone={getStorageBadgeTone(storageState)}>
              {getStorageLabel(storageState)}
            </AppBadge>
          </Group>
          <KeyValueGrid
            columns={2}
            items={[
              { label: '사용 중인 저장공간', value: formatBytes(storageState.usageBytes) },
              { label: '브라우저 할당량', value: formatBytes(storageState.quotaBytes) },
            ]}
          />
          <Group gap="xs">
            <AppButton
              disabled={isLoading || !storageState.supported}
              loading={isRequestingStorage}
              onClick={() => void onRequestStorageProtection()}
              tone="primary"
              type="button"
            >
              저장소 보호 다시 요청
            </AppButton>
          </Group>
          {!storageState.supported && (
            <Text c="dimmed" size="sm">
              이 브라우저는 저장소 보호 요청을 제공하지 않습니다. 기록은 계속
              이 기기에 저장되며, JSON 백업으로 별도 보관할 수 있습니다.
            </Text>
          )}
        </SectionCard>

        <SectionCard padding="lg" tone="subtle">
          <Group justify="space-between" wrap="wrap">
            <Stack gap={4}>
              <Text fw={850}>앱을 열어 둔 동안 자동 폴더 백업</Text>
              <Text c="dimmed" size="sm">
                Chrome 계열 브라우저에서 폴더를 한 번 선택하면, 앱이 열려
                있는 동안 하루 한 번 또는 기록 변경 후 전체 JSON 백업을
                갱신합니다.
              </Text>
            </Stack>
            <AppBadge tone={getAutoBackupTone(autoBackupStatus)}>
              {getAutoBackupLabel(autoBackupStatus)}
            </AppBadge>
          </Group>
          <KeyValueGrid
            columns={2}
            items={[
              {
                label: '마지막 자동 백업',
                value: formatDateTime(autoBackupStatus.lastSucceededAt),
              },
              {
                label: '마지막 파일',
                value: autoBackupStatus.lastFileName ?? '아직 없음',
              },
              {
                label: '폴더 연결',
                value: autoBackupStatus.hasSessionFolder
                  ? '이번 세션 연결됨'
                  : autoBackupStatus.enabled
                    ? '다시 선택 필요'
                    : '아직 선택되지 않음',
              },
              {
                label: '권한 상태',
                value: getAutoBackupPermissionLabel(
                  autoBackupStatus.permission,
                ),
              },
            ]}
          />
          <Group gap="xs">
            <AppButton
              disabled={isLoading || !autoBackupStatus.supported}
              loading={isChoosingBackupFolder}
              onClick={() => void onChooseBackupFolder()}
              tone="primary"
              type="button"
            >
              자동 백업 폴더 선택
            </AppButton>
            <AppButton
              disabled={isLoading || !canRunBackupNow}
              loading={isRunningBackup}
              onClick={() => void onRunBackupNow()}
              type="button"
            >
              지금 전체 백업
            </AppButton>
            {autoBackupStatus.enabled && (
              <AppButton
                disabled={isChoosingBackupFolder || isRunningBackup}
                onClick={() => void onDisableBackup()}
                tone="quiet"
                type="button"
              >
                자동 백업 끄기
              </AppButton>
            )}
          </Group>
          {!autoBackupStatus.supported && (
            <Text c="dimmed" size="sm">
              이 브라우저는 폴더 자동 저장을 제공하지 않습니다. 아래의 JSON
              백업 내보내기로 수동 백업을 만들 수 있습니다.
            </Text>
          )}
          {autoBackupStatus.lastError && (
            <Text c="var(--app-state-warning)" size="sm">
              마지막 자동 백업 오류: {autoBackupStatus.lastError}
            </Text>
          )}
        </SectionCard>

        {feedback && (
          <FeedbackMessage tone={feedback.tone}>
            {feedback.message}
          </FeedbackMessage>
        )}
      </Stack>
    </SectionCard>
  );
}
