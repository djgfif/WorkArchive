import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import type { Prisma, Work } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  toWorkSyncStatusValue,
} from './works.constants';
import type { CreateWorkDto } from './dto/create-work.dto';
import type { UpdateWorkDto } from './dto/update-work.dto';
import type { WorkResponseDto } from './dto/work-response.dto';

const DEFAULT_SYNC_STATUS = WorkSyncStatus.synced;

@Injectable()
export class WorksService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const works = await this.prisma.work.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return works.map((work) => this.toResponse(work));
  }

  async findOne(userId: string, id: string) {
    const work = await this.getActiveWorkOrThrow(userId, id);

    return this.toResponse(work);
  }

  async create(userId: string, createWorkDto: CreateWorkDto) {
    const work = await this.prisma.work.create({
      data: this.buildCreateData(userId, createWorkDto),
    });

    return this.toResponse(work);
  }

  async update(userId: string, id: string, updateWorkDto: UpdateWorkDto) {
    const existingWork = await this.getActiveWorkOrThrow(userId, id);
    const updateData = this.buildUpdateData(updateWorkDto);

    if (Object.keys(updateData).length === 0) {
      return this.toResponse(existingWork);
    }

    const work = await this.prisma.work.update({
      where: { id },
      data: {
        ...updateData,
        syncStatus: DEFAULT_SYNC_STATUS,
        serverVersion: {
          increment: 1,
        },
      },
    });

    return this.toResponse(work);
  }

  async remove(userId: string, id: string) {
    await this.getActiveWorkOrThrow(userId, id);

    await this.prisma.work.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        syncStatus: DEFAULT_SYNC_STATUS,
        serverVersion: {
          increment: 1,
        },
      },
    });
  }

  private async getActiveWorkOrThrow(userId: string, id: string) {
    const work = await this.prisma.work.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });

    if (!work) {
      throw new NotFoundException(`Work with id "${id}" was not found.`);
    }

    return work;
  }

  private buildCreateData(
    userId: string,
    createWorkDto: CreateWorkDto,
  ): Prisma.WorkUncheckedCreateInput {
    const title = createWorkDto.title.trim();

    if (!title) {
      throw new BadRequestException('title must not be empty');
    }

    return {
      userId,
      type: createWorkDto.type ?? WorkType.novel,
      title,
      author: this.normalizeString(createWorkDto.author),
      genres: this.normalizeGenres(createWorkDto.genres),
      description: this.normalizeString(createWorkDto.description),
      thumbnailUrl: this.normalizeString(createWorkDto.thumbnailUrl),
      status: createWorkDto.status ?? WorkStatus.planned,
      rating: createWorkDto.rating ?? null,
      shortReview: this.normalizeString(createWorkDto.shortReview),
      review: this.normalizeString(createWorkDto.review),
      tier: createWorkDto.tier ?? null,
      favorite: createWorkDto.favorite ?? false,
      syncStatus: DEFAULT_SYNC_STATUS,
      serverVersion: 1,
    };
  }

  private buildUpdateData(updateWorkDto: UpdateWorkDto): Prisma.WorkUpdateInput {
    const data: Prisma.WorkUpdateInput = {};

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
      data.author = this.normalizeString(updateWorkDto.author);
    }

    if (updateWorkDto.genres !== undefined) {
      data.genres = this.normalizeGenres(updateWorkDto.genres);
    }

    if (updateWorkDto.description !== undefined) {
      data.description = this.normalizeString(updateWorkDto.description);
    }

    if (updateWorkDto.thumbnailUrl !== undefined) {
      data.thumbnailUrl = this.normalizeString(updateWorkDto.thumbnailUrl);
    }

    if (updateWorkDto.status !== undefined) {
      data.status = updateWorkDto.status;
    }

    if (updateWorkDto.rating !== undefined) {
      data.rating = updateWorkDto.rating;
    }

    if (updateWorkDto.shortReview !== undefined) {
      data.shortReview = this.normalizeString(updateWorkDto.shortReview);
    }

    if (updateWorkDto.review !== undefined) {
      data.review = this.normalizeString(updateWorkDto.review);
    }

    if (updateWorkDto.tier !== undefined) {
      data.tier = updateWorkDto.tier;
    }

    if (updateWorkDto.favorite !== undefined) {
      data.favorite = updateWorkDto.favorite;
    }

    return data;
  }

  private normalizeString(value?: string) {
    return value?.trim() ?? '';
  }

  private normalizeGenres(genres?: string[]) {
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
