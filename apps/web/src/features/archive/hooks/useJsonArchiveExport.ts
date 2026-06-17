import { useState } from 'react';

import { appI18n } from '@app/i18n';
import { appMetaRepository } from '../../sync/queue';
import {
  localArchiveService,
  type LocalArchiveScope,
} from '../services/local-archive.service';
import {
  LAST_JSON_BACKUP_SUMMARY_META_KEY,
  LAST_JSON_EXPORT_AT_META_KEY,
} from '../utils/json-backup-reminder';

export interface JsonArchiveExportFeedback {
  message: string;
  tone: 'error' | 'info' | 'success';
}

function downloadTextFile(filename: string, type: string, content: string) {
  const blob = new Blob([content], {
    type,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportJsonArchiveBackup(
  scope: LocalArchiveScope = 'simple',
) {
  const artifact = await localArchiveService.createJsonBackupArtifact(scope);
  const { content, summary } = artifact;

  downloadTextFile(
    summary.fileName,
    'application/json',
    content,
  );
  await Promise.all([
    appMetaRepository.setValue(LAST_JSON_EXPORT_AT_META_KEY, summary.exportedAt),
    appMetaRepository.setValue(
      LAST_JSON_BACKUP_SUMMARY_META_KEY,
      JSON.stringify(summary),
    ),
  ]);

  return summary.exportedAt;
}

export function useJsonArchiveExport() {
  const [feedback, setFeedback] = useState<JsonArchiveExportFeedback | null>(
    null,
  );
  const [isExporting, setIsExporting] = useState(false);

  async function exportJson(scope: LocalArchiveScope = 'simple') {
    try {
      setIsExporting(true);
      setFeedback(null);
      await exportJsonArchiveBackup(scope);
      setFeedback({
        tone: 'success',
        message:
          scope === 'full'
            ? appI18n.t('archive.backup.exportFullSuccess')
            : appI18n.t('archive.backup.exportSimpleSuccess'),
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('archive.backup.exportError'),
      });
    } finally {
      setIsExporting(false);
    }
  }

  function clearFeedback() {
    setFeedback(null);
  }

  return {
    clearFeedback,
    exportJson,
    feedback,
    isExporting,
  };
}
