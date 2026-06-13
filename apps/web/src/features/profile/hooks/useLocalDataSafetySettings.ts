import { useCallback, useEffect, useState } from 'react';

import {
  chooseAutomaticJsonBackupDirectory,
  disableAutomaticJsonBackup,
  getAutomaticJsonBackupStatus,
  runAutomaticJsonBackupNow,
  type AutomaticJsonBackupStatus,
} from '@features/archive';
import {
  getStoragePersistenceState,
  requestPersistentStorage,
  type StoragePersistenceState,
} from '@shared/runtime/persistent-storage';
import type { SettingsFeedback } from './useImportProviderSettings';

const EMPTY_STORAGE_STATE: StoragePersistenceState = {
  persisted: false,
  quotaBytes: null,
  supported: false,
  usageBytes: null,
};

const EMPTY_AUTO_BACKUP_STATUS: AutomaticJsonBackupStatus = {
  configuredAt: null,
  enabled: false,
  hasSessionFolder: false,
  lastAttemptAt: null,
  lastError: null,
  lastFileName: null,
  lastObservedChangeAt: null,
  lastSucceededAt: null,
  permission: 'unknown',
  supported: false,
};

export function useLocalDataSafetySettings() {
  const [storageState, setStorageState] =
    useState<StoragePersistenceState>(EMPTY_STORAGE_STATE);
  const [autoBackupStatus, setAutoBackupStatus] =
    useState<AutomaticJsonBackupStatus>(EMPTY_AUTO_BACKUP_STATUS);
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestingStorage, setIsRequestingStorage] = useState(false);
  const [isChoosingBackupFolder, setIsChoosingBackupFolder] = useState(false);
  const [isRunningBackup, setIsRunningBackup] = useState(false);

  const refresh = useCallback(async () => {
    const [nextStorageState, nextAutoBackupStatus] = await Promise.all([
      getStoragePersistenceState(),
      getAutomaticJsonBackupStatus(),
    ]);

    setStorageState(nextStorageState);
    setAutoBackupStatus(nextAutoBackupStatus);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [nextStorageState, nextAutoBackupStatus] = await Promise.all([
          getStoragePersistenceState(),
          getAutomaticJsonBackupStatus(),
        ]);

        if (!cancelled) {
          setStorageState(nextStorageState);
          setAutoBackupStatus(nextAutoBackupStatus);
        }
      } catch {
        // The settings page may unmount while Dexie is switching or closing DBs in tests.
        // A later refresh will repopulate the state when the page is open.
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function requestStorageProtection() {
    try {
      setIsRequestingStorage(true);
      setFeedback(null);
      const approved = await requestPersistentStorage();

      await refresh();
      setFeedback({
        tone: approved ? 'success' : 'info',
        message: approved
          ? '이 브라우저에서 로컬 저장소 보호를 확보했습니다.'
          : '브라우저가 저장소 보호 요청을 승인하지 않았습니다. 기록은 계속 이 기기에 저장됩니다.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : '저장소 보호 상태를 확인하지 못했습니다.',
      });
    } finally {
      setIsRequestingStorage(false);
    }
  }

  async function chooseBackupFolder() {
    try {
      setIsChoosingBackupFolder(true);
      setFeedback(null);
      await chooseAutomaticJsonBackupDirectory();
      await runAutomaticJsonBackupNow();
      await refresh();
      setFeedback({
        tone: 'success',
        message: '자동 백업 폴더를 연결하고 전체 JSON 백업을 만들었습니다.',
      });
    } catch (error) {
      await refresh();
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : '자동 백업 폴더를 연결하지 못했습니다.',
      });
    } finally {
      setIsChoosingBackupFolder(false);
    }
  }

  async function runBackupNow() {
    try {
      setIsRunningBackup(true);
      setFeedback(null);
      await runAutomaticJsonBackupNow();
      await refresh();
      setFeedback({
        tone: 'success',
        message: '자동 백업 폴더에 전체 JSON 백업을 만들었습니다.',
      });
    } catch (error) {
      await refresh();
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : '자동 백업 파일을 만들지 못했습니다.',
      });
    } finally {
      setIsRunningBackup(false);
    }
  }

  async function disableBackup() {
    try {
      setFeedback(null);
      await disableAutomaticJsonBackup();
      await refresh();
      setFeedback({
        tone: 'info',
        message: '자동 폴더 백업을 껐습니다. 수동 JSON 백업은 계속 사용할 수 있습니다.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : '자동 백업 설정을 변경하지 못했습니다.',
      });
    }
  }

  return {
    autoBackupStatus,
    chooseBackupFolder,
    disableBackup,
    feedback,
    isChoosingBackupFolder,
    isLoading,
    isRequestingStorage,
    isRunningBackup,
    requestStorageProtection,
    runBackupNow,
    storageState,
  };
}
