import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogWorkSource,
  WorkType,
  type Prisma,
} from '@prisma/client';

import { CatalogService } from '../catalog/catalog.service';
import {
  canCreateReleaseRecord,
} from '../recording/recording-policy';
import type { GroupedWorksQueryDto } from '../works/dto/grouped-works-query.dto';
import {
  normalizeGenresAndPersonalTags,
  normalizeString,
} from '../works/work-aggregate';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateUserRecordDto,
  CreateUserRecordFromImportDto,
  UpdateProgressDto,
  UpdateUserRecordDto,
} from './dto/user-record.dto';
import type { UpsertUserReleaseRecordDto } from './dto/user-release-record.dto';
import {
  toUserReleaseRecordResponse,
  UserReleaseRecordsService,
} from './user-release-records.service';
import {
  buildCatalogTitleInputFromImport,
  buildCreateUserRecordData,
  buildSyncedProgressUpdateData,
  buildSyncedUserRecordUpdateData,
  buildSyncedUserReleaseRecordBaseData,
  buildUserRecordInputFromImport,
  buildUserRecordRecordingPolicy,
  getUserRecordGroupKey,
  getUserRecordMedium,
} from './user-records.helpers';
import { toUserWorkRecordView } from './user-records.presenter';
import { WORK_AGGREGATE_INCLUDE } from './user-records.types';

export type { WorkAggregate } from './user-records.types';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class UserRecordsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogService) private readonly catalogService: CatalogService,
    @Inject(UserReleaseRecordsService)
    private readonly releaseRecordsService: UserReleaseRecordsService,
  ) {}

  findActiveByUser(userId: string) {
    return this.prisma.userWorkRecord.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: WORK_AGGREGATE_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
  }

  findByUserSince(userId: string, since?: Date | null) {
    return this.prisma.userWorkRecord.findMany({
      where: {
        userId,
        ...(since
          ? {
              updatedAt: {
                gt: since,
              },
            }
          : {}),
      },
      include: WORK_AGGREGATE_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });
  }

  findActiveByUserAndId(userId: string, id: string) {
    return this.prisma.userWorkRecord.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      include: WORK_AGGREGATE_INCLUDE,
    });
  }

  findGroupedSourceByUser(userId: string) {
    return this.prisma.userWorkRecord.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: WORK_AGGREGATE_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
  }

  findActiveByUserAndCatalogTitle(userId: string, catalogTitleId: string) {
    return this.prisma.userWorkRecord.findFirst({
      where: {
        catalogTitleId,
        deletedAt: null,
        userId,
      },
      include: WORK_AGGREGATE_INCLUDE,
    });
  }

  findById(id: string, client: PrismaClientLike = this.prisma) {
    return client.userWorkRecord.findUnique({
      where: {
        id,
      },
      include: WORK_AGGREGATE_INCLUDE,
    });
  }

  /**
   * Applies a scalar update only when the record still has the
   * {@link expectedServerVersion} we previously read, scoped to its owner.
   * Returns the refreshed aggregate on success, or `null` when a concurrent
   * writer advanced the version (i.e. the optimistic-concurrency guard failed).
   */
  async updateWithVersionGuard(
    id: string,
    userId: string,
    expectedServerVersion: number,
    data: Prisma.UserWorkRecordUpdateInput,
    client: PrismaClientLike = this.prisma,
  ) {
    const result = await client.userWorkRecord.updateMany({
      where: {
        id,
        userId,
        serverVersion: expectedServerVersion,
      },
      // The sync work-update builder only emits scalar fields, so this update
      // payload is safe to apply through updateMany().
      data: data as Prisma.UserWorkRecordUpdateManyMutationInput,
    });

    if (result.count === 0) {
      return null;
    }

    return client.userWorkRecord.findFirst({
      where: {
        id,
        userId,
      },
      include: WORK_AGGREGATE_INCLUDE,
    });
  }

  create(
    data: Prisma.UserWorkRecordUncheckedCreateInput,
    client: PrismaClientLike = this.prisma,
  ) {
    return client.userWorkRecord.create({
      data,
      include: WORK_AGGREGATE_INCLUDE,
    });
  }

  update(
    id: string,
    data: Prisma.UserWorkRecordUpdateInput,
    client: PrismaClientLike = this.prisma,
  ) {
    return client.userWorkRecord.update({
      where: {
        id,
      },
      data,
      include: WORK_AGGREGATE_INCLUDE,
    });
  }

  async updateActiveForUser(
    userId: string,
    id: string,
    data: Prisma.UserWorkRecordUpdateManyMutationInput,
    client: PrismaClientLike = this.prisma,
    options?: {
      includeDeletedResult?: boolean;
    },
  ) {
    const result = await client.userWorkRecord.updateMany({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      data,
    });

    if (result.count === 0) {
      throw new NotFoundException(`User record with id "${id}" was not found.`);
    }

    const where: Prisma.UserWorkRecordWhereInput = {
      id,
      userId,
    };

    if (!options?.includeDeletedResult) {
      where.deletedAt = null;
    }

    const record = await client.userWorkRecord.findFirst({
      where,
      include: WORK_AGGREGATE_INCLUDE,
    });

    if (!record) {
      throw new NotFoundException(`User record with id "${id}" was not found.`);
    }

    return record;
  }

  async listViews(userId: string) {
    const records = await this.findActiveByUser(userId);

    return records.map(toUserWorkRecordView);
  }

  async listGroupedViews(userId: string, by: GroupedWorksQueryDto['by']) {
    const records = await this.findGroupedSourceByUser(userId);
    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        records: ReturnType<typeof toUserWorkRecordView>[];
      }
    >();

    for (const record of records) {
      const group = getUserRecordGroupKey(record, by);
      const existing = groups.get(group.key);

      if (existing) {
        existing.records.push(toUserWorkRecordView(record));
        continue;
      }

      groups.set(group.key, {
        ...group,
        records: [toUserWorkRecordView(record)],
      });
    }

    return [...groups.values()].map((group) => ({
      ...group,
      count: group.records.length,
    }));
  }

  async getViewOrThrow(userId: string, id: string) {
    return toUserWorkRecordView(await this.getActiveRecordOrThrow(userId, id));
  }

  async getReleasesView(userId: string, id: string) {
    const record = await this.getActiveRecordOrThrow(userId, id);
    const mediumType = getUserRecordMedium(record);
    const policy = buildUserRecordRecordingPolicy(mediumType);

    if (!record.catalogTitleId || !policy.releaseRecordsSupported) {
      return {
        policy,
        releases: [],
      };
    }

    const [releases, releaseRecords] = await Promise.all([
      this.prisma.catalogRelease.findMany({
        where: {
          catalogTitleId: record.catalogTitleId,
        },
        orderBy: [{ sequence: 'asc' }, { releaseDate: 'asc' }, { id: 'asc' }],
      }),
      this.releaseRecordsService.findByUserWorkRecord(record.id),
    ]);
    const releaseRecordsByReleaseId = new Map(
      releaseRecords.map((releaseRecord) => [
        releaseRecord.catalogReleaseId,
        releaseRecord,
      ]),
    );

    return {
      policy,
      releases: releases.map((release) => ({
        id: release.id,
        releaseType: release.releaseType,
        displayLabel: release.displayLabel,
        title: release.title,
        sequence: release.sequence,
        isbn: release.isbn,
        releaseDate: release.releaseDate?.toISOString() ?? null,
        summary: release.summary,
        thumbnailUrl: release.thumbnailUrl,
        userReleaseRecord: releaseRecordsByReleaseId.has(release.id)
          ? toUserReleaseRecordResponse(
              releaseRecordsByReleaseId.get(release.id)!,
            )
          : null,
      })),
    };
  }

  async updateProgressForUser(
    userId: string,
    id: string,
    input: UpdateProgressDto,
  ) {
    const existing = await this.getActiveRecordOrThrow(userId, id);
    const mediumType = getUserRecordMedium(existing);
    const updated = await this.updateActiveForUser(
      userId,
      id,
      buildSyncedProgressUpdateData({
        existing,
        input,
        mediumType,
      }),
    );

    return toUserWorkRecordView(updated);
  }

  async upsertReleaseRecordForUser(
    userId: string,
    id: string,
    catalogReleaseId: string,
    input: UpsertUserReleaseRecordDto,
  ) {
    const record = await this.getActiveRecordOrThrow(userId, id);
    const mediumType = getUserRecordMedium(record);

    if (!canCreateReleaseRecord(mediumType)) {
      throw new BadRequestException(
        `Release-level records are not supported for medium type "${mediumType}".`,
      );
    }

    if (!record.catalogTitleId) {
      throw new BadRequestException(
        'Release-level records require a catalog title bridge.',
      );
    }

    const release = await this.prisma.catalogRelease.findFirst({
      where: {
        id: catalogReleaseId,
        catalogTitleId: record.catalogTitleId,
      },
    });

    if (!release) {
      throw new NotFoundException(
        `Catalog release with id "${catalogReleaseId}" was not found.`,
      );
    }

    const existing = await this.prisma.userReleaseRecord.findUnique({
      where: {
        userWorkRecordId_catalogReleaseId: {
          userWorkRecordId: id,
          catalogReleaseId,
        },
      },
    });
    const baseData = buildSyncedUserReleaseRecordBaseData(input);
    const releaseRecord = existing
      ? await this.releaseRecordsService.update(existing.id, {
          ...baseData,
          deletedAt: null,
          serverVersion: {
            increment: 1,
          },
        })
      : await this.prisma.userReleaseRecord.create({
          data: {
            ...baseData,
            catalogReleaseId,
            userWorkRecordId: id,
          },
          include: {
            catalogRelease: true,
            userWorkRecord: {
              select: {
                id: true,
                userId: true,
                catalogTitleId: true,
                catalogWork: {
                  select: {
                    type: true,
                  },
                },
                catalogTitle: {
                  select: {
                    mediumType: true,
                  },
                },
              },
            },
          },
        });

    return toUserReleaseRecordResponse(releaseRecord);
  }

  async updateViewForUser(
    userId: string,
    id: string,
    input: UpdateUserRecordDto,
  ) {
    await this.getActiveRecordOrThrow(userId, id);
    const updated = await this.updateActiveForUser(
      userId,
      id,
      buildSyncedUserRecordUpdateData(input),
    );

    return toUserWorkRecordView(updated);
  }

  async createViewForUser(userId: string, input: CreateUserRecordDto) {
    return toUserWorkRecordView(await this.createUserRecord(userId, input));
  }

  async createViewFromImportForUser(
    userId: string,
    input: CreateUserRecordFromImportDto,
  ) {
    const title =
      await this.catalogService.createTitleFromImportCandidate(
        buildCatalogTitleInputFromImport(input),
      );
    const recordInput = buildUserRecordInputFromImport(input, title.id);

    return this.createViewForUser(userId, recordInput);
  }

  private async getActiveRecordOrThrow(userId: string, id: string) {
    const record = await this.findActiveByUserAndId(userId, id);

    if (!record) {
      throw new NotFoundException(`User record with id "${id}" was not found.`);
    }

    return record;
  }

  private async createUserRecord(userId: string, input: CreateUserRecordDto) {
    if (input.catalogTitleId) {
      const duplicate = await this.findActiveByUserAndCatalogTitle(
        userId,
        input.catalogTitleId,
      );

      if (duplicate) {
        throw new BadRequestException(
          'A record for this catalog title already exists.',
        );
      }
    }

    const recordId = crypto.randomUUID();
    const taxonomy = normalizeGenresAndPersonalTags(
      input.genres,
      input.personalTags,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const catalogWorkId = input.catalogTitleId
          ? await this.createCompatibilityCatalogWorkFromTitle(
              recordId,
              input,
              taxonomy.genres,
              tx,
            )
          : await this.createDraftCatalogWork(
              recordId,
              input,
              taxonomy.genres,
              tx,
            );

        return this.create(
          buildCreateUserRecordData({
            catalogWorkId,
            input,
            personalTags: taxonomy.personalTags,
            recordId,
            userId,
          }),
          tx,
        );
      });
    } catch (error) {
      // The pre-check above is not atomic; the active-record partial unique
      // index is the real guard, so a concurrent create lands here as P2002.
      if (this.isUniqueConstraintError(error)) {
        throw new BadRequestException(
          'A record for this catalog title already exists.',
        );
      }

      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private async createDraftCatalogWork(
    recordId: string,
    input: CreateUserRecordDto,
    genres: string[],
    tx: Prisma.TransactionClient,
  ) {
    const title = input.title?.trim();

    if (!title) {
      throw new BadRequestException(
        'title is required when catalogTitleId is absent.',
      );
    }

    await this.catalogService.create(
      {
        author: normalizeString(input.author),
        description: normalizeString(input.description),
        genres,
        id: recordId,
        source: CatalogWorkSource.legacy_flat,
        thumbnailUrl: normalizeString(input.thumbnailUrl),
        title,
        type: input.type ?? WorkType.other,
      },
      tx,
    );

    return recordId;
  }

  private async createCompatibilityCatalogWorkFromTitle(
    recordId: string,
    input: CreateUserRecordDto,
    genres: string[],
    tx: Prisma.TransactionClient,
  ) {
    const title = await this.catalogService.findTitleOrThrow(
      input.catalogTitleId!,
    );
    const author =
      input.author?.trim() ||
      title.contributors
        .map((entry) => entry.contributor.displayName)
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');

    await tx.catalogWork.create({
      data: {
        author,
        description: input.description?.trim() || title.summary,
        genres,
        id: recordId,
        source: CatalogWorkSource.catalog_title_snapshot,
        thumbnailUrl: input.thumbnailUrl?.trim() || title.thumbnailUrl,
        title: input.title?.trim() || title.displayTitle,
        type: input.type ?? title.mediumType,
      },
    });

    return recordId;
  }

}
