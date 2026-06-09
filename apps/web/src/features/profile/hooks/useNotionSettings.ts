import { useEffect, useState } from 'react';

import {
  notionService,
  type NotionPreviewResponse,
  type NotionStatusResponse,
} from '../services/notion.service';
import type { SettingsFeedback } from './useImportProviderSettings';

type SettingsAuthMode = 'authenticated' | 'guest';

export function useNotionSettings(mode: SettingsAuthMode) {
  const [connectionDraft, setConnectionDraft] = useState({
    dataSourceId: '',
    token: '',
  });
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null);
  const [isApplyingPull, setIsApplyingPull] = useState(false);
  const [isDeletingConnection, setIsDeletingConnection] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isPreviewingPull, setIsPreviewingPull] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [pullPreview, setPullPreview] = useState<NotionPreviewResponse | null>(
    null,
  );
  const [status, setStatus] = useState<NotionStatusResponse | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadStatus() {
      if (mode !== 'authenticated') {
        setStatus(null);
        setPullPreview(null);
        setFeedback(null);

        return;
      }

      try {
        setIsLoadingStatus(true);
        const nextStatus = await notionService.getStatus();

        if (!isCancelled) {
          setStatus(nextStatus);
          setConnectionDraft((current) => ({
            ...current,
            dataSourceId: nextStatus.dataSourceId ?? current.dataSourceId,
          }));
        }
      } catch (error) {
        if (!isCancelled) {
          setFeedback({
            tone: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Notion 연결 상태를 불러오지 못했습니다.',
          });
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingStatus(false);
        }
      }
    }

    void loadStatus();

    return () => {
      isCancelled = true;
    };
  }, [mode]);

  function updateConnectionDraft(field: 'dataSourceId' | 'token', value: string) {
    setConnectionDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveConnection() {
    if (!connectionDraft.token.trim() || !connectionDraft.dataSourceId.trim()) {
      setFeedback({
        tone: 'error',
        message: 'Notion token과 data source ID를 모두 입력해 주세요.',
      });

      return;
    }

    try {
      setIsSavingConnection(true);
      const nextStatus = await notionService.saveConnection(connectionDraft);
      setStatus(nextStatus);
      setConnectionDraft((current) => ({
        dataSourceId: nextStatus.dataSourceId ?? current.dataSourceId,
        token: '',
      }));
      setFeedback({
        tone: 'success',
        message: 'Notion 연결을 저장했습니다.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Notion 연결을 저장하지 못했습니다.',
      });
    } finally {
      setIsSavingConnection(false);
    }
  }

  async function deleteConnection() {
    try {
      setIsDeletingConnection(true);
      await notionService.deleteConnection();
      setStatus({
        configured: false,
        dataSourceId: null,
        lastSyncedAt: null,
        mappedCount: 0,
        requiredProperties: [],
      });
      setPullPreview(null);
      setFeedback({
        tone: 'success',
        message: 'Notion 연결과 매핑을 삭제했습니다.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Notion 연결을 삭제하지 못했습니다.',
      });
    } finally {
      setIsDeletingConnection(false);
    }
  }

  async function testConnection() {
    try {
      setIsTestingConnection(true);
      const result = await notionService.testConnection();
      setFeedback({
        tone: result.ok ? 'success' : 'error',
        message: result.message,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Notion 연결 테스트에 실패했습니다.',
      });
    } finally {
      setIsTestingConnection(false);
    }
  }

  async function pushToNotion() {
    try {
      setIsPushing(true);
      const result = await notionService.push();
      const nextStatus = await notionService.getStatus();
      setStatus(nextStatus);
      setFeedback({
        tone: result.errors.length > 0 ? 'info' : 'success',
        message: `Notion으로 ${result.created}개 생성, ${result.updated}개 업데이트했습니다. 실패 ${result.errors.length}개.`,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Notion으로 내보내지 못했습니다.',
      });
    } finally {
      setIsPushing(false);
    }
  }

  async function previewPull() {
    try {
      setIsPreviewingPull(true);
      const preview = await notionService.previewPull();
      setPullPreview(preview);
      setFeedback({
        tone: preview.total > 0 ? 'info' : 'success',
        message:
          preview.total > 0
            ? `Notion에서 적용 가능한 변경 ${preview.total}건을 찾았습니다.`
            : 'Notion에서 적용할 새 변경이 없습니다.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Notion 변경사항을 확인하지 못했습니다.',
      });
    } finally {
      setIsPreviewingPull(false);
    }
  }

  async function applyPull() {
    try {
      setIsApplyingPull(true);
      const workIds = pullPreview?.changes.map((entry) => entry.workId);
      const result = await notionService.applyPull(
        workIds ? { workIds } : {},
      );
      setPullPreview(null);
      setFeedback({
        tone: result.errors.length > 0 ? 'info' : 'success',
        message: `Notion 변경사항 ${result.applied}건을 Work Archive에 적용했습니다. 실패 ${result.errors.length}건.`,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Notion 변경사항을 적용하지 못했습니다.',
      });
    } finally {
      setIsApplyingPull(false);
    }
  }

  return {
    applyPull,
    connectionDraft,
    deleteConnection,
    feedback,
    isApplyingPull,
    isDeletingConnection,
    isLoadingStatus,
    isPreviewingPull,
    isPushing,
    isSavingConnection,
    isTestingConnection,
    previewPull,
    pullPreview,
    pushToNotion,
    saveConnection,
    status,
    testConnection,
    updateConnectionDraft,
  };
}
