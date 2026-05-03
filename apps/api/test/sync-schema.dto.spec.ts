import { validate } from 'class-validator';
import { describe, expect, it } from '@jest/globals';

import { PullSyncDto } from '../src/modules/sync/dto/pull-sync.dto';
import { PushSyncDto } from '../src/modules/sync/dto/push-sync.dto';

describe('sync schema version DTOs', () => {
  it('accepts omitted schemaVersion as v1 compatibility input', async () => {
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
      schemaVersion: 2,
    });
    const pullDto = Object.assign(new PullSyncDto(), {
      schemaVersion: 2,
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
