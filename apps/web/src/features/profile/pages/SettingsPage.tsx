import { AccountPageTemplate } from '../../../shared/components/PageTemplates';
import { AppLinkButton } from '../../../shared/components/AppPrimitives';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import {
  AladinIntegrationSection,
  AppearanceSettingsSection,
  LocalArchiveSettingsSection,
  ProviderReadinessSection,
  SettingsFutureSection,
} from '../components/settings/SettingsSections';
import { useImportProviderSettings } from '../hooks/useImportProviderSettings';
import { useLocalArchiveSettings } from '../hooks/useLocalArchiveSettings';

export function SettingsPage() {
  const { mode } = useAuthSession();
  const importProviderSettings = useImportProviderSettings(mode);
  const localArchiveSettings = useLocalArchiveSettings();

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

      <AladinIntegrationSection
        aladinFeedback={importProviderSettings.aladinFeedback}
        aladinStatus={importProviderSettings.aladinStatus}
        isDeletingAladinKey={importProviderSettings.isDeletingAladinKey}
        isLoadingProviderStatuses={
          importProviderSettings.isLoadingProviderStatuses
        }
        isSavingAladinKey={importProviderSettings.isSavingAladinKey}
        mode={mode}
        onDeleteAladinKey={importProviderSettings.deleteAladinKey}
        onSaveAladinKey={importProviderSettings.saveAladinKey}
        onTtbKeyChange={importProviderSettings.setTtbKey}
        ttbKey={importProviderSettings.ttbKey}
      />

      <SettingsFutureSection />
    </AccountPageTemplate>
  );
}
