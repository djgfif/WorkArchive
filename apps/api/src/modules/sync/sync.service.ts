import { Inject, Injectable } from '@nestjs/common';
import {
  WorkSyncStatus,
  type Prisma,
  type Work,
  type WorkStatus,
  type WorkTier,
  type WorkType,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { toWorkSyncStatusValue } from '../works/works.constants';
import type { WorkResponseDto } from '../works/dto/work-response.dto';
import type { PullSyncDto } from './dto/pull-sync.dto';
import type { PullSyncResponseDto } from './dto/pull-sync-response.dto';
import type { PushSyncChangeDto, PushSyncDto } from './dto/push-sync.dto';
import type {
  PushSyncResponseDto,
  PushSyncResultDto,
} from './dto/push-sync-response.dto';
import type { SyncWorkPayloadDto } from './dto/sync-work-payload.dto';

const SERVER_SYNC_STATUS = WorkSyncStatus.synced;

@Injectable()
export class SyncService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async push({ changes }: PushSyncDto): Promise<PushSyncResponseDto> {
    const results: PushSyncResultDto[] = [];

    for (const change of [...changes].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    )) {
      results.push(await this.applyChange(change));
    }

    return {
      processedAt: new Date().toISOString(),
      results,
    };
  }

  async pull({ since }: PullSyncDto): Promise<PullSyncResponseDto> {
    const works = await this.prisma.work.findMany({
      ...(since === undefined || since === null
        ? {}
        : {
            where: {
              updatedAt: {
                gt: new Date(since),
              },
            },
          }),
      orderBy: {
        updatedAt: 'asc',
      },
    });

    const pulledAt = new Date().toISOString();
    const nextSince =
      works.length === 0
        ? (since ?? pulledAt)
        : works[works.length - 1]!.updatedAt.toISOString();

    return {
      pulledAt,
      nextSince,
      changes: works.map((work) => ({
        entityType: 'work',
        entityId: work.id,
        operation: work.deletedAt === null ? 'upsert' : 'delete',
        work: this.toResponse(work),
      })),
    };
  }

  private async applyChange(
    change: PushSyncChangeDto,
  ): Promise<PushSyncResultDto> {
    const existing = await this.prisma.work.findUnique({
      where: {
        id: change.entityId,
      },
    });

    if (!existing) {
      return this.applyMissingRemoteChange(change);
    }

    if (this.areEquivalent(existing, change.payload)) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'applied',
        message: 'Remote record already matches the queued change.',
        work: this.toResponse(existing),
      };
    }

    if (!this.shouldApplyLocalChange(existing, change.payload)) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'conflict',
        message: this.buildConflictMessage(existing, change.payload),
        work: this.toResponse(existing),
      };
    }

    const updated = await this.prisma.work.update({
      where: {
        id: change.entityId,
      },
      data: this.buildUpdateData(change.payload),
    });

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'work',
      status: 'applied',
      message:
        change.payload.deletedAt === null
          ? 'Queued change applied on the server.'
          : 'Queued tombstone applied on the server.',
      work: this.toResponse(updated),
    };
  }

  private async applyMissingRemoteChange(
    change: PushSyncChangeDto,
  ): Promise<PushSyncResultDto> {
    const isDelete =
      change.operation === 'delete' || change.payload.deletedAt !== null;
    const canCreate =
      change.operation === 'create' || change.payload.serverVersion === 0;

    if (isDelete) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'applied',
        message:
          'Remote delete was a no-op because the server record is missing.',
        work: null,
      };
    }

    if (!canCreate) {
      return {
        queueId: change.queueId,
        entityId: change.entityId,
        entityType: 'work',
        status: 'conflict',
        message: 'Server mismatch: the record does not exist remotely anymore.',
        work: null,
      };
    }

    const created = await this.prisma.work.create({
      data: this.buildCreateData(change.payload),
    });

    return {
      queueId: change.queueId,
      entityId: change.entityId,
      entityType: 'work',
      status: 'applied',
      message: 'Queued record created on the server.',
      work: this.toResponse(created),
    };
  }

  private shouldApplyLocalChange(existing: Work, payload: SyncWorkPayloadDto) {
    if (payload.serverVersion === existing.serverVersion) {
      return true;
    }

    return new Date(payload.updatedAt).getTime() > existing.updatedAt.getTime();
  }

  private buildCreateData(payload: SyncWorkPayloadDto): Prisma.WorkCreateInput {
    return {
      id: payload.id,
      type: payload.type as WorkType,
      title: payload.title.trim(),
      author: this.normalizeString(payload.author),
      genres: this.normalizeGenres(payload.genres),
      description: this.normalizeString(payload.description),
      thumbnailUrl: this.normalizeString(payload.thumbnailUrl),
      status: payload.status as WorkStatus,
      rating: payload.rating ?? null,
      shortReview: this.normalizeString(payload.shortReview),
      review: this.normalizeString(payload.review),
      tier: (payload.tier ?? null) as WorkTier | null,
      favorite: payload.favorite,
      createdAt: new Date(payload.createdAt),
      deletedAt: payload.deletedAt ? new Date(payload.deletedAt) : null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: 1,
    };
  }

  private buildUpdateData(payload: SyncWorkPayloadDto): Prisma.WorkUpdateInput {
    return {
      type: payload.type as WorkType,
      title: payload.title.trim(),
      author: this.normalizeString(payload.author),
      genres: this.normalizeGenres(payload.genres),
      description: this.normalizeString(payload.description),
      thumbnailUrl: this.normalizeString(payload.thumbnailUrl),
      status: payload.status as WorkStatus,
      rating: payload.rating ?? null,
      shortReview: this.normalizeString(payload.shortReview),
      review: this.normalizeString(payload.review),
      tier: (payload.tier ?? null) as WorkTier | null,
      favorite: payload.favorite,
      deletedAt: payload.deletedAt ? new Date(payload.deletedAt) : null,
      syncStatus: SERVER_SYNC_STATUS,
      serverVersion: {
        increment: 1,
      },
    };
  }

  private areEquivalent(existing: Work, payload: SyncWorkPayloadDto) {
    return (
      existing.type === payload.type &&
      existing.title === payload.title.trim() &&
      existing.author === this.normalizeString(payload.author) &&
      JSON.stringify(existing.genres) ===
        JSON.stringify(this.normalizeGenres(payload.genres)) &&
      existing.description === this.normalizeString(payload.description) &&
      existing.thumbnailUrl === this.normalizeString(payload.thumbnailUrl) &&
      existing.status === payload.status &&
      existing.rating === (payload.rating ?? null) &&
      existing.shortReview === this.normalizeString(payload.shortReview) &&
      existing.review === this.normalizeString(payload.review) &&
      existing.tier === (payload.tier ?? null) &&
      existing.favorite === payload.favorite &&
      existing.deletedAt?.toISOString() ===
        (payload.deletedAt === null ? undefined : payload.deletedAt)
    );
  }

  private buildConflictMessage(existing: Work, payload: SyncWorkPayloadDto) {
    const remoteDeletedAt = existing.deletedAt?.toISOString() ?? 'active';
    const localDeletedAt = payload.deletedAt ?? 'active';

    return `Conflict: server version ${existing.serverVersion} updated at ${existing.updatedAt.toISOString()} (deletedAt: ${remoteDeletedAt}) won over local version ${payload.serverVersion} updated at ${payload.updatedAt} (deletedAt: ${localDeletedAt}).`;
  }

  private normalizeString(value: string | null | undefined) {
    return value?.trim() ?? '';
  }

  private normalizeGenres(genres: string[] | null | undefined) {
    if (!genres) {
      return [];
    }

    return Array.from(
      new Set(genres.map((genre) => genre.trim()).filter(Boolean)),
    );
  }

  private toResponse(work: Work): WorkResponseDto {
    return {
      ...work,
      syncStatus: toWorkSyncStatusValue(work.syncStatus),
    };
  }
}
