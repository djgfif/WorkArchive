import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { CatalogService } from '../catalog/catalog.service';
import { UserRecordsService } from '../user-records/user-records.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateWorkDto } from './dto/create-work.dto';
import type { WORK_GROUP_FIELDS } from './dto/grouped-works-query.dto';
import type { UpdateWorkDto } from './dto/update-work.dto';
import {
  hasChanges,
  normalizeGenres,
  normalizeGenresAndPersonalTags,
  normalizePersonalTags,
  normalizeString,
  toFlatWorkResponse,
} from './work-aggregate';

const DEFAULT_SYNC_STATUS = WorkSyncStatus.synced;
type WorkGroupField = (typeof WORK_GROUP_FIELDS)[number];

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

@Injectable()
export class WorksService {
  private readonly logger = new Logger(WorksService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogService) private readonly catalogService: CatalogService,
    @Inject(UserRecordsService)
    private readonly userRecordsService: UserRecordsService,
  ) {}

  async findAll(userId: string) {
    const works = await this.userRecordsService.findActiveByUser(userId);

    return works.map((work) => toFlatWorkResponse(work));
  }

  async findOne(userId: string, id: string) {
    const work = await this.getActiveWorkOrThrow(userId, id);

    return toFlatWorkResponse(work);
  }

  async findGrouped(userId: string, by: WorkGroupField) {
    const works = await this.userRecordsService.findGroupedSourceByUser(userId);
    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        works: ReturnType<typeof toFlatWorkResponse>[];
      }
    >();

    for (const work of works) {
      const group = this.getGroupKey(work, by);
      const existing = groups.get(group.key);

      if (existing) {
        existing.works.push(toFlatWorkResponse(work));
        continue;
      }

      groups.set(group.key, {
        ...group,
        works: [toFlatWorkResponse(work)],
      });
    }

    return [...groups.values()].map((group) => ({
      ...group,
      count: group.works.length,
    }));
  }

  async create(userId: string, createWorkDto: CreateWorkDto) {
    try {
      // 릴리스 1단계에서는 catalog와 user record를 1:1로 생성해 기존 flat 계약을 유지합니다.
      const workId = crypto.randomUUID();
      const normalizedTaxonomy = normalizeGenresAndPersonalTags(
        createWorkDto.genres,
        createWorkDto.personalTags,
      );
      const work = await this.prisma.$transaction(async (tx) => {
        await this.catalogService.create(
          {
            id: workId,
            ...this.buildCatalogCreateData(createWorkDto, normalizedTaxonomy.genres),
          },
          tx,
        );

        return this.userRecordsService.create(
          {
            id: workId,
            ...this.buildUserRecordCreateData(
              userId,
              workId,
              createWorkDto,
              normalizedTaxonomy.personalTags,
            ),
          },
          tx,
        );
      });

      return toFlatWorkResponse(work);
    } catch (error) {
      this.logMutationFailure('create', userId, null, error);
      throw error;
    }
  }

  async update(userId: string, id: string, updateWorkDto: UpdateWorkDto) {
    try {
      const existingWork = await this.getActiveWorkOrThrow(userId, id);
      const normalizedTaxonomy =
        updateWorkDto.genres !== undefined || updateWorkDto.personalTags !== undefined
          ? normalizeGenresAndPersonalTags(
              updateWorkDto.genres ?? existingWork.catalogWork.genres,
              updateWorkDto.personalTags ?? existingWork.personalTags,
            )
          : null;
      const catalogUpdateData = this.buildCatalogUpdateData(
        updateWorkDto,
        normalizedTaxonomy?.genres,
      );
      const recordUpdateData = this.buildUserRecordUpdateData(
        updateWorkDto,
        normalizedTaxonomy?.personalTags,
      );

      if (!hasChanges(catalogUpdateData) && !hasChanges(recordUpdateData)) {
        return toFlatWorkResponse(existingWork);
      }

      const work = await this.prisma.$transaction(async (tx) => {
        if (hasChanges(catalogUpdateData)) {
          // 현재는 shared catalog가 아니라 user record와 결합된 1:1 catalog 항목을 함께 갱신합니다.
          await this.catalogService.update(
            existingWork.catalogWorkId,
            catalogUpdateData,
            tx,
          );
        }

        return this.userRecordsService.updateActiveForUser(
          userId,
          id,
          {
            ...recordUpdateData,
            syncStatus: DEFAULT_SYNC_STATUS,
            serverVersion: {
              increment: 1,
            },
          },
          tx,
        );
      });

      return toFlatWorkResponse(work);
    } catch (error) {
      this.logMutationFailure('update', userId, id, error);
      throw error;
    }
  }

  async remove(userId: string, id: string) {
    try {
      await this.userRecordsService.updateActiveForUser(
        userId,
        id,
        {
          deletedAt: new Date(),
          syncStatus: DEFAULT_SYNC_STATUS,
          serverVersion: {
            increment: 1,
          },
        },
        undefined,
        {
          includeDeletedResult: true,
        },
      );
    } catch (error) {
      this.logMutationFailure('delete', userId, id, error);
      throw error;
    }
  }

  private async getActiveWorkOrThrow(userId: string, id: string) {
    const work = await this.userRecordsService.findActiveByUserAndId(
      userId,
      id,
    );

    if (!work) {
      throw new NotFoundException(`Work with id "${id}" was not found.`);
    }

    return work;
  }

  private buildCatalogCreateData(
    createWorkDto: CreateWorkDto,
    normalizedGenres: string[],
  ): Prisma.CatalogWorkUncheckedCreateInput {
    const title = createWorkDto.title.trim();

    if (!title) {
      throw new BadRequestException('title must not be empty');
    }

    return {
      type: createWorkDto.type ?? WorkType.novel,
      title,
      author: normalizeString(createWorkDto.author),
      genres: normalizedGenres,
      description: normalizeString(createWorkDto.description),
      thumbnailUrl: normalizeString(createWorkDto.thumbnailUrl),
    };
  }

  private buildUserRecordCreateData(
    userId: string,
    catalogWorkId: string,
    createWorkDto: CreateWorkDto,
    normalizedPersonalTags: string[],
  ): Prisma.UserWorkRecordUncheckedCreateInput {
    return {
      userId,
      // split-only 중간 단계: catalogWorkId는 user record id와 동일하게 유지합니다.
      catalogWorkId,
      catalogTitleId: catalogWorkId,
      status: createWorkDto.status ?? WorkStatus.planned,
      rating: createWorkDto.rating ?? null,
      shortReview: normalizeString(createWorkDto.shortReview),
      review: normalizeString(createWorkDto.review),
      personalTags: normalizedPersonalTags,
      favorite: createWorkDto.favorite ?? false,
      startedAt: parseOptionalDtoDate(createWorkDto.startedAt, 'startedAt'),
      completedAt: parseOptionalDtoDate(
        createWorkDto.completedAt,
        'completedAt',
      ),
      droppedAt: parseOptionalDtoDate(createWorkDto.droppedAt, 'droppedAt'),
      lastConsumedAt: parseOptionalDtoDate(
        createWorkDto.lastConsumedAt,
        'lastConsumedAt',
      ),
      syncStatus: DEFAULT_SYNC_STATUS,
      serverVersion: 1,
    };
  }

  private buildCatalogUpdateData(
    updateWorkDto: UpdateWorkDto,
    normalizedGenres?: string[],
  ): Prisma.CatalogWorkUpdateInput {
    const data: Prisma.CatalogWorkUpdateInput = {};

    if (updateWorkDto.type !== undefined) {
      data.type = updateWorkDto.type;
    }

    if (updateWorkDto.title !== undefined) {
      const title = updateWorkDto.title.trim();

      if (!title) {
        throw new BadRequestException('title must not be empty');
      }

      data.title = title;
    }

    if (updateWorkDto.author !== undefined) {
      data.author = normalizeString(updateWorkDto.author);
    }

    if (updateWorkDto.genres !== undefined) {
      data.genres = normalizedGenres ?? normalizeGenres(updateWorkDto.genres);
    }

    if (updateWorkDto.description !== undefined) {
      data.description = normalizeString(updateWorkDto.description);
    }

    if (updateWorkDto.thumbnailUrl !== undefined) {
      data.thumbnailUrl = normalizeString(updateWorkDto.thumbnailUrl);
    }

    return data;
  }

  private buildUserRecordUpdateData(
    updateWorkDto: UpdateWorkDto,
    normalizedPersonalTags?: string[],
  ): Prisma.UserWorkRecordUpdateManyMutationInput {
    const data: Prisma.UserWorkRecordUpdateManyMutationInput = {};

    if (updateWorkDto.status !== undefined) {
      data.status = updateWorkDto.status;
    }

    if (updateWorkDto.rating !== undefined) {
      data.rating = updateWorkDto.rating;
    }

    if (updateWorkDto.shortReview !== undefined) {
      data.shortReview = normalizeString(updateWorkDto.shortReview);
    }

    if (updateWorkDto.review !== undefined) {
      data.review = normalizeString(updateWorkDto.review);
    }

    if (
      updateWorkDto.personalTags !== undefined ||
      normalizedPersonalTags !== undefined
    ) {
      data.personalTags =
        normalizedPersonalTags ?? normalizePersonalTags(updateWorkDto.personalTags);
    }

    if (updateWorkDto.favorite !== undefined) {
      data.favorite = updateWorkDto.favorite;
    }

    if (updateWorkDto.startedAt !== undefined) {
      data.startedAt = parseOptionalDtoDate(
        updateWorkDto.startedAt,
        'startedAt',
      );
    }

    if (updateWorkDto.completedAt !== undefined) {
      data.completedAt = parseOptionalDtoDate(
        updateWorkDto.completedAt,
        'completedAt',
      );
    }

    if (updateWorkDto.droppedAt !== undefined) {
      data.droppedAt = parseOptionalDtoDate(
        updateWorkDto.droppedAt,
        'droppedAt',
      );
    }

    if (updateWorkDto.lastConsumedAt !== undefined) {
      data.lastConsumedAt = parseOptionalDtoDate(
        updateWorkDto.lastConsumedAt,
        'lastConsumedAt',
      );
    }

    return data;
  }

  private logMutationFailure(
    operation: 'create' | 'update' | 'delete',
    userId: string,
    workId: string | null,
    error: unknown,
  ) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    this.logger.warn(
      `Work ${operation} failed userId=${userId}${workId ? ` workId=${workId}` : ''} reason=${errorName}: ${errorMessage}`,
    );
  }

  private getGroupKey(
    work: Awaited<
      ReturnType<UserRecordsService['findGroupedSourceByUser']>
    >[number],
    by: WorkGroupField,
  ) {
    if (by === 'status') {
      return {
        key: work.status,
        label: work.status,
      };
    }

    if (by === 'medium') {
      const mediumType = work.catalogTitle?.mediumType ?? work.catalogWork.type;

      return {
        key: mediumType,
        label: mediumType,
      };
    }

    if (by === 'franchise') {
      const franchise = work.catalogTitle?.franchise;

      return {
        key: franchise?.id ?? 'unfranchised',
        label: franchise?.displayName ?? '프랜차이즈 미지정',
      };
    }

    const contributor = work.catalogTitle?.contributors[0]?.contributor;

    return {
      key: contributor?.id ?? 'unknown-contributor',
      label:
        contributor?.displayName ??
        (work.catalogWork.author || '기여자 미지정'),
    };
  }
}
