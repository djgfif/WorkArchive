import { useEffect, useState } from 'react';

import {
  importsService,
  type ImportProviderStatus,
} from '../../imports/services/imports.service';

type SettingsAuthMode = 'authenticated' | 'guest';

export interface SettingsFeedback {
  message: string;
  tone: 'error' | 'info' | 'success';
}

export function useImportProviderSettings(mode: SettingsAuthMode) {
  const [providerStatuses, setProviderStatuses] = useState<
    ImportProviderStatus[]
  >([]);
  const [ttbKey, setTtbKey] = useState('');
  const [isLoadingProviderStatuses, setIsLoadingProviderStatuses] =
    useState(false);
  const [isSavingAladinKey, setIsSavingAladinKey] = useState(false);
  const [isDeletingAladinKey, setIsDeletingAladinKey] = useState(false);
  const [aladinFeedback, setAladinFeedback] =
    useState<SettingsFeedback | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadProviderStatuses() {
      if (mode !== 'authenticated') {
        setProviderStatuses([]);
        setAladinFeedback(null);

        return;
      }

      try {
        setIsLoadingProviderStatuses(true);
        const statuses = await importsService.listProviders();

        if (!isCancelled) {
          setProviderStatuses(statuses);
          setAladinFeedback(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setAladinFeedback({
            tone: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Aladin 설정 상태를 불러오지 못했습니다.',
          });
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingProviderStatuses(false);
        }
      }
    }

    void loadProviderStatuses();

    return () => {
      isCancelled = true;
    };
  }, [mode]);

  async function saveAladinKey() {
    if (!ttbKey.trim()) {
      setAladinFeedback({
        tone: 'error',
        message: 'Aladin TTBKey를 입력해주세요.',
      });

      return;
    }

    try {
      setIsSavingAladinKey(true);
      const status = await importsService.saveAladinKey(ttbKey);

      setProviderStatuses((current) =>
        current.map((entry) =>
          entry.provider === status.provider
            ? { ...entry, configured: true }
            : entry,
        ),
      );
      setTtbKey('');
      setAladinFeedback({
        tone: 'success',
        message: 'Aladin TTBKey를 저장했습니다.',
      });
    } catch (error) {
      setAladinFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Aladin TTBKey를 저장하지 못했습니다.',
      });
    } finally {
      setIsSavingAladinKey(false);
    }
  }

  async function deleteAladinKey() {
    try {
      setIsDeletingAladinKey(true);
      await importsService.deleteAladinKey();
      setProviderStatuses((current) =>
        current.map((entry) =>
          entry.provider === 'aladin' ? { ...entry, configured: false } : entry,
        ),
      );
      setTtbKey('');
      setAladinFeedback({
        tone: 'success',
        message: 'Aladin TTBKey를 삭제했습니다.',
      });
    } catch (error) {
      setAladinFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Aladin TTBKey를 삭제하지 못했습니다.',
      });
    } finally {
      setIsDeletingAladinKey(false);
    }
  }

  return {
    aladinFeedback,
    aladinStatus:
      providerStatuses.find((status) => status.provider === 'aladin') ?? null,
    deleteAladinKey,
    isDeletingAladinKey,
    isLoadingProviderStatuses,
    isSavingAladinKey,
    providerStatuses,
    saveAladinKey,
    setTtbKey,
    ttbKey,
  };
}
