import { useState } from 'react';

import {
  localArchiveService,
  type LocalArchiveImportPreview,
  type LocalArchiveScope,
} from '@features/archive';
import { useJsonArchiveExport } from '@features/archive';
import type { SettingsFeedback } from './useImportProviderSettings';

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
        message: 'CSV 내보내기 파일을 만들었습니다.',
      });
    } catch (error) {
      setArchiveFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'CSV 파일을 만들지 못했습니다.',
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
        message: '가져오기 전 미리보기를 확인하세요.',
      });
    } catch (error) {
      setPendingArchiveImport(null);
      setArchiveImportPreview(null);
      setArchiveFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'JSON 백업 파일을 읽지 못했습니다.',
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
        message: `작품 ${result.importedWorkCount}개와 권별 기록 ${result.importedReleaseRecordCount}개를 현재 로컬 아카이브로 가져왔습니다.`,
      });
    } catch (error) {
      setArchiveFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'JSON 백업 파일을 가져오지 못했습니다.',
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
