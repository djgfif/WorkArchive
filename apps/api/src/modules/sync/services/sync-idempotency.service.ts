import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { PushSyncChangeDto } from '../dto/push-sync.dto';
import type { PushSyncResultDto } from '../dto/push-sync-response.dto';
import { PrismaService } from '../../../prisma/prisma.service';

export const SYNC_FAILED_REPLAY_TTL_MS = 24 * 60 * 60 * 1_000;
export const SYNC_APPLIED_REPLAY_TTL_MS = 180 * 24 * 60 * 60 * 1_000;

@Injectable()
export class SyncIdempotencyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  applyIdempotentChange(
    userId: string,
    change: PushSyncChangeDto,
    applyChange: (
      client: Prisma.TransactionClient,
    ) => Promise<PushSyncResultDto>,
    onResult?: (result: PushSyncResultDto) => void,
  ): Promise<PushSyncResultDto> {
    const clientMutationId = change.clientMutationId ?? change.queueId;
    const payloadHash = this.hashChangePayload(change);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.userSyncAppliedMutation.findUnique({
        where: {
          userId_clientMutationId: {
            clientMutationId,
            userId,
          },
        },
      });

      if (existing) {
        const existingPayloadHash =
          typeof existing.payloadHash === 'string'
            ? existing.payloadHash
            : null;

        if (existingPayloadHash && existingPayloadHash !== payloadHash) {
          return this.buildClientMutationReusedFailure(change);
        }

        return this.buildIdempotentReplayResult(
          existing.result as unknown as PushSyncResultDto,
        );
      }

      const result = await applyChange(tx);
      onResult?.(result);

      if (this.shouldStoreReplayResult(result)) {
        await tx.userSyncAppliedMutation.create({
          data: {
            clientMutationId,
            entityId: change.entityId,
            entityType: change.entityType,
            expiresAt: this.getReplayExpiresAt(result),
            payloadHash,
            queueId: change.queueId,
            result: this.toJsonValue(result),
            resultStatus: result.status,
            userId,
          },
        });
      }

      return result;
    });
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private buildIdempotentReplayResult(
    result: PushSyncResultDto,
  ): PushSyncResultDto {
    if (result.status !== 'applied') {
      return result;
    }

    return {
      ...result,
      code: 'already_applied',
      message: 'Client mutation was already applied on the server.',
      status: 'applied',
    };
  }

  private shouldStoreReplayResult(result: PushSyncResultDto) {
    return (
      result.status === 'applied' ||
      result.status === 'conflict' ||
      result.code === 'failed_validation'
    );
  }

  private getReplayExpiresAt(result: PushSyncResultDto) {
    const ttlMs =
      result.status === 'applied'
        ? SYNC_APPLIED_REPLAY_TTL_MS
        : SYNC_FAILED_REPLAY_TTL_MS;

    return new Date(Date.now() + ttlMs);
  }

  private buildClientMutationReusedFailure(
    change: PushSyncChangeDto,
  ): PushSyncResultDto {
    return {
      code: 'failed_client_mutation_reused',
      entityId: change.entityId,
      entityType: change.entityType,
      message:
        'clientMutationId was already used with a different payload. Create a new queued mutation.',
      queueId: change.queueId,
      status: 'failed',
    };
  }

  private hashChangePayload(change: PushSyncChangeDto) {
    return createHash('sha256')
      .update(
        this.stableStringify({
          entityId: change.entityId,
          entityType: change.entityType,
          operation: change.operation,
          payload: change.payload,
        }),
      )
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;

      return `{${Object.keys(record)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.stableStringify(record[key])}`,
        )
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }
}
