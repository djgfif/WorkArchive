import { validate } from 'class-validator';
import { describe, expect, it } from '@jest/globals';

import { PullSyncDto } from '../src/modules/sync/dto/pull-sync.dto';
import { PushSyncDto } from '../src/modules/sync/dto/push-sync.dto';

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
