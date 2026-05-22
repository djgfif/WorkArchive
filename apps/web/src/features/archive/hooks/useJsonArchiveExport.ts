import { useState } from 'react';

import { appMetaRepository } from '../../sync/queue';
import { localArchiveService } from '../services/local-archive.service';
import { LAST_JSON_EXPORT_AT_META_KEY } from '../utils/json-backup-reminder';

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

export async function exportJsonArchiveBackup() {
  const content = await localArchiveService.createJsonExportText();
  const exportedAt = new Date().toISOString();

  downloadTextFile(
    `work-archive-backup-${exportedAt.slice(0, 10)}.json`,
    'application/json',
    content,
  );
  await appMetaRepository.setValue(LAST_JSON_EXPORT_AT_META_KEY, exportedAt);

  return exportedAt;
}

export function useJsonArchiveExport() {
  const [feedback, setFeedback] = useState<JsonArchiveExportFeedback | null>(
    null,
  );
  const [isExporting, setIsExporting] = useState(false);

  async function exportJson() {
    try {
      setIsExporting(true);
      setFeedback(null);
      await exportJsonArchiveBackup();
      setFeedback({
        tone: 'success',
        message: 'JSON 백업 파일을 만들었습니다.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'JSON 백업 파일을 만들지 못했습니다.',
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
