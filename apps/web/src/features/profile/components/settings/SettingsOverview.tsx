import { Group, Stack, Text } from '@mantine/core';
import type { AuthUserResponse } from '@work-archive/shared-types';

import {
  AppBadge,
  KeyValueGrid,
  SectionCard,
  SectionIntro,
} from '@shared/components/AppPrimitives';
import { formatAppDateTime, formatAppNumber, useAppTranslation } from '@app/i18n';
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

type TranslationFn = ReturnType<typeof useAppTranslation>['t'];

function formatCount(value: number) {
  return formatAppNumber(value);
}

function formatDateTime(value: string | null, t: TranslationFn) {
  if (!value) {
    return t('settings.overview.noneYet');
  }

  return formatAppDateTime(new Date(value), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
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
  const { t } = useAppTranslation();
  const googleAccount = user?.authAccounts?.find(
    (account) => account.provider === 'google',
  );
  const backupQueueLabel =
    stats.syncQueueItemCount === 0
      ? t('settings.overview.noBackupQueue')
      : t('settings.overview.backupQueueCount', {
          count: formatCount(stats.syncQueueItemCount),
        });
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
          ? t('settings.overview.scopeAuthenticatedDescription', {
              account:
                googleAccount?.email ??
                user?.email ??
                t('settings.overview.googleAccount'),
              databaseName:
                stats.databaseName ?? t('settings.overview.checking'),
            })
          : t('settings.overview.scopeGuestDescription'),
      icon: 'google',
      label: t('settings.overview.scopeLabel'),
      tone: hasStorageOriginWarning
        ? 'warning'
        : mode === 'authenticated'
          ? 'success'
          : 'muted',
      value:
        mode === 'authenticated'
          ? t('settings.overview.googleConnected')
          : t('settings.overview.localOnly'),
    },
    {
      description: [
        t('settings.overview.activeWorks', {
          count: formatCount(stats.activeWorkCount),
        }),
        t('settings.overview.deletedWorks', {
          count: formatCount(stats.deletedWorkCount),
        }),
        t('settings.overview.timelineEntries', {
          count: formatCount(stats.timelineEntryCount),
        }),
        t('settings.overview.releaseRecords', {
          count: formatCount(stats.releaseRecordCount),
        }),
      ].join(' · '),
      icon: 'data',
      label: t('settings.overview.localDataLabel'),
      tone: 'success',
      value: t('settings.overview.workCount', {
        count: formatCount(stats.activeWorkCount),
      }),
    },
    {
      description:
        mode === 'authenticated'
          ? [
              t('settings.overview.queueTotal', {
                count: formatCount(stats.syncQueueItemCount),
              }),
              t('settings.overview.queueConflict', {
                count: formatCount(stats.conflictQueueItemCount),
              }),
              t('settings.overview.queueFailed', {
                count: formatCount(stats.failedQueueItemCount),
              }),
              t('settings.overview.queueAutoMerged', {
                count: formatCount(stats.autoMergedQueueItemCount),
              }),
              t('settings.overview.localOnlyWorks', {
                count: formatCount(stats.localOnlyWorkCount),
              }),
            ].join(' · ')
          : t('settings.overview.backupGuestDescription'),
      icon: 'key',
      label: t('settings.overview.backupQueueLabel'),
      tone:
        mode === 'authenticated' && hasLocalOnlyWarning
          ? 'warning'
          : mode === 'authenticated'
            ? dataSafetyTone
            : 'muted',
      value:
        mode === 'authenticated'
          ? backupQueueLabel
          : t('settings.overview.localOnly'),
    },
    {
      description: archiveImportPreview
        ? t('settings.overview.importPreviewActive')
        : archiveFeedback?.tone === 'success'
          ? archiveFeedback.message
          : t('settings.overview.lastBackupDescription'),
      icon: 'security',
      label: t('settings.overview.lastJsonBackupLabel'),
      tone: archiveImportPreview
        ? 'warning'
        : stats.lastJsonExportAt
          ? 'success'
          : 'muted',
      value: formatDateTime(stats.lastJsonExportAt, t),
    },
  ] as const;

  return (
    <Stack gap="md">
      <SectionIntro
        description={t('settings.overview.description')}
        eyebrow={t('settings.overview.eyebrow')}
        title={t('settings.overview.title')}
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
              <Text fw={850}>{t('settings.overview.storageTitle')}</Text>
              <Text c="dimmed" size="sm">
                {t('settings.overview.storageDescription')}
              </Text>
            </Stack>
            <Group gap="xs">
              {hasStorageOriginWarning && (
                <AppBadge tone="warning">
                  {t('settings.overview.nonStandardOrigin')}
                </AppBadge>
              )}
              {hasLocalOnlyWarning && (
                <AppBadge tone="warning">
                  {t('settings.overview.localOnlyWorkWarning')}
                </AppBadge>
              )}
            </Group>
          </Group>
          <KeyValueGrid
            columns={2}
            items={[
              {
                label: t('settings.overview.currentOrigin'),
                value: stats.currentOrigin || t('settings.overview.checking'),
              },
              {
                label: t('settings.overview.currentDatabase'),
                value: stats.databaseName || t('settings.overview.checking'),
              },
              {
                label: t('settings.overview.scopeKey'),
                value: stats.archiveScopeKey || t('settings.overview.checking'),
              },
              {
                label: t('settings.overview.localOnlyWorkLabel'),
                value: t('settings.overview.workCount', {
                  count: formatCount(stats.localOnlyWorkCount),
                }),
              },
            ]}
          />
          {hasStorageOriginWarning && (
            <Text c="var(--app-state-warning)" size="sm">
              {t('settings.overview.originWarningDescription')}
            </Text>
          )}
          {hasLocalOnlyWarning && (
            <Text c="var(--app-state-warning)" size="sm">
              {t('settings.overview.localOnlyWarningDescription')}
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
