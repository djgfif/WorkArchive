import { validate } from 'class-validator';
import { describe, expect, it } from '@jest/globals';

import { PullSyncDto } from '../src/modules/sync/dto/pull-sync.dto';
import { PushSyncDto } from '../src/modules/sync/dto/push-sync.dto';
import { SyncCursorService } from '../src/modules/sync/services/sync-cursor.service';
import { MAX_PULL_CURSOR_LENGTH } from '../src/modules/sync/sync-internal.types';

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

  it('rejects oversized or non-base64url pull cursors at the DTO boundary', async () => {
    const oversizedCursorDto = Object.assign(new PullSyncDto(), {
      cursor: 'a'.repeat(MAX_PULL_CURSOR_LENGTH + 1),
    });
    const invalidCharacterCursorDto = Object.assign(new PullSyncDto(), {
      cursor: 'not+a+base64url+cursor',
    });

    await expect(validate(oversizedCursorDto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'cursor',
        }),
      ]),
    );
    await expect(validate(invalidCharacterCursorDto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'cursor',
        }),
      ]),
    );
  });

  it('parses server-issued cursors and rejects forged cursor entity ids', () => {
    const validCursor = {
      entityId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      entityType: 'work' as const,
      updatedAt: '2026-04-18T02:00:00.000Z',
    };
    const forgedCursor = Buffer.from(
      JSON.stringify({
        ...validCursor,
        entityId: 'not-a-uuid',
      }),
      'utf8',
    ).toString('base64url');

    expect(
      cursorService.parsePullCursor(cursorService.encodePullCursor(validCursor)),
    ).toEqual(validCursor);
    expect(() => cursorService.parsePullCursor(forgedCursor)).toThrow(
      'cursor must be a valid sync pull cursor.',
    );
  });

  it('rejects oversized pull cursors before decoding', () => {
    expect(() =>
      cursorService.parsePullCursor('a'.repeat(MAX_PULL_CURSOR_LENGTH + 1)),
    ).toThrow('cursor must be a valid sync pull cursor.');
  });

  it('keeps default pull limit at 500', () => {
    expect(cursorService.resolvePullLimit(undefined)).toBe(500);
  });

  it('caps oversized pull limits at 1000', () => {
    expect(cursorService.resolvePullLimit(1500)).toBe(1000);
  });

  it('compares entity ids by code point to match the database C collation', () => {
    // Must follow Unicode code-point order (matching Postgres `COLLATE "C"`),
    // not ICU collation. A hyphen (U+002D) sorts before a letter by code point;
    // if the in-memory ordering diverged from the cursor filter here, records
    // sharing an updatedAt could be silently dropped at a page boundary.
    expect(cursorService.compareEntityIds('a-b', 'ab')).toBeLessThan(0);
    expect(cursorService.compareEntityIds('ab', 'a-b')).toBeGreaterThan(0);

    expect(
      cursorService.compareEntityIds(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      ),
    ).toBeLessThan(0);
    expect(cursorService.compareEntityIds('same', 'same')).toBe(0);
  });
});
