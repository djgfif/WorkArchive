import { describe, expect, it } from 'vitest';

import { getJsonBackupReminderStatus } from './json-backup-reminder';

const NOW = new Date('2026-05-22T00:00:00.000Z');

describe('getJsonBackupReminderStatus', () => {
  it('does not require a JSON backup for an empty archive', () => {
    const status = getJsonBackupReminderStatus({
      activeWorkCount: 0,
      lastJsonExportAt: null,
      now: NOW,
    });

    expect(status.shouldShow).toBe(false);
    expect(status.reason).toBe('none');
  });

  it('marks JSON backup as missing after the first active record', () => {
    const status = getJsonBackupReminderStatus({
      activeWorkCount: 1,
      lastJsonExportAt: null,
      now: NOW,
    });

    expect(status.shouldShow).toBe(true);
    expect(status.reason).toBe('missing');
  });

  it('does not remind before 30 days have passed since the last JSON backup', () => {
    const status = getJsonBackupReminderStatus({
      activeWorkCount: 50,
      lastJsonExportAt: '2026-04-23T00:00:00.000Z',
      now: NOW,
    });

    expect(status.daysSinceLastBackup).toBe(29);
    expect(status.shouldShow).toBe(false);
  });

  it('reminds after 30 days have passed since the last JSON backup', () => {
    const status = getJsonBackupReminderStatus({
      activeWorkCount: 1,
      lastJsonExportAt: '2026-04-22T00:00:00.000Z',
      now: NOW,
    });

    expect(status.daysSinceLastBackup).toBe(30);
    expect(status.shouldShow).toBe(true);
    expect(status.reason).toBe('stale');
  });
});
