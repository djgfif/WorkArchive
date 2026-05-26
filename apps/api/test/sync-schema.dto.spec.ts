import { validate } from 'class-validator';
import { describe, expect, it } from '@jest/globals';

import { PullSyncDto } from '../src/modules/sync/dto/pull-sync.dto';
import { PushSyncDto } from '../src/modules/sync/dto/push-sync.dto';
import { SyncCursorService } from '../src/modules/sync/services/sync-cursor.service';

describe('sync schema version DTOs', () => {
  it('accepts omitted schemaVersion as v2 compatibility input', async () => {
    const pushDto = Object.assign(new PushSyncDto(), {
      changes: [],
    });
    const pullDto = Object.assign(new PullSyncDto(), {
      since: null,
    });

    await expect(validate(pushDto)).resolves.not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'schemaVersion',
        }),
      ]),
    );
    await expect(validate(pullDto)).resolves.toEqual([]);
  });

  it('rejects unsupported sync schema versions', async () => {
    const pushDto = Object.assign(new PushSyncDto(), {
      changes: [],
      schemaVersion: 1,
    });
    const pullDto = Object.assign(new PullSyncDto(), {
      schemaVersion: 1,
    });

    await expect(validate(pushDto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'schemaVersion',
        }),
      ]),
    );
    await expect(validate(pullDto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'schemaVersion',
        }),
      ]),
    );
  });

  it('rejects null schemaVersion instead of treating it as omitted', async () => {
    const pushDto = Object.assign(new PushSyncDto(), {
      changes: [],
      schemaVersion: null,
    });
    const pullDto = Object.assign(new PullSyncDto(), {
      schemaVersion: null,
    });

    await expect(validate(pushDto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'schemaVersion',
        }),
      ]),
    );
    await expect(validate(pullDto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'schemaVersion',
        }),
      ]),
    );
  });
});

describe('sync pull cursor limits', () => {
  const cursorService = new SyncCursorService();

  it('keeps default pull limit at 500', () => {
    expect(cursorService.resolvePullLimit(undefined)).toBe(500);
  });

  it('caps oversized pull limits at 1000', () => {
    expect(cursorService.resolvePullLimit(1500)).toBe(1000);
  });

  it('orders same-timestamp cursor continuity by entity type and id', () => {
    const cursor = {
      entityId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      entityType: 'release_record' as const,
      updatedAt: '2026-04-18T02:00:00.000Z',
    };
    const sameTimestamp = new Date('2026-04-18T02:00:00.000Z');

    expect(
      cursorService.isAfterCursor(
        cursor,
        'timeline_entry',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        sameTimestamp,
      ),
    ).toBe(true);
    expect(
      cursorService.isAfterCursor(
        cursor,
        'release_record',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        sameTimestamp,
      ),
    ).toBe(false);
  });
});
