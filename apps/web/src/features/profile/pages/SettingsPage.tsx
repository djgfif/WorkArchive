import { Select, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';

import {
  AppLinkButton,
  SectionCard,
  SectionIntro,
  ThemeToggleControl,
} from '@shared/components/AppPrimitives';
import { AccountPageTemplate } from '@shared/components/PageTemplates';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { useAppLocale, useAppTranslation, type AppLocale } from '@app/i18n';
import { useAuthSession } from '@features/auth';
import { useSyncDashboard } from '@features/sync';
import { AccountBackupStatusSettingsSection } from '../components/settings/AccountBackupStatusSettingsSection';
import { AccountSettingsSection } from '../components/settings/AccountSettingsSection';
import { DangerZoneSection } from '../components/settings/DangerZoneSection';
import { DataBackupSettingsSection } from '../components/settings/DataBackupSettingsSection';
import { DataSafetySummarySection } from '../components/settings/DataSafetySummarySection';
import { DuplicateCleanupSettingsSection } from '../components/settings/DuplicateCleanupSettingsSection';
import { ExternalImportSettingsSection } from '../components/settings/ExternalImportSettingsSection';
import { LocalDataSafetySettingsSection } from '../components/settings/LocalDataSafetySettingsSection';
import { NotionSyncSettingsSection } from '../components/settings/NotionSyncSettingsSection';
import { SearchProviderSettingsSection } from '../components/settings/SearchProviderSettingsSection';
import { SecuritySettingsSection } from '../components/settings/SecuritySettingsSection';
import { SettingsLayout } from '../components/settings/SettingsLayout';
import { SettingsOverview } from '../components/settings/SettingsOverview';
import { useAuthSessionSettings } from '../hooks/useAuthSessionSettings';
import { useImportProviderSettings } from '../hooks/useImportProviderSettings';
import { useLocalArchiveSettings } from '../hooks/useLocalArchiveSettings';
import { useLocalDataSafetySettings } from '../hooks/useLocalDataSafetySettings';
import { useNotionSettings } from '../hooks/useNotionSettings';
import { useSettingsOverviewStats } from '../hooks/useSettingsOverviewStats';
import { getDataSafetyViewModel } from '../utils/data-safety-view-model';
import settingsStyles from '../components/settings/SettingsControlCenter.module.css';

type SettingsGroupId = 'account' | 'data' | 'integrations' | 'general';

const sectionGroupById: Partial<Record<string, SettingsGroupId>> = {
  account: 'account',
  security: 'account',
  'danger-zone': 'account',
  'data-backup': 'data',
  'duplicate-cleanup': 'data',
  'external-import': 'integrations',
  'search-providers': 'integrations',
  'notion-sync': 'integrations',
  language: 'general',
  display: 'general',
};

function DisplaySettingsSection() {
  const { t } = useAppTranslation();

  return (
    <SectionCard>
      <SectionIntro
        description={t('settings.displayDescription')}
        eyebrow={t('settings.displayEyebrow')}
        title={t('settings.displayTitle')}
      />

      <Text c="dimmed">{t('settings.displayHelp')}</Text>

      <ThemeToggleControl />
    </SectionCard>
  );
}

function LanguageSettingsSection() {
  const { enabledLocales, locale, setLocale } = useAppLocale();
  const { t } = useAppTranslation();

  return (
    <SectionCard>
      <SectionIntro
        description={t('locale.description')}
        eyebrow={t('locale.eyebrow')}
        title={t('locale.title')}
      />

      <Select
        data={enabledLocales.map((option) => ({
          label:
            option.availability === 'beta'
              ? `${option.nativeLabel} · ${t('locale.availability.beta')}`
              : option.nativeLabel,
          value: option.locale,
        }))}
        description={t('locale.currentDescription')}
        label={t('locale.currentLabel')}
        onChange={(value) => {
          if (!value) return;
          void setLocale(value as AppLocale);
        }}
        value={locale}
      />

      {enabledLocales.length === 1 && (
        <Text c="dimmed" size="sm">
          {t('locale.onlySingleLocaleReady', {
            locale: enabledLocales[0]?.nativeLabel ?? '',
          })}
        </Text>
      )}
    </SectionCard>
  );
}

export function SettingsPage() {
  const { t } = useAppTranslation();

  usePageTitle(t('settings.pageTitle'));
  const { archiveScopeKey, mode, signOut, updateUser, user } = useAuthSession();
  const importProviderSettings = useImportProviderSettings(mode);
  const localArchiveSettings = useLocalArchiveSettings();
  const localDataSafetySettings = useLocalDataSafetySettings();
  const notionSettings = useNotionSettings(mode);
  const authSessionSettings = useAuthSessionSettings(mode, signOut);
  const overviewStats = useSettingsOverviewStats(archiveScopeKey);
  const syncDashboard = useSyncDashboard();
  const requeuedSyncCount = syncDashboard.pendingItems.filter(
    (item) => item.state === 'requeued',
  ).length;
  const dataSafetyViewModel = useMemo(
    () =>
      getDataSafetyViewModel({
        autoBackupStatus: localDataSafetySettings.autoBackupStatus,
        mode,
        overviewStats,
        storageState: localDataSafetySettings.storageState,
        sync: {
          conflictCount: syncDashboard.conflictItems.length,
          failedCount: syncDashboard.failedItems.length,
          lastSuccessfulPullAt: syncDashboard.lastSuccessfulPullAt,
          pendingCount: syncDashboard.pendingItems.length,
          requeuedCount: requeuedSyncCount,
          staleStatusAt: syncDashboard.staleStatusAt,
        },
      }),
    [
      localDataSafetySettings.autoBackupStatus,
      localDataSafetySettings.storageState,
      mode,
      overviewStats,
      requeuedSyncCount,
      syncDashboard.conflictItems.length,
      syncDashboard.failedItems.length,
      syncDashboard.lastSuccessfulPullAt,
      syncDashboard.pendingItems.length,
      syncDashboard.staleStatusAt,
    ],
  );

  const sections = [
    {
      id: 'data-backup',
      label: t('settings.sections.dataBackup'),
      content: (
        <Stack gap="md">
          <DataSafetySummarySection viewModel={dataSafetyViewModel} />
          <DataBackupSettingsSection
            archiveFeedback={localArchiveSettings.archiveFeedback}
            archiveImportPreview={localArchiveSettings.archiveImportPreview}
            isExportingArchive={localArchiveSettings.isExportingArchive}
            isImportingArchive={localArchiveSettings.isImportingArchive}
            onCancelImport={localArchiveSettings.cancelImport}
            onConfirmImport={localArchiveSettings.confirmImport}
            onExportCsv={localArchiveSettings.exportCsv}
            onExportFullJson={localArchiveSettings.exportFullJson}
            onExportJson={localArchiveSettings.exportJson}
            onImportFileSelect={localArchiveSettings.previewImportFile}
          />
          <details className={settingsStyles.advancedDataSafety}>
            <summary>{t('settings.layout.dataSafetyAdvancedTitle')}</summary>
            <Stack gap="md" mt="md">
              <LocalDataSafetySettingsSection
                autoBackupStatus={localDataSafetySettings.autoBackupStatus}
                feedback={localDataSafetySettings.feedback}
                isChoosingBackupFolder={
                  localDataSafetySettings.isChoosingBackupFolder
                }
                isLoading={localDataSafetySettings.isLoading}
                isRequestingStorage={
                  localDataSafetySettings.isRequestingStorage
                }
                isRunningBackup={localDataSafetySettings.isRunningBackup}
                onChooseBackupFolder={
                  localDataSafetySettings.chooseBackupFolder
                }
                onDisableBackup={localDataSafetySettings.disableBackup}
                onRequestStorageProtection={
                  localDataSafetySettings.requestStorageProtection
                }
                onRunBackupNow={localDataSafetySettings.runBackupNow}
                storageState={localDataSafetySettings.storageState}
              />
              <AccountBackupStatusSettingsSection
                conflictItems={syncDashboard.conflictItems}
                failedItems={syncDashboard.failedItems}
                lastSuccessfulPullAt={syncDashboard.lastSuccessfulPullAt}
                mode={mode}
                pendingItems={syncDashboard.pendingItems}
                staleStatusAt={syncDashboard.staleStatusAt}
              />
            </Stack>
          </details>
        </Stack>
      ),
    },
    {
      id: 'account',
      label: t('settings.sections.account'),
      content: (
        <AccountSettingsSection
          mode={mode}
          onUserUpdated={updateUser ?? (() => undefined)}
          user={user}
        />
      ),
    },
    {
      id: 'external-import',
      label: t('settings.sections.externalImport'),
      content: <ExternalImportSettingsSection />,
    },
    {
      id: 'duplicate-cleanup',
      label: t('settings.sections.duplicateCleanup'),
      content: (
        <DuplicateCleanupSettingsSection archiveScopeKey={archiveScopeKey} />
      ),
    },
    {
      id: 'search-providers',
      label: t('settings.sections.searchProviders'),
      content: (
        <SearchProviderSettingsSection
          credentialDraft={importProviderSettings.credentialDraft}
          deletingProviderId={importProviderSettings.deletingProviderId}
          feedback={importProviderSettings.providerFeedback}
          isLoadingProviderStatuses={
            importProviderSettings.isLoadingProviderStatuses
          }
          mode={mode}
          onDeleteProviderKey={importProviderSettings.deleteSelectedProviderKey}
          onSaveProviderKey={importProviderSettings.saveSelectedProviderKey}
          onSelectProvider={importProviderSettings.selectProvider}
          onTestProviderKey={importProviderSettings.testSelectedProviderKey}
          onUpdateCredentialField={importProviderSettings.updateCredentialField}
          providerStatuses={importProviderSettings.providerStatuses}
          savingProviderId={importProviderSettings.savingProviderId}
          selectedProvider={importProviderSettings.selectedProvider}
          selectedProviderId={importProviderSettings.selectedProviderId}
          testingProviderId={importProviderSettings.testingProviderId}
        />
      ),
    },
    {
      id: 'notion-sync',
      label: t('settings.sections.notionSync'),
      content: (
        <NotionSyncSettingsSection
          connectionDraft={notionSettings.connectionDraft}
          feedback={notionSettings.feedback}
          isApplyingPull={notionSettings.isApplyingPull}
          isDeletingConnection={notionSettings.isDeletingConnection}
          isLoadingStatus={notionSettings.isLoadingStatus}
          isPreviewingPull={notionSettings.isPreviewingPull}
          isPushing={notionSettings.isPushing}
          isSavingConnection={notionSettings.isSavingConnection}
          isTestingConnection={notionSettings.isTestingConnection}
          mode={mode}
          onApplyPull={notionSettings.applyPull}
          onDeleteConnection={notionSettings.deleteConnection}
          onPreviewPull={notionSettings.previewPull}
          onPushToNotion={notionSettings.pushToNotion}
          onSaveConnection={notionSettings.saveConnection}
          onTestConnection={notionSettings.testConnection}
          onUpdateConnectionDraft={notionSettings.updateConnectionDraft}
          pullPreview={notionSettings.pullPreview}
          status={notionSettings.status}
        />
      ),
    },
    {
      id: 'language',
      label: t('settings.sections.language'),
      content: <LanguageSettingsSection />,
    },
    {
      id: 'display',
      label: t('settings.sections.display'),
      content: <DisplaySettingsSection />,
    },
    {
      id: 'security',
      label: t('settings.sections.security'),
      content: (
        <SecuritySettingsSection
          feedback={authSessionSettings.sessionFeedback}
          isLoadingSessions={authSessionSettings.isLoadingSessions}
          mode={mode}
          onRefreshSessions={() => void authSessionSettings.refreshSessions()}
          onRevokeSession={(session) =>
            void authSessionSettings.revokeSession(session)
          }
          revokingSessionId={authSessionSettings.revokingSessionId}
          sessions={authSessionSettings.sessions}
        />
      ),
    },
    {
      id: 'danger-zone',
      label: t('settings.sections.dangerZone'),
      content: (
        <DangerZoneSection
          mode={mode}
          onRevokeAllSessions={() =>
            void authSessionSettings.revokeEverySession()
          }
          revokingSessionId={authSessionSettings.revokingSessionId}
          sessionCount={authSessionSettings.sessions.length}
        />
      ),
    },
    {
      id: 'overview',
      label: t('settings.sections.overview'),
      content: (
        <SettingsOverview
          archiveFeedback={localArchiveSettings.archiveFeedback}
          archiveImportPreview={localArchiveSettings.archiveImportPreview}
          isExportingArchive={localArchiveSettings.isExportingArchive}
          mode={mode}
          onExportJson={localArchiveSettings.exportJson}
          stats={overviewStats}
          user={user}
        />
      ),
    },
  ];

  const groupedSections = sections.map((section) => ({
    ...section,
    group: sectionGroupById[section.id],
  }));

  return (
    <AccountPageTemplate
      actions={
        <AppLinkButton
          className={settingsStyles.pageBackAction ?? ''}
          to="/account"
        >
          {t('settings.backToAccountOverview')}
        </AppLinkButton>
      }
      description={t('settings.pageDescription')}
      eyebrow={t('settings.pageEyebrow')}
      title={t('settings.pageTitle')}
    >
      <SettingsLayout sections={groupedSections} />
    </AccountPageTemplate>
  );
}
