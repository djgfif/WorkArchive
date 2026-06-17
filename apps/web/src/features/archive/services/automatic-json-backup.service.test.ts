import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetWorkArchiveStorage, workArchiveDbManager } from '@features/works';
import {
  LAST_JSON_BACKUP_SUMMARY_META_KEY,
  LAST_JSON_EXPORT_AT_META_KEY,
} from '../utils/json-backup-reminder';
import {
  AUTO_JSON_BACKUP_META_KEY,
  chooseAutomaticJsonBackupDirectory,
  getAutomaticJsonBackupStatus,
  recordAutomaticJsonBackupLocalChange,
  resetAutomaticJsonBackupSessionForTest,
  runAutomaticJsonBackupIfDue,
  runAutomaticJsonBackupNow,
  type FileSystemDirectoryHandleLike,
} from './automatic-json-backup.service';

function createFakeDirectoryHandle(
  permission: 'denied' | 'granted' = 'granted',
  options: { readback?: (value: string) => string } = {},
) {
  let writtenValue = '';
  const write = vi.fn(async (value: string) => {
    writtenValue = value;
  });
  const close = vi.fn(async () => undefined);
  const createWritable = vi.fn(async () => ({
    close,
    write,
  }));
  const getFile = vi.fn(async () => ({
    text: vi.fn(async () => options.readback?.(writtenValue) ?? writtenValue),
  }));
  const getFileHandle = vi.fn(async (_name: string, _options: { create: boolean }) => ({
    createWritable,
    getFile,
  }));
  const handle: FileSystemDirectoryHandleLike = {
    getFileHandle,
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => permission),
  };

  return {
    close,
    createWritable,
    getFile,
    getFileHandle,
    handle,
    write,
  };
}

describe('automatic JSON backup service', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetAutomaticJsonBackupSessionForTest();
    await resetWorkArchiveStorage();
  });

  it('reports unsupported browsers without enabling automatic backup', async () => {
    vi.stubGlobal('window', {});

    await expect(getAutomaticJsonBackupStatus()).resolves.toMatchObject({
      enabled: false,
      permission: 'unsupported',
      supported: false,
    });
    await expect(runAutomaticJsonBackupNow()).rejects.toThrow(
      '자동 폴더 백업을 사용할 수 없습니다',
    );
  });

  it('connects a folder and writes a dated full JSON backup file', async () => {
    const directory = createFakeDirectoryHandle();

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn(async () => directory.handle),
    });
    workArchiveDbManager.switchToGuest();

    await chooseAutomaticJsonBackupDirectory(
      new Date('2026-06-13T09:00:00.000Z'),
    );
    const result = await runAutomaticJsonBackupNow(
      new Date('2026-06-13T10:00:00.000Z'),
    );
    const db = workArchiveDbManager.getCurrentDb();

    expect(result).toEqual({
      exportedAt: '2026-06-13T10:00:00.000Z',
      fileName: 'work-archive-full-backup-2026-06-13.json',
    });
    expect(directory.getFileHandle).toHaveBeenCalledWith(
      'work-archive-full-backup-2026-06-13.json',
      { create: true },
    );
    expect(directory.write).toHaveBeenCalledWith(
      expect.stringContaining('"scope": "full"'),
    );
    await expect(db.appMeta.get(LAST_JSON_EXPORT_AT_META_KEY)).resolves.toMatchObject({
      value: '2026-06-13T10:00:00.000Z',
    });
    await expect(
      db.appMeta.get(LAST_JSON_BACKUP_SUMMARY_META_KEY),
    ).resolves.toMatchObject({
      value: expect.stringContaining('"fileVerifiedAt"'),
    });
    expect(directory.getFile).toHaveBeenCalled();
    await expect(db.appMeta.get(AUTO_JSON_BACKUP_META_KEY)).resolves.toEqual(
      expect.objectContaining({
        value: expect.stringContaining(
          'work-archive-full-backup-2026-06-13.json',
        ),
      }),
    );
  });

  it('skips app-open backup checks until a day has passed', async () => {
    const directory = createFakeDirectoryHandle();

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn(async () => directory.handle),
    });

    await chooseAutomaticJsonBackupDirectory(
      new Date('2026-06-13T09:00:00.000Z'),
    );
    await runAutomaticJsonBackupNow(new Date('2026-06-13T10:00:00.000Z'));
    directory.write.mockClear();

    await expect(
      runAutomaticJsonBackupIfDue(new Date('2026-06-13T18:00:00.000Z')),
    ).resolves.toBeNull();
    expect(directory.write).not.toHaveBeenCalled();

    await expect(
      runAutomaticJsonBackupIfDue(new Date('2026-06-14T10:01:00.000Z')),
    ).resolves.toEqual(
      expect.objectContaining({
        fileName: 'work-archive-full-backup-2026-06-14.json',
      }),
    );
  });

  it('backs up again after local changes settle while the app is open', async () => {
    const directory = createFakeDirectoryHandle();

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn(async () => directory.handle),
    });

    await chooseAutomaticJsonBackupDirectory(
      new Date('2026-06-13T09:00:00.000Z'),
    );
    await runAutomaticJsonBackupNow(new Date('2026-06-13T10:00:00.000Z'));
    directory.write.mockClear();

    await recordAutomaticJsonBackupLocalChange(
      new Date('2026-06-13T10:05:00.000Z'),
    );

    await expect(
      runAutomaticJsonBackupIfDue(new Date('2026-06-13T10:08:00.000Z')),
    ).resolves.toBeNull();
    expect(directory.write).not.toHaveBeenCalled();

    await expect(
      runAutomaticJsonBackupIfDue(new Date('2026-06-13T10:11:00.000Z')),
    ).resolves.toEqual(
      expect.objectContaining({
        fileName: 'work-archive-full-backup-2026-06-13.json',
      }),
    );
    expect(directory.write).toHaveBeenCalledWith(
      expect.stringContaining('"scope": "full"'),
    );
  });

  it('fails automatic backup when file readback does not match generated content', async () => {
    const directory = createFakeDirectoryHandle('granted', {
      readback: (value) => value.replace('"scope": "full"', '"scope": "simple"'),
    });

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn(async () => directory.handle),
    });

    await chooseAutomaticJsonBackupDirectory(
      new Date('2026-06-13T09:00:00.000Z'),
    );
    await expect(
      runAutomaticJsonBackupNow(new Date('2026-06-13T10:00:00.000Z')),
    ).rejects.toThrow(
      '백업 파일을 다시 읽은 결과가 생성한 JSON과 일치하지 않습니다',
    );
    const db = workArchiveDbManager.getCurrentDb();

    await expect(db.appMeta.get(LAST_JSON_EXPORT_AT_META_KEY)).resolves.toBeUndefined();
    await expect(
      db.appMeta.get(LAST_JSON_BACKUP_SUMMARY_META_KEY),
    ).resolves.toBeUndefined();
  });

  it('throttles repeated app-open failures after a missing session folder', async () => {
    const directory = createFakeDirectoryHandle();

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn(async () => directory.handle),
    });

    await chooseAutomaticJsonBackupDirectory(
      new Date('2026-06-13T09:00:00.000Z'),
    );
    resetAutomaticJsonBackupSessionForTest();

    await expect(
      runAutomaticJsonBackupIfDue(new Date('2026-06-13T10:00:00.000Z')),
    ).rejects.toThrow('이번 세션에서 백업 폴더를 다시 선택해야 합니다');
    await expect(
      runAutomaticJsonBackupIfDue(new Date('2026-06-13T10:30:00.000Z')),
    ).resolves.toBeNull();
  });

  it('stores permission failures as lightweight metadata', async () => {
    const directory = createFakeDirectoryHandle('denied');

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn(async () => directory.handle),
    });

    await expect(chooseAutomaticJsonBackupDirectory()).rejects.toThrow(
      '백업 폴더 쓰기 권한이 필요합니다',
    );
    await expect(getAutomaticJsonBackupStatus()).resolves.toMatchObject({
      enabled: false,
      hasSessionFolder: false,
    });
  });
});
