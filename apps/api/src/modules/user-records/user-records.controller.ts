import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WorkStatus, WorkSyncStatus, WorkType, type Prisma } from '@prisma/client';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CatalogService } from '../catalog/catalog.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  canCreateReleaseRecord,
  canUseProgressUnit,
  getDefaultProgressUnit,
  RECORDING_UNIT,
} from '../recording/recording-policy';
import { GroupedWorksQueryDto } from '../works/dto/grouped-works-query.dto';
import {
  normalizeGenres,
  normalizeString,
  toUserWorkRecordView,
} from '../works/work-aggregate';
import {
  CreateUserRecordDto,
  CreateUserRecordFromImportDto,
  UpdateUserRecordDto,
  UpdateProgressDto,
} from './dto/user-record.dto';
import { UpsertUserReleaseRecordDto } from './dto/user-release-record.dto';
import {
  toUserReleaseRecordResponse,
  UserReleaseRecordsService,
} from './user-release-records.service';
import { UserRecordsService, type WorkAggregate } from './user-records.service';

@ApiTags('user-records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user-records')
export class UserRecordsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogService) private readonly catalogService: CatalogService,
    @Inject(UserRecordsService)
    private readonly userRecordsService: UserRecordsService,
    @Inject(UserReleaseRecordsService)
    private readonly releaseRecordsService: UserReleaseRecordsService,
  ) {}

  @Get()
  @ApiOkResponse({
    description: 'List active user records with normalized catalog metadata.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const records = await this.userRecordsService.findActiveByUser(user.userId);

    return records.map(toUserWorkRecordView);
  }

  @Get('grouped')
  @ApiOkResponse({
    description: 'List active user records grouped by catalog metadata.',
  })
  async findGrouped(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GroupedWorksQueryDto,
  ) {
    const records = await this.userRecordsService.findGroupedSourceByUser(
      user.userId,
    );
    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        records: ReturnType<typeof toUserWorkRecordView>[];
      }
    >();

    for (const record of records) {
      const group = this.getGroupKey(record, query.by);
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

  @Get(':id/releases')
  @ApiOkResponse({
    description:
      'Return catalog releases for a title and optional volume-level user records.',
  })
  async findReleases(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const record = await this.userRecordsService.findActiveByUserAndId(
      user.userId,
      id,
    );

    if (!record) {
      throw new NotFoundException(`User record with id "${id}" was not found.`);
    }

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
        releaseDate: release.releaseDate,
        summary: release.summary,
        thumbnailUrl: release.thumbnailUrl,
        userReleaseRecord:
          releaseRecordsByReleaseId.has(release.id)
            ? toUserReleaseRecordResponse(
                releaseRecordsByReleaseId.get(release.id)!,
              )
            : null,
      })),
    };
  }

  @Put(':id/progress')
  @ApiOkResponse({
    description: 'Update title-level progress fields only.',
  })
  async updateProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateProgressDto,
  ) {
    const existing = await this.userRecordsService.findActiveByUserAndId(
      user.userId,
      id,
    );

    if (!existing) {
      throw new NotFoundException(`User record with id "${id}" was not found.`);
    }

    const mediumType = this.getRecordMedium(existing);
    const progressUnit =
      input.progressUnit ?? getDefaultProgressUnit(mediumType);

    if (progressUnit === null || !canUseProgressUnit(mediumType, progressUnit)) {
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
      throw new BadRequestException('progressCurrent cannot exceed progressTotal.');
    }

    const updated = await this.userRecordsService.update(id, {
      lastConsumedLabel:
        input.lastConsumedLabel === undefined
          ? existing.lastConsumedLabel
          : input.lastConsumedLabel?.trim() ?? null,
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

  @Post(':id/releases/:catalogReleaseId')
  @ApiCreatedResponse({
    description: 'Create or restore an optional volume-level user release record.',
  })
  async upsertReleaseRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('catalogReleaseId', new ParseUUIDPipe()) catalogReleaseId: string,
    @Body() input: UpsertUserReleaseRecordDto,
  ) {
    const record = await this.userRecordsService.findActiveByUserAndId(
      user.userId,
      id,
    );

    if (!record) {
      throw new NotFoundException(`User record with id "${id}" was not found.`);
    }

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

  @Get(':id')
  @ApiOkResponse({
    description: 'Return one active user record with normalized catalog metadata.',
  })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const record = await this.userRecordsService.findActiveByUserAndId(
      user.userId,
      id,
    );

    if (!record) {
      throw new NotFoundException(`User record with id "${id}" was not found.`);
    }

    return toUserWorkRecordView(record);
  }

  @Post()
  @ApiCreatedResponse({
    description: 'Create a user record against an existing or draft catalog title.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateUserRecordDto,
  ) {
    return this.createUserRecord(user.userId, input);
  }

  @Patch(':id')
  @ApiOkResponse({
    description: 'Update only personal record fields.',
  })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateUserRecordDto,
  ) {
    const existing = await this.userRecordsService.findActiveByUserAndId(
      user.userId,
      id,
    );

    if (!existing) {
      throw new NotFoundException(`User record with id "${id}" was not found.`);
    }

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

    const updated = await this.userRecordsService.update(id, {
      ...data,
      serverVersion: {
        increment: 1,
      },
      syncStatus: WorkSyncStatus.synced,
    });

    return toUserWorkRecordView(updated);
  }

  @Post('from-import')
  @ApiCreatedResponse({
    description: 'Resolve a normalized import candidate into a catalog title and user record.',
  })
  async createFromImport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateUserRecordFromImportDto,
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

    const title = await this.catalogService.createTitleFromImportCandidate(
      titleInput,
    );
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

    return this.createUserRecord(user.userId, recordInput);
  }

  private async createUserRecord(userId: string, input: CreateUserRecordDto) {
    if (input.catalogTitleId) {
      const duplicate =
        await this.userRecordsService.findActiveByUserAndCatalogTitle(
          userId,
          input.catalogTitleId,
        );

      if (duplicate) {
        throw new BadRequestException('A record for this catalog title already exists.');
      }
    }

    const recordId = crypto.randomUUID();

    const record = await this.prisma.$transaction(async (tx) => {
      const catalogWorkId = input.catalogTitleId
        ? await this.createCompatibilityCatalogWorkFromTitle(recordId, input, tx)
        : await this.createDraftCatalogWork(recordId, input, tx);

      return this.userRecordsService.create(
        {
          catalogTitleId: input.catalogTitleId ?? recordId,
          catalogWorkId,
          favorite: input.favorite ?? false,
          id: recordId,
          rating: input.rating ?? null,
          review: normalizeString(input.review),
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

    return toUserWorkRecordView(record);
  }

  private async createDraftCatalogWork(
    recordId: string,
    input: CreateUserRecordDto,
    tx: Prisma.TransactionClient,
  ) {
    const title = input.title?.trim();

    if (!title) {
      throw new BadRequestException('title is required when catalogTitleId is absent.');
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
    const title = await this.catalogService.findTitleOrThrow(input.catalogTitleId!);
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

  private getGroupKey(
    record: WorkAggregate,
    by: GroupedWorksQueryDto['by'],
  ) {
    if (by === 'status') {
      return {
        key: record.status,
        label: record.status,
      };
    }

    if (by === 'medium') {
      const mediumType = record.catalogTitle?.mediumType ?? record.catalogWork.type;

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
