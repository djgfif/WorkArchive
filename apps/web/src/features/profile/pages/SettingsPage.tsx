import { AccountPageTemplate } from '../../../shared/components/PageTemplates';
import { AppLinkButton } from '../../../shared/components/AppPrimitives';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import {
  AppearanceSettingsSection,
  LoginSessionsSection,
  LocalArchiveSettingsSection,
  ProviderKeyVaultSection,
  ProviderReadinessSection,
} from '../components/settings/SettingsSections';
import { useAuthSessionSettings } from '../hooks/useAuthSessionSettings';
import { useImportProviderSettings } from '../hooks/useImportProviderSettings';
import { useLocalArchiveSettings } from '../hooks/useLocalArchiveSettings';

export function SettingsPage() {
  const { mode, signOut } = useAuthSession();
  const importProviderSettings = useImportProviderSettings(mode);
  const localArchiveSettings = useLocalArchiveSettings();
  const authSessionSettings = useAuthSessionSettings(mode, signOut);

  return (
    <AccountPageTemplate
      actions={
        <AppLinkButton to="/account">계정 홈으로 돌아가기</AppLinkButton>
      }
      description="설정은 메인 제품 경험과 분리된 계정 관리 맥락에서 확장합니다."
      eyebrow="설정"
      title="설정"
    >
      <AppearanceSettingsSection />

      <LocalArchiveSettingsSection
        archiveFeedback={localArchiveSettings.archiveFeedback}
        archiveImportPreview={localArchiveSettings.archiveImportPreview}
        isExportingArchive={localArchiveSettings.isExportingArchive}
        isImportingArchive={localArchiveSettings.isImportingArchive}
        onCancelImport={localArchiveSettings.cancelImport}
        onConfirmImport={localArchiveSettings.confirmImport}
        onExportCsv={localArchiveSettings.exportCsv}
        onExportJson={localArchiveSettings.exportJson}
        onImportFileSelect={localArchiveSettings.previewImportFile}
      />

      <ProviderReadinessSection
        isLoadingProviderStatuses={
          importProviderSettings.isLoadingProviderStatuses
        }
        mode={mode}
        providerStatuses={importProviderSettings.providerStatuses}
      />

      <ProviderKeyVaultSection
        credentialDraft={importProviderSettings.credentialDraft}
        deletingProviderId={importProviderSettings.deletingProviderId}
        feedback={importProviderSettings.providerFeedback}
        isLoadingProviderStatuses={
          importProviderSettings.isLoadingProviderStatuses
        }
        keyManagedProviders={importProviderSettings.keyManagedProviders}
        mode={mode}
        onDeleteProviderKey={importProviderSettings.deleteSelectedProviderKey}
        onSaveProviderKey={importProviderSettings.saveSelectedProviderKey}
        onSelectProvider={importProviderSettings.selectProvider}
        onUpdateCredentialField={importProviderSettings.updateCredentialField}
        savingProviderId={importProviderSettings.savingProviderId}
        selectedProvider={importProviderSettings.selectedProvider}
        selectedProviderId={importProviderSettings.selectedProviderId}
      />

      <LoginSessionsSection
        feedback={authSessionSettings.sessionFeedback}
        isLoadingSessions={authSessionSettings.isLoadingSessions}
        mode={mode}
        onRefreshSessions={() => void authSessionSettings.refreshSessions()}
        onRevokeAllSessions={() => void authSessionSettings.revokeEverySession()}
        onRevokeSession={(session) =>
          void authSessionSettings.revokeSession(session)
        }
        revokingSessionId={authSessionSettings.revokingSessionId}
        sessions={authSessionSettings.sessions}
      />
    </AccountPageTemplate>
  );
}
