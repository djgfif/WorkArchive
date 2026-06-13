import { Group, Stack, Text } from '@mantine/core';

import {
  AppBadge,
  AppButton,
  FeedbackMessage,
  KeyValueGrid,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import { appI18n, formatAppDateTime, formatAppNumber, useAppTranslation } from '@app/i18n';
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
    return appI18n.t('settings.localDataSafety.checking');
  }

  return formatAppNumber(
    value / (value >= 1_073_741_824 ? 1_073_741_824 : 1_048_576),
    {
      maximumFractionDigits: 1,
      style: 'unit',
      unit: value >= 1_073_741_824 ? 'gigabyte' : 'megabyte',
      unitDisplay: 'short',
    },
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return appI18n.t('settings.localDataSafety.noneYet');
  }

  return formatAppDateTime(new Date(value), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getStorageBadgeTone(state: StoragePersistenceState) {
  if (!state.supported) {
    return 'muted' as const;
  }

  return state.persisted ? 'success' : 'warning';
}

function getStorageLabel(state: StoragePersistenceState) {
  if (!state.supported) {
    return appI18n.t('settings.localDataSafety.browserUnsupported');
  }

  return state.persisted
    ? appI18n.t('settings.localDataSafety.protected')
    : appI18n.t('settings.localDataSafety.protectionAvailable');
}

function getAutoBackupLabel(status: AutomaticJsonBackupStatus) {
  if (!status.supported) {
    return appI18n.t('settings.localDataSafety.manualBackupRequired');
  }

  if (!status.enabled) {
    return appI18n.t('settings.localDataSafety.off');
  }

  if (!status.hasSessionFolder) {
    return appI18n.t('settings.localDataSafety.folderReselectRequired');
  }

  return appI18n.t('settings.localDataSafety.on');
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
      return appI18n.t('settings.localDataSafety.permissionDenied');
    case 'granted':
      return appI18n.t('settings.localDataSafety.permissionGranted');
    case 'prompt':
      return appI18n.t('settings.localDataSafety.permissionPrompt');
    case 'unsupported':
      return appI18n.t('settings.localDataSafety.browserUnsupported');
    case 'unknown':
      return appI18n.t('settings.localDataSafety.checking');
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
  const { t } = useAppTranslation();
  const canRunBackupNow =
    autoBackupStatus.supported &&
    autoBackupStatus.enabled &&
    autoBackupStatus.hasSessionFolder;

  return (
    <SectionCard>
      <SectionIntro
        description={t('settings.localDataSafety.description')}
        eyebrow={t('settings.localDataSafety.eyebrow')}
        title={t('settings.localDataSafety.title')}
      />

      <Stack gap="md">
        <SectionCard padding="lg" tone="subtle">
          <Group justify="space-between" wrap="wrap">
            <Stack gap={4}>
              <Text fw={850}>
                {t('settings.localDataSafety.storageTitle')}
              </Text>
              <Text c="dimmed" size="sm">
                {t('settings.localDataSafety.storageDescription')}
              </Text>
            </Stack>
            <AppBadge tone={getStorageBadgeTone(storageState)}>
              {getStorageLabel(storageState)}
            </AppBadge>
          </Group>
          <KeyValueGrid
            columns={2}
            items={[
              {
                label: t('settings.localDataSafety.storageUsage'),
                value: formatBytes(storageState.usageBytes),
              },
              {
                label: t('settings.localDataSafety.storageQuota'),
                value: formatBytes(storageState.quotaBytes),
              },
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
              {t('settings.localDataSafety.requestStorage')}
            </AppButton>
          </Group>
          {!storageState.supported && (
            <Text c="dimmed" size="sm">
              {t('settings.localDataSafety.storageUnsupportedDescription')}
            </Text>
          )}
        </SectionCard>

        <SectionCard padding="lg" tone="subtle">
          <Group justify="space-between" wrap="wrap">
            <Stack gap={4}>
              <Text fw={850}>
                {t('settings.localDataSafety.autoBackupTitle')}
              </Text>
              <Text c="dimmed" size="sm">
                {t('settings.localDataSafety.autoBackupDescription')}
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
                label: t('settings.localDataSafety.lastAutoBackup'),
                value: formatDateTime(autoBackupStatus.lastSucceededAt),
              },
              {
                label: t('settings.localDataSafety.lastFile'),
                value:
                  autoBackupStatus.lastFileName ??
                  t('settings.localDataSafety.noneYet'),
              },
              {
                label: t('settings.localDataSafety.folderConnection'),
                value: autoBackupStatus.hasSessionFolder
                  ? t('settings.localDataSafety.folderConnectedThisSession')
                  : autoBackupStatus.enabled
                    ? t('settings.localDataSafety.folderReselectRequired')
                    : t('settings.localDataSafety.folderNotSelected'),
              },
              {
                label: t('settings.localDataSafety.permissionStatus'),
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
              {t('settings.localDataSafety.chooseBackupFolder')}
            </AppButton>
            <AppButton
              disabled={isLoading || !canRunBackupNow}
              loading={isRunningBackup}
              onClick={() => void onRunBackupNow()}
              type="button"
            >
              {t('settings.localDataSafety.runBackupNow')}
            </AppButton>
            {autoBackupStatus.enabled && (
              <AppButton
                disabled={isChoosingBackupFolder || isRunningBackup}
                onClick={() => void onDisableBackup()}
                tone="quiet"
                type="button"
              >
                {t('settings.localDataSafety.disableBackup')}
              </AppButton>
            )}
          </Group>
          {!autoBackupStatus.supported && (
            <Text c="dimmed" size="sm">
              {t('settings.localDataSafety.autoBackupUnsupportedDescription')}
            </Text>
          )}
          {autoBackupStatus.lastError && (
            <Text c="var(--app-state-warning)" size="sm">
              {t('settings.localDataSafety.lastAutoBackupError', {
                error: autoBackupStatus.lastError,
              })}
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
