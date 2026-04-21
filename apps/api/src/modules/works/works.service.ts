import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { CatalogService } from '../catalog/catalog.service';
import { UserRecordsService } from '../user-records/user-records.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateWorkDto } from './dto/create-work.dto';
import type { UpdateWorkDto } from './dto/update-work.dto';
import {
  hasChanges,
  normalizeGenres,
  normalizeString,
  toFlatWorkResponse,
} from './work-aggregate';

const DEFAULT_SYNC_STATUS = WorkSyncStatus.synced;

@Injectable()
export class WorksService {
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

  async create(userId: string, createWorkDto: CreateWorkDto) {
    // 릴리스 1단계에서는 catalog와 user record를 1:1로 생성해 기존 flat 계약을 유지합니다.
    const workId = crypto.randomUUID();
    const work = await this.prisma.$transaction(async (tx) => {
      await this.catalogService.create(
        {
          id: workId,
          ...this.buildCatalogCreateData(createWorkDto),
        },
        tx,
      );

      return this.userRecordsService.create(
        {
          id: workId,
          ...this.buildUserRecordCreateData(userId, workId, createWorkDto),
        },
        tx,
      );
    });

    return toFlatWorkResponse(work);
  }

  async update(userId: string, id: string, updateWorkDto: UpdateWorkDto) {
    const existingWork = await this.getActiveWorkOrThrow(userId, id);
    const catalogUpdateData = this.buildCatalogUpdateData(updateWorkDto);
    const recordUpdateData = this.buildUserRecordUpdateData(updateWorkDto);

    if (!hasChanges(catalogUpdateData) && !hasChanges(recordUpdateData)) {
      return toFlatWorkResponse(existingWork);
    }

    const work = await this.prisma.$transaction(async (tx) => {
      if (hasChanges(catalogUpdateData)) {
        // 현재는 shared catalog가 아니라 user record와 결합된 1:1 catalog 항목을 함께 갱신합니다.
        await this.catalogService.update(existingWork.catalogWorkId, catalogUpdateData, tx);
      }

      return this.userRecordsService.update(
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
  }

  async remove(userId: string, id: string) {
    await this.getActiveWorkOrThrow(userId, id);

    await this.userRecordsService.update(id, {
      deletedAt: new Date(),
      syncStatus: DEFAULT_SYNC_STATUS,
      serverVersion: {
        increment: 1,
      },
    });
  }

  private async getActiveWorkOrThrow(userId: string, id: string) {
    const work = await this.userRecordsService.findActiveByUserAndId(userId, id);

    if (!work) {
      throw new NotFoundException(`Work with id "${id}" was not found.`);
    }

    return work;
  }

  private buildCatalogCreateData(
    createWorkDto: CreateWorkDto,
  ): Prisma.CatalogWorkUncheckedCreateInput {
    const title = createWorkDto.title.trim();

    if (!title) {
      throw new BadRequestException('title must not be empty');
    }

    return {
      type: createWorkDto.type ?? WorkType.novel,
      title,
      author: normalizeString(createWorkDto.author),
      genres: normalizeGenres(createWorkDto.genres),
      description: normalizeString(createWorkDto.description),
      thumbnailUrl: normalizeString(createWorkDto.thumbnailUrl),
    };
  }

  private buildUserRecordCreateData(
    userId: string,
    catalogWorkId: string,
    createWorkDto: CreateWorkDto,
  ): Prisma.UserWorkRecordUncheckedCreateInput {
    return {
      userId,
      // split-only 중간 단계: catalogWorkId는 user record id와 동일하게 유지합니다.
      catalogWorkId,
      status: createWorkDto.status ?? WorkStatus.planned,
      rating: createWorkDto.rating ?? null,
      shortReview: normalizeString(createWorkDto.shortReview),
      review: normalizeString(createWorkDto.review),
      tier: createWorkDto.tier ?? null,
      favorite: createWorkDto.favorite ?? false,
      syncStatus: DEFAULT_SYNC_STATUS,
      serverVersion: 1,
    };
  }

  private buildCatalogUpdateData(
    updateWorkDto: UpdateWorkDto,
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
      data.genres = normalizeGenres(updateWorkDto.genres);
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
  ): Prisma.UserWorkRecordUpdateInput {
    const data: Prisma.UserWorkRecordUpdateInput = {};

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

    if (updateWorkDto.tier !== undefined) {
      data.tier = updateWorkDto.tier;
    }

    if (updateWorkDto.favorite !== undefined) {
      data.favorite = updateWorkDto.favorite;
    }

    return data;
  }
}
