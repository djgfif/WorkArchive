import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { CatalogService } from '../catalog/catalog.service';
import { UserRecordsService } from '../user-records/user-records.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateWorkDto } from './dto/create-work.dto';
import type { UpdateWorkDto } from './dto/update-work.dto';
import {
  buildWorkCreateCompatibilityPlan,
  buildWorkUpdateCompatibilityPlan,
  withSyncedRecordMutationVersion,
} from './work-compatibility.mapper';
import { toFlatWorkResponse } from './work-aggregate';
import { groupWorksBy, type WorkGroupField } from './work-grouping';

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

    return groupWorksBy(works, by);
  }

  async create(userId: string, createWorkDto: CreateWorkDto) {
    try {
      // 릴리스 1단계에서는 catalog와 user record를 1:1로 생성해 기존 flat 계약을 유지합니다.
      const workId = crypto.randomUUID();
      const compatibilityPlan = buildWorkCreateCompatibilityPlan(
        userId,
        workId,
        createWorkDto,
      );
      const work = await this.prisma.$transaction(async (tx) => {
        await this.catalogService.create(
          {
            id: workId,
            ...compatibilityPlan.catalogCreateData,
          },
          tx,
        );

        return this.userRecordsService.create(
          {
            id: workId,
            ...compatibilityPlan.userRecordCreateData,
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
      const compatibilityPlan = buildWorkUpdateCompatibilityPlan(
        existingWork,
        updateWorkDto,
      );

      if (
        !compatibilityPlan.hasCatalogChanges &&
        !compatibilityPlan.hasUserRecordChanges
      ) {
        return toFlatWorkResponse(existingWork);
      }

      const work = await this.prisma.$transaction(async (tx) => {
        if (compatibilityPlan.hasCatalogChanges) {
          // 현재는 shared catalog가 아니라 user record와 결합된 1:1 catalog 항목을 함께 갱신합니다.
          await this.catalogService.update(
            existingWork.catalogWorkId,
            compatibilityPlan.catalogUpdateData,
            tx,
          );
        }

        return this.userRecordsService.updateActiveForUser(
          userId,
          id,
          withSyncedRecordMutationVersion(
            compatibilityPlan.userRecordUpdateData,
          ),
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
        withSyncedRecordMutationVersion({
          deletedAt: new Date(),
        }),
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

}
