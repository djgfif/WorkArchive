import { appI18n } from '@app/i18n';

import { appMetaRepository } from '../../sync/queue';
import { localArchiveService } from './local-archive.service';
import {
  LAST_JSON_BACKUP_SUMMARY_META_KEY,
  LAST_JSON_EXPORT_AT_META_KEY,
} from '../utils/json-backup-reminder';

export const AUTO_JSON_BACKUP_META_KEY = 'archive.autoJsonBackup';
const ONE_DAY_MS = 86_400_000;
const CHANGE_SETTLE_MS = 5 * 60 * 1000;
const FAILED_RETRY_MS = 60 * 60 * 1000;

type PermissionStateLike = 'denied' | 'granted' | 'prompt';

interface FileSystemWritableFileStreamLike {
  close: () => Promise<void>;
  write: (data: string) => Promise<void>;
}

interface FileSystemFileLike {
  text: () => Promise<string>;
}

interface FileSystemFileHandleLike {
  createWritable: () => Promise<FileSystemWritableFileStreamLike>;
  getFile?: () => Promise<FileSystemFileLike>;
}

export interface FileSystemDirectoryHandleLike {
  getFileHandle: (
    name: string,
    options: { create: boolean },
  ) => Promise<FileSystemFileHandleLike>;
  name?: string;
  queryPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionStateLike>;
  requestPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionStateLike>;
}

type FileSystemAccessWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandleLike>;
};

export interface AutomaticJsonBackupSettings {
  configuredAt: string | null;
  enabled: boolean;
  lastAttemptAt: string | null;
  lastError: string | null;
  lastFileName: string | null;
  lastObservedChangeAt: string | null;
  lastSucceededAt: string | null;
}

export interface AutomaticJsonBackupStatus extends AutomaticJsonBackupSettings {
  hasSessionFolder: boolean;
  permission: 'denied' | 'granted' | 'prompt' | 'unknown' | 'unsupported';
  supported: boolean;
}

export interface AutomaticJsonBackupResult {
  fileName: string;
  exportedAt: string;
}

const DEFAULT_AUTO_BACKUP_SETTINGS: AutomaticJsonBackupSettings = {
  configuredAt: null,
  enabled: false,
  lastAttemptAt: null,
  lastError: null,
  lastFileName: null,
  lastObservedChangeAt: null,
  lastSucceededAt: null,
};

function getAutomaticBackupMessage(
  key: 'createError' | 'folderPermissionRequired' | 'folderReselectRequired' | 'unsupported',
) {
  return appI18n.t(`archive.backup.automatic.${key}`);
}

let sessionDirectoryHandle: FileSystemDirectoryHandleLike | null = null;

function getFileSystemWindow() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window as FileSystemAccessWindow;
}

function parseSettings(value: string | null): AutomaticJsonBackupSettings {
  if (!value) {
    return { ...DEFAULT_AUTO_BACKUP_SETTINGS };
  }

  try {
    const parsed = JSON.parse(value) as Partial<AutomaticJsonBackupSettings>;

    return {
      configuredAt: parsed.configuredAt ?? null,
      enabled: parsed.enabled === true,
      lastAttemptAt: parsed.lastAttemptAt ?? null,
      lastError: parsed.lastError ?? null,
      lastFileName: parsed.lastFileName ?? null,
      lastObservedChangeAt: parsed.lastObservedChangeAt ?? null,
      lastSucceededAt: parsed.lastSucceededAt ?? null,
    };
  } catch {
    return { ...DEFAULT_AUTO_BACKUP_SETTINGS };
  }
}

function toIso(now: Date) {
  return now.toISOString();
}

function getBackupFileName(now: Date) {
  return `work-archive-full-backup-${toIso(now).slice(0, 10)}.json`;
}

async function saveSettings(settings: AutomaticJsonBackupSettings) {
  await appMetaRepository.setValue(
    AUTO_JSON_BACKUP_META_KEY,
    JSON.stringify(settings),
  );

  return settings;
}

async function getSessionPermission() {
  if (!sessionDirectoryHandle) {
    return 'unknown' as const;
  }

  if (typeof sessionDirectoryHandle.queryPermission !== 'function') {
    return 'granted' as const;
  }

  return sessionDirectoryHandle
    .queryPermission({ mode: 'readwrite' })
    .catch(() => 'unknown' as const);
}

async function requestSessionPermission() {
  if (!sessionDirectoryHandle) {
    return 'unknown' as const;
  }

  if (typeof sessionDirectoryHandle.requestPermission !== 'function') {
    return 'granted' as const;
  }

  return sessionDirectoryHandle
    .requestPermission({ mode: 'readwrite' })
    .catch(() => 'denied' as const);
}

function isBackupDue(settings: AutomaticJsonBackupSettings, now: Date) {
  if (!settings.enabled) {
    return false;
  }

  if (settings.lastError && settings.lastAttemptAt) {
    const lastAttemptMs = Date.parse(settings.lastAttemptAt);

    if (
      Number.isFinite(lastAttemptMs) &&
      now.getTime() - lastAttemptMs < FAILED_RETRY_MS
    ) {
      return false;
    }
  }

  if (!settings.lastSucceededAt) {
    return true;
  }

  const lastSucceededMs = Date.parse(settings.lastSucceededAt);

  if (!Number.isFinite(lastSucceededMs)) {
    return true;
  }

  if (now.getTime() - lastSucceededMs >= ONE_DAY_MS) {
    return true;
  }

  if (!settings.lastObservedChangeAt) {
    return false;
  }

  const lastObservedChangeMs = Date.parse(settings.lastObservedChangeAt);

  return (
    Number.isFinite(lastObservedChangeMs) &&
    lastObservedChangeMs > lastSucceededMs &&
    now.getTime() - lastObservedChangeMs >= CHANGE_SETTLE_MS
  );
}

export function isAutomaticJsonBackupSupported() {
  return typeof getFileSystemWindow()?.showDirectoryPicker === 'function';
}

export async function getAutomaticJsonBackupSettings() {
  return parseSettings(await appMetaRepository.getValue(AUTO_JSON_BACKUP_META_KEY));
}

export async function recordAutomaticJsonBackupLocalChange(now = new Date()) {
  const settings = await getAutomaticJsonBackupSettings();

  if (!settings.enabled) {
    return settings;
  }

  return saveSettings({
    ...settings,
    lastObservedChangeAt: toIso(now),
  });
}

export async function getAutomaticJsonBackupStatus(): Promise<AutomaticJsonBackupStatus> {
  const settings = await getAutomaticJsonBackupSettings();
  const supported = isAutomaticJsonBackupSupported();

  return {
    ...settings,
    hasSessionFolder: sessionDirectoryHandle !== null,
    permission: supported ? await getSessionPermission() : 'unsupported',
    supported,
  };
}

export async function chooseAutomaticJsonBackupDirectory(
  now = new Date(),
): Promise<AutomaticJsonBackupStatus> {
  const fileSystemWindow = getFileSystemWindow();

  if (typeof fileSystemWindow?.showDirectoryPicker !== 'function') {
    throw new Error(getAutomaticBackupMessage('unsupported'));
  }

  sessionDirectoryHandle = await fileSystemWindow.showDirectoryPicker({
    mode: 'readwrite',
  });

  const permission = await requestSessionPermission();

  if (permission !== 'granted') {
    sessionDirectoryHandle = null;
    throw new Error(getAutomaticBackupMessage('folderPermissionRequired'));
  }

  const existing = await getAutomaticJsonBackupSettings();

  await saveSettings({
    ...existing,
    configuredAt: existing.configuredAt ?? toIso(now),
    enabled: true,
    lastError: null,
  });

  return getAutomaticJsonBackupStatus();
}

export async function disableAutomaticJsonBackup() {
  sessionDirectoryHandle = null;

  await saveSettings({
    ...(await getAutomaticJsonBackupSettings()),
    enabled: false,
    lastError: null,
  });

  return getAutomaticJsonBackupStatus();
}

export async function runAutomaticJsonBackupNow(
  now = new Date(),
): Promise<AutomaticJsonBackupResult> {
  const settings = await getAutomaticJsonBackupSettings();
  const attemptedAt = toIso(now);

  if (!isAutomaticJsonBackupSupported()) {
    const message = getAutomaticBackupMessage('unsupported');
    await saveSettings({
      ...settings,
      lastAttemptAt: attemptedAt,
      lastError: message,
    });
    throw new Error(message);
  }

  if (!sessionDirectoryHandle) {
    const message = getAutomaticBackupMessage('folderReselectRequired');
    await saveSettings({
      ...settings,
      lastAttemptAt: attemptedAt,
      lastError: message,
    });
    throw new Error(message);
  }

  const permission = await requestSessionPermission();

  if (permission !== 'granted') {
    const message = getAutomaticBackupMessage('folderPermissionRequired');
    await saveSettings({
      ...settings,
      lastAttemptAt: attemptedAt,
      lastError: message,
    });
    throw new Error(message);
  }

  try {
    const fileName = getBackupFileName(now);
    const artifact = await localArchiveService.createJsonBackupArtifact('full', {
      fileName,
      now,
    });
    const fileHandle = await sessionDirectoryHandle.getFileHandle(fileName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();

    await writable.write(artifact.content);
    await writable.close();
    const summary =
      typeof fileHandle.getFile === 'function'
        ? await localArchiveService.verifyJsonBackupText(
            await (await fileHandle.getFile()).text(),
            artifact.summary,
            now,
          )
        : artifact.summary;

    await Promise.all([
      appMetaRepository.setValue(LAST_JSON_EXPORT_AT_META_KEY, attemptedAt),
      appMetaRepository.setValue(
        LAST_JSON_BACKUP_SUMMARY_META_KEY,
        JSON.stringify(summary),
      ),
    ]);
    await saveSettings({
      ...settings,
      enabled: true,
      lastAttemptAt: attemptedAt,
      lastError: null,
      lastFileName: fileName,
      lastSucceededAt: attemptedAt,
    });

    return {
      exportedAt: attemptedAt,
      fileName,
    };
  } catch (error) {
    await saveSettings({
      ...settings,
      lastAttemptAt: attemptedAt,
      lastError:
        error instanceof Error
          ? error.message
          : getAutomaticBackupMessage('createError'),
    });
    throw error;
  }
}

export async function runAutomaticJsonBackupIfDue(now = new Date()) {
  const settings = await getAutomaticJsonBackupSettings();

  if (!isBackupDue(settings, now)) {
    return null;
  }

  return runAutomaticJsonBackupNow(now);
}

export function resetAutomaticJsonBackupSessionForTest() {
  sessionDirectoryHandle = null;
}
