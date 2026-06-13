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
import { appI18n } from '@app/i18n';
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
          ? appI18n.t('localDataSafety.storageSecured')
          : appI18n.t('localDataSafety.storageDenied'),
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('localDataSafety.storageError'),
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
        message: appI18n.t('localDataSafety.autoBackupFolderReady'),
      });
    } catch (error) {
      await refresh();
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('localDataSafety.autoBackupFolderError'),
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
        message: appI18n.t('localDataSafety.autoBackupNowReady'),
      });
    } catch (error) {
      await refresh();
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('localDataSafety.autoBackupFileError'),
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
        message: appI18n.t('localDataSafety.autoBackupDisabled'),
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : appI18n.t('localDataSafety.autoBackupDisableError'),
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
