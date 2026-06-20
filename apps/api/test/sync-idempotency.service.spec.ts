import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { PushSyncChangeDto } from '../src/modules/sync/dto/push-sync.dto';
import type { PushSyncResultDto } from '../src/modules/sync/dto/push-sync-response.dto';
import {
  SYNC_APPLIED_REPLAY_TTL_MS,
  SYNC_FAILED_REPLAY_TTL_MS,
  SyncIdempotencyService,
} from '../src/modules/sync/services/sync-idempotency.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';
const NOW = new Date('2026-06-18T09:00:00.000Z');

const baseChange = {
  queueId: '51f573a9-17fa-4f27-bf7b-f292a45c7b3e',
  clientMutationId: '1551b294-f106-4d02-b0fb-91e535e89e64',
  entityId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
  entityType: 'work',
  operation: 'update',
  createdAt: '2026-06-18T08:59:00.000Z',
  payload: {
    id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    title: 'Dune',
  } as PushSyncChangeDto['payload'],
} satisfies PushSyncChangeDto;

describe('SyncIdempotencyService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores applied replay rows with a bounded long-lived retention window', async () => {
    const createdRows: Array<{ data: Record<string, unknown> }> = [];
    const service = new SyncIdempotencyService(
      createPrismaMock(createdRows) as unknown as PrismaService,
    );

    const result = await service.applyIdempotentChange(
      USER_ID,
      baseChange,
      async () => buildResult('applied', 'applied_change'),
    );

    expect(result.status).toBe('applied');
    expect(createdRows[0]?.data).toMatchObject({
      clientMutationId: baseChange.clientMutationId,
      resultStatus: 'applied',
      userId: USER_ID,
    });
    expect(createdRows[0]?.data.expiresAt).toEqual(
      new Date(NOW.getTime() + SYNC_APPLIED_REPLAY_TTL_MS),
    );
  });

  it('stores conflict and validation replay rows with the short replay window', async () => {
    const createdRows: Array<{ data: Record<string, unknown> }> = [];
    const service = new SyncIdempotencyService(
      createPrismaMock(createdRows) as unknown as PrismaService,
    );

    await service.applyIdempotentChange(USER_ID, baseChange, async () =>
      buildResult('conflict', 'conflict_remote_newer'),
    );

    expect(createdRows[0]?.data).toMatchObject({
      resultStatus: 'conflict',
    });
    expect(createdRows[0]?.data.expiresAt).toEqual(
      new Date(NOW.getTime() + SYNC_FAILED_REPLAY_TTL_MS),
    );
  });
});

function createPrismaMock(createdRows: Array<{ data: Record<string, unknown> }>) {
  const tx = {
    userSyncAppliedMutation: {
      create: jest.fn(async (input: { data: Record<string, unknown> }) => {
        createdRows.push(input);

        return input.data;
      }),
      findUnique: jest.fn(async () => null),
    },
  };

  return {
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
      callback(tx),
  };
}

function buildResult(
  status: PushSyncResultDto['status'],
  code: NonNullable<PushSyncResultDto['code']>,
): PushSyncResultDto {
  return {
    code,
    entityId: baseChange.entityId,
    entityType: baseChange.entityType,
    message: 'result',
    queueId: baseChange.queueId,
    status,
  };
}
