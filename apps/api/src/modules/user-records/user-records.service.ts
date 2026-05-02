import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  WorkStatus,
  WorkSyncStatus,
  WorkType,
  type Prisma,
} from '@prisma/client';

import { CatalogService } from '../catalog/catalog.service';
import {
  canCreateReleaseRecord,
  canUseProgressUnit,
  getDefaultProgressUnit,
  RECORDING_UNIT,
} from '../recording/recording-policy';
import type { GroupedWorksQueryDto } from '../works/dto/grouped-works-query.dto';
import {
  normalizeGenres,
  normalizePersonalTags,
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
import { toUserWorkRecordView } from './user-records.presenter';
import {
  WORK_AGGREGATE_INCLUDE,
  type WorkAggregate,
} from './user-records.types';

export type { WorkAggregate } from './user-records.types';

function parseOptionalDtoDate(
  value: string | null | undefined,
  fieldName: string,
) {
  if (value === undefined || value === null) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(
      `${fieldName} must be a valid ISO 8601 date string.`,
    );
  }

  return parsed;
}

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

  findById(id: string) {
    return this.prisma.userWorkRecord.findUnique({
      where: {
        id,
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
      const group = this.getGroupKey(record, by);
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
    const mediumType = this.getRecordMedium(record);
    const policy = this.buildRecordingPolicy(mediumType);

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
    const mediumType = this.getRecordMedium(existing);
    const progressUnit =
      input.progressUnit ?? getDefaultProgressUnit(mediumType);

    if (
      progressUnit === null ||
      !canUseProgressUnit(mediumType, progressUnit)
    ) {
      throw new BadRequestException(
        `Progress unit is not supported for medium type "${mediumType}".`,
      );
    }

    if (
      input.progressCurrent !== undefined &&
      input.progressTotal !== undefined &&
      input.progressCurrent !== null &&
      input.progressTotal !== null &&
      input.progressCurrent > input.progressTotal
    ) {
      throw new BadRequestException(
        'progressCurrent cannot exceed progressTotal.',
      );
    }

    const updated = await this.update(id, {
      lastConsumedLabel:
        input.lastConsumedLabel === undefined
          ? existing.lastConsumedLabel
          : (input.lastConsumedLabel?.trim() ?? null),
      progressCurrent:
        input.progressCurrent === undefined
          ? existing.progressCurrent
          : input.progressCurrent,
      progressTotal:
        input.progressTotal === undefined
          ? existing.progressTotal
          : input.progressTotal,
      progressUnit,
      serverVersion: {
        increment: 1,
      },
      syncStatus: WorkSyncStatus.synced,
    });

    return toUserWorkRecordView(updated);
  }

  async upsertReleaseRecordForUser(
    userId: string,
    id: string,
    catalogReleaseId: string,
    input: UpsertUserReleaseRecordDto,
  ) {
    const record = await this.getActiveRecordOrThrow(userId, id);
    const mediumType = this.getRecordMedium(record);

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
    const baseData = {
      favorite: input.favorite ?? false,
      rating: input.rating ?? null,
      review: normalizeString(input.review),
      shortReview: normalizeString(input.shortReview),
      status: input.status ?? WorkStatus.planned,
      syncStatus: WorkSyncStatus.synced,
    };
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

    const data: Prisma.UserWorkRecordUpdateInput = {};

    if (input.status !== undefined) {
      data.status = input.status;
    }

    if (input.rating !== undefined) {
      data.rating = input.rating;
    }

    if (input.shortReview !== undefined) {
      data.shortReview = normalizeString(input.shortReview);
    }

    if (input.review !== undefined) {
      data.review = normalizeString(input.review);
    }

    if (input.tier !== undefined) {
      data.tier = input.tier;
    }

    if (input.favorite !== undefined) {
      data.favorite = input.favorite;
    }

    if (input.personalTags !== undefined) {
      data.personalTags = normalizePersonalTags(input.personalTags);
    }

    if (input.startedAt !== undefined) {
      data.startedAt = parseOptionalDtoDate(input.startedAt, 'startedAt');
    }

    if (input.completedAt !== undefined) {
      data.completedAt = parseOptionalDtoDate(input.completedAt, 'completedAt');
    }

    if (input.droppedAt !== undefined) {
      data.droppedAt = parseOptionalDtoDate(input.droppedAt, 'droppedAt');
    }

    if (input.lastConsumedAt !== undefined) {
      data.lastConsumedAt = parseOptionalDtoDate(
        input.lastConsumedAt,
        'lastConsumedAt',
      );
    }

    const updated = await this.update(id, {
      ...data,
      serverVersion: {
        increment: 1,
      },
      syncStatus: WorkSyncStatus.synced,
    });

    return toUserWorkRecordView(updated);
  }

  async createViewForUser(userId: string, input: CreateUserRecordDto) {
    return toUserWorkRecordView(await this.createUserRecord(userId, input));
  }

  async createViewFromImportForUser(
    userId: string,
    input: CreateUserRecordFromImportDto,
  ) {
    const titleInput: Parameters<
      CatalogService['createTitleFromImportCandidate']
    >[0] = {
      canonicalTitle: input.catalogTitle,
      displayTitle: input.catalogTitle,
      mediumType: input.mediumType,
    };

    if (input.contributors !== undefined) {
      titleInput.contributorNames = input.contributors.map(
        (contributor) => contributor.name,
      );
    }

    if (input.externalRefs !== undefined) {
      titleInput.externalRefs = input.externalRefs;
    }

    if (input.releaseCandidates !== undefined) {
      titleInput.releaseCandidates = input.releaseCandidates;
    }

    if (input.franchiseName !== undefined) {
      titleInput.franchiseName = input.franchiseName;
    }

    if (input.releaseYear !== undefined) {
      titleInput.releaseYear = input.releaseYear;
    }

    if (input.subType !== undefined) {
      titleInput.subType = input.subType;
    }

    if (input.description !== undefined) {
      titleInput.summary = input.description;
    }

    if (input.thumbnailUrl !== undefined) {
      titleInput.thumbnailUrl = input.thumbnailUrl;
    }

    const title =
      await this.catalogService.createTitleFromImportCandidate(titleInput);
    const recordInput: CreateUserRecordDto = {
      catalogTitleId: title.id,
      title: input.title || input.catalogTitle,
      type: input.mediumType,
    };
    const author =
      input.author ||
      input.contributors?.map((contributor) => contributor.name).join(', ');

    if (author !== undefined) {
      recordInput.author = author;
    }

    if (input.description !== undefined) {
      recordInput.description = input.description;
    }

    if (input.thumbnailUrl !== undefined) {
      recordInput.thumbnailUrl = input.thumbnailUrl;
    }

    if (input.genres !== undefined) {
      recordInput.genres = input.genres;
    }

    if (input.status !== undefined) {
      recordInput.status = input.status;
    }

    if (input.rating !== undefined) {
      recordInput.rating = input.rating;
    }

    if (input.shortReview !== undefined) {
      recordInput.shortReview = input.shortReview;
    }

    if (input.review !== undefined) {
      recordInput.review = input.review;
    }

    if (input.tier !== undefined) {
      recordInput.tier = input.tier;
    }

    if (input.favorite !== undefined) {
      recordInput.favorite = input.favorite;
    }

    if (input.personalTags !== undefined) {
      recordInput.personalTags = input.personalTags;
    }

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

    return this.prisma.$transaction(async (tx) => {
      const catalogWorkId = input.catalogTitleId
        ? await this.createCompatibilityCatalogWorkFromTitle(
            recordId,
            input,
            tx,
          )
        : await this.createDraftCatalogWork(recordId, input, tx);

      return this.create(
        {
          catalogTitleId: input.catalogTitleId ?? recordId,
          catalogWorkId,
          favorite: input.favorite ?? false,
          id: recordId,
          rating: input.rating ?? null,
          review: normalizeString(input.review),
          personalTags: normalizePersonalTags(input.personalTags),
          startedAt: parseOptionalDtoDate(input.startedAt, 'startedAt'),
          completedAt: parseOptionalDtoDate(input.completedAt, 'completedAt'),
          droppedAt: parseOptionalDtoDate(input.droppedAt, 'droppedAt'),
          lastConsumedAt: parseOptionalDtoDate(
            input.lastConsumedAt,
            'lastConsumedAt',
          ),
          serverVersion: 1,
          shortReview: normalizeString(input.shortReview),
          status: input.status ?? WorkStatus.planned,
          syncStatus: WorkSyncStatus.synced,
          tier: input.tier ?? null,
          userId,
        },
        tx,
      );
    });
  }

  private async createDraftCatalogWork(
    recordId: string,
    input: CreateUserRecordDto,
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
        genres: normalizeGenres(input.genres),
        id: recordId,
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
        genres: normalizeGenres(input.genres),
        id: recordId,
        thumbnailUrl: input.thumbnailUrl?.trim() || title.thumbnailUrl,
        title: input.title?.trim() || title.displayTitle,
        type: input.type ?? title.mediumType,
      },
    });

    return recordId;
  }

  private getRecordMedium(record: WorkAggregate) {
    return record.catalogTitle?.mediumType ?? record.catalogWork.type;
  }

  private buildRecordingPolicy(mediumType: WorkType) {
    return {
      recordingUnit: RECORDING_UNIT,
      mediumType,
      releaseRecordsSupported: canCreateReleaseRecord(mediumType),
      progressOnly:
        mediumType === WorkType.anime ||
        mediumType === WorkType.drama ||
        mediumType === WorkType.web_novel ||
        mediumType === WorkType.webtoon,
      defaultProgressUnit: getDefaultProgressUnit(mediumType),
      webPartSplitEnabled:
        mediumType !== WorkType.web_novel && mediumType !== WorkType.webtoon,
    };
  }

  private getGroupKey(record: WorkAggregate, by: GroupedWorksQueryDto['by']) {
    if (by === 'status') {
      return {
        key: record.status,
        label: record.status,
      };
    }

    if (by === 'medium') {
      const mediumType =
        record.catalogTitle?.mediumType ?? record.catalogWork.type;

      return {
        key: mediumType,
        label: mediumType,
      };
    }

    if (by === 'franchise') {
      const franchise = record.catalogTitle?.franchise;

      return {
        key: franchise?.id ?? 'unfranchised',
        label: franchise?.displayName ?? '프랜차이즈 미지정',
      };
    }

    const contributor = record.catalogTitle?.contributors[0]?.contributor;

    return {
      key: contributor?.id ?? 'unknown-contributor',
      label:
        contributor?.displayName ??
        (record.catalogWork.author || '기여자 미지정'),
    };
  }
}
