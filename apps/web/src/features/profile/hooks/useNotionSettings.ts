import { useEffect, useState } from 'react';

import { appI18n, formatAppNumber } from '@app/i18n';
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
                : appI18n.t('settings.notion.loadStatusError'),
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
        message: appI18n.t('settings.notion.requiredConnectionFields'),
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
        message: appI18n.t('settings.notion.saveConnectionSuccess'),
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('settings.notion.saveConnectionError'),
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
        message: appI18n.t('settings.notion.deleteConnectionSuccess'),
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('settings.notion.deleteConnectionError'),
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
            : appI18n.t('settings.notion.testConnectionError'),
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
        message: appI18n.t('settings.notion.pushSuccess', {
          created: formatAppNumber(result.created),
          errors: formatAppNumber(result.errors.length),
          updated: formatAppNumber(result.updated),
        }),
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('settings.notion.pushError'),
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
            ? appI18n.t('settings.notion.previewFound', {
                count: formatAppNumber(preview.total),
              })
            : appI18n.t('settings.notion.previewEmpty'),
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('settings.notion.previewError'),
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
        message: appI18n.t('settings.notion.applySuccess', {
          applied: formatAppNumber(result.applied),
          errors: formatAppNumber(result.errors.length),
        }),
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('settings.notion.applyError'),
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
