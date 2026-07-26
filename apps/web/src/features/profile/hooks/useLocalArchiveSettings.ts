import { useState } from 'react';

import { appI18n } from '@app/i18n';
import {
  localArchiveService,
  type LocalArchiveImportPreview,
  type LocalArchiveScope,
} from '@features/archive';
import { useJsonArchiveExport } from '@features/archive';
import { downloadTextFile } from '@shared/utils/download-file';
import type { SettingsFeedback } from './useImportProviderSettings';

export function useLocalArchiveSettings() {
  const jsonArchiveExport = useJsonArchiveExport();
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isImportingArchive, setIsImportingArchive] = useState(false);
  const [archiveImportPreview, setArchiveImportPreview] =
    useState<LocalArchiveImportPreview | null>(null);
  const [pendingArchiveImport, setPendingArchiveImport] = useState<
    string | null
  >(null);
  const [archiveFeedback, setArchiveFeedback] =
    useState<SettingsFeedback | null>(null);

  async function exportJson(scope: LocalArchiveScope = 'simple') {
    setArchiveFeedback(null);
    await jsonArchiveExport.exportJson(scope);
  }

  async function exportCsv() {
    try {
      setIsExportingCsv(true);
      jsonArchiveExport.clearFeedback();
      setArchiveFeedback(null);
      const content = await localArchiveService.createCsvExportText();

      downloadTextFile(
        `work-archive-records-${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv;charset=utf-8',
        content,
      );
      setArchiveFeedback({
        tone: 'success',
        message: appI18n.t('localArchive.csvCreated'),
      });
    } catch (error) {
      setArchiveFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('localArchive.csvCreateError'),
      });
    } finally {
      setIsExportingCsv(false);
    }
  }

  async function previewImportFile(file: File) {
    try {
      jsonArchiveExport.clearFeedback();
      const content = await file.text();
      const preview = await localArchiveService.previewImport(content);

      setPendingArchiveImport(content);
      setArchiveImportPreview(preview);
      setArchiveFeedback({
        tone: 'info',
        message: appI18n.t('localArchive.importPreview'),
      });
    } catch (error) {
      setPendingArchiveImport(null);
      setArchiveImportPreview(null);
      setArchiveFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('localArchive.jsonReadError'),
      });
    }
  }

  async function confirmImport() {
    if (!pendingArchiveImport) {
      return;
    }

    try {
      setIsImportingArchive(true);
      const result = await localArchiveService.importJson(pendingArchiveImport);

      setPendingArchiveImport(null);
      setArchiveImportPreview(null);
      setArchiveFeedback({
        tone: 'success',
        message: appI18n.t('localArchive.importConfirm', {
          releaseRecordCount: result.importedReleaseRecordCount,
          workCount: result.importedWorkCount,
        }),
      });
    } catch (error) {
      setArchiveFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('localArchive.jsonImportError'),
      });
    } finally {
      setIsImportingArchive(false);
    }
  }

  function cancelImport() {
    setPendingArchiveImport(null);
    setArchiveImportPreview(null);
    setArchiveFeedback(null);
    jsonArchiveExport.clearFeedback();
  }

  return {
    archiveFeedback: archiveFeedback ?? jsonArchiveExport.feedback,
    archiveImportPreview,
    cancelImport,
    confirmImport,
    exportCsv,
    exportJson,
    exportFullJson: () => exportJson('full'),
    isExportingArchive: isExportingCsv || jsonArchiveExport.isExporting,
    isImportingArchive,
    previewImportFile,
  };
}
