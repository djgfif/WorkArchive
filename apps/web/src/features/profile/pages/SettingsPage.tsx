import { Stack, Text } from '@mantine/core';

import {
  AppLinkButton,
  SectionCard,
  SectionIntro,
  ThemeToggleControl,
} from '@shared/components/AppPrimitives';
import { AccountPageTemplate } from '@shared/components/PageTemplates';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { useAuthSession } from '@features/auth';
import { AccountSettingsSection } from '../components/settings/AccountSettingsSection';
import { DangerZoneSection } from '../components/settings/DangerZoneSection';
import { DataBackupSettingsSection } from '../components/settings/DataBackupSettingsSection';
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

function DisplaySettingsSection() {
  return (
    <SectionCard>
      <SectionIntro
        description="아카이브를 읽기 편한 화면 모드로 전환합니다. 선택한 모드는 이 브라우저에 저장됩니다."
        eyebrow="표시 설정"
        title="라이트/다크 모드"
      />

      <Text c="dimmed">
        메인 레이아웃과 계정 화면에 동일하게 적용되는 표시 설정입니다.
      </Text>

      <ThemeToggleControl />
    </SectionCard>
  );
}

export function SettingsPage() {
  usePageTitle('설정과 백업');
  const { archiveScopeKey, mode, signOut, updateUser, user } = useAuthSession();
  const importProviderSettings = useImportProviderSettings(mode);
  const localArchiveSettings = useLocalArchiveSettings();
  const localDataSafetySettings = useLocalDataSafetySettings();
  const notionSettings = useNotionSettings(mode);
  const authSessionSettings = useAuthSessionSettings(mode, signOut);
  const overviewStats = useSettingsOverviewStats(archiveScopeKey);

  const sections = [
    {
      id: 'overview',
      label: '개요',
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
    {
      id: 'account',
      label: '계정',
      content: (
        <AccountSettingsSection
          mode={mode}
          onUserUpdated={updateUser ?? (() => undefined)}
          user={user}
        />
      ),
    },
    {
      id: 'data-backup',
      label: '데이터와 백업',
      content: (
        <Stack gap="md">
          <LocalDataSafetySettingsSection
            autoBackupStatus={localDataSafetySettings.autoBackupStatus}
            feedback={localDataSafetySettings.feedback}
            isChoosingBackupFolder={
              localDataSafetySettings.isChoosingBackupFolder
            }
            isLoading={localDataSafetySettings.isLoading}
            isRequestingStorage={localDataSafetySettings.isRequestingStorage}
            isRunningBackup={localDataSafetySettings.isRunningBackup}
            onChooseBackupFolder={localDataSafetySettings.chooseBackupFolder}
            onDisableBackup={localDataSafetySettings.disableBackup}
            onRequestStorageProtection={
              localDataSafetySettings.requestStorageProtection
            }
            onRunBackupNow={localDataSafetySettings.runBackupNow}
            storageState={localDataSafetySettings.storageState}
          />
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
        </Stack>
      ),
    },
    {
      id: 'external-import',
      label: '외부 기록 가져오기',
      content: <ExternalImportSettingsSection />,
    },
    {
      id: 'duplicate-cleanup',
      label: '중복 정리',
      content: (
        <DuplicateCleanupSettingsSection archiveScopeKey={archiveScopeKey} />
      ),
    },
    {
      id: 'search-providers',
      label: '검색 소스와 API 키',
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
      label: 'Notion 동기화',
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
      id: 'display',
      label: '표시 설정',
      content: <DisplaySettingsSection />,
    },
    {
      id: 'security',
      label: '보안',
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
      label: '위험 작업',
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
  ];

  return (
    <AccountPageTemplate
      actions={
        <AppLinkButton to="/account">계정 개요로 돌아가기</AppLinkButton>
      }
      description="계정 연결, 로컬 백업, 검색 소스, API 키, 세션 보안을 한 곳에서 관리합니다."
      eyebrow="설정"
      title="설정과 백업"
    >
      <SettingsLayout sections={sections} />
    </AccountPageTemplate>
  );
}
