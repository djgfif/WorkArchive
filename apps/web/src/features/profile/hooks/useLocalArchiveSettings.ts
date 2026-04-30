import { useState } from 'react';

import {
  localArchiveService,
  type LocalArchiveImportPreview,
} from '../../archive/services/local-archive.service';
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
  const [isExportingArchive, setIsExportingArchive] = useState(false);
  const [isImportingArchive, setIsImportingArchive] = useState(false);
  const [archiveImportPreview, setArchiveImportPreview] =
    useState<LocalArchiveImportPreview | null>(null);
  const [pendingArchiveImport, setPendingArchiveImport] = useState<
    string | null
  >(null);
  const [archiveFeedback, setArchiveFeedback] =
    useState<SettingsFeedback | null>(null);

  async function exportJson() {
    try {
      setIsExportingArchive(true);
      setArchiveFeedback(null);
      const content = await localArchiveService.createJsonExportText();

      downloadTextFile(
        `work-archive-backup-${new Date().toISOString().slice(0, 10)}.json`,
        'application/json',
        content,
      );
      setArchiveFeedback({
        tone: 'success',
        message: 'JSON 백업 파일을 만들었습니다.',
      });
    } catch (error) {
      setArchiveFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'JSON 백업 파일을 만들지 못했습니다.',
      });
    } finally {
      setIsExportingArchive(false);
    }
  }

  async function exportCsv() {
    try {
      setIsExportingArchive(true);
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
          error instanceof Error ? error.message : 'CSV 파일을 만들지 못했습니다.',
      });
    } finally {
      setIsExportingArchive(false);
    }
  }

  async function previewImportFile(file: File) {
    try {
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
  }

  return {
    archiveFeedback,
    archiveImportPreview,
    cancelImport,
    confirmImport,
    exportCsv,
    exportJson,
    isExportingArchive,
    isImportingArchive,
    previewImportFile,
  };
}
