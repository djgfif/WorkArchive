import { AccountPageTemplate } from '../../../shared/components/PageTemplates';
import { AppLinkButton } from '../../../shared/components/AppPrimitives';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import {
  AppearanceSettingsSection,
  AccountIdentitySection,
  LoginSessionsSection,
  LocalArchiveSettingsSection,
  ProviderKeyVaultSection,
  ProviderReadinessSection,
} from '../components/settings/SettingsSections';
import { useAuthSessionSettings } from '../hooks/useAuthSessionSettings';
import { useImportProviderSettings } from '../hooks/useImportProviderSettings';
import { useLocalArchiveSettings } from '../hooks/useLocalArchiveSettings';

export function SettingsPage() {
  const { mode, signOut, user } = useAuthSession();
  const importProviderSettings = useImportProviderSettings(mode);
  const localArchiveSettings = useLocalArchiveSettings();
  const authSessionSettings = useAuthSessionSettings(mode, signOut);

  return (
    <AccountPageTemplate
      actions={
        <AppLinkButton to="/account">계정 홈으로 돌아가기</AppLinkButton>
      }
      description="자동 백업, 로컬 백업, 계정 상태를 한곳에서 관리합니다."
      eyebrow="설정"
      title="백업과 계정"
    >
      <AccountIdentitySection mode={mode} user={user} />

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

      <AppearanceSettingsSection />

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
