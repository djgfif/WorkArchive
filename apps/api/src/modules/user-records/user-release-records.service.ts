import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WorkSyncStatus, type Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { toWorkSyncStatusValue } from '../works/works.constants';
import type { UpsertUserReleaseRecordDto } from './dto/user-release-record.dto';

const USER_RELEASE_RECORD_INCLUDE = {
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
} satisfies Prisma.UserReleaseRecordInclude;

export type UserReleaseRecordAggregate = Prisma.UserReleaseRecordGetPayload<{
  include: typeof USER_RELEASE_RECORD_INCLUDE;
}>;

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class UserReleaseRecordsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.userReleaseRecord.findUnique({
      where: {
        id,
      },
      include: USER_RELEASE_RECORD_INCLUDE,
    });
  }

  findByIdForUser(id: string, userId: string) {
    return this.prisma.userReleaseRecord.findFirst({
      where: {
        id,
        userWorkRecord: {
          userId,
        },
      },
      include: USER_RELEASE_RECORD_INCLUDE,
    });
  }

  findByUserSince(userId: string, since?: Date | null) {
    return this.prisma.userReleaseRecord.findMany({
      where: {
        userWorkRecord: {
          userId,
        },
        ...(since
          ? {
              updatedAt: {
                gt: since,
              },
            }
          : {}),
      },
      include: USER_RELEASE_RECORD_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });
  }

  findByUserWorkRecord(userWorkRecordId: string) {
    return this.prisma.userReleaseRecord.findMany({
      where: {
        userWorkRecordId,
      },
      include: USER_RELEASE_RECORD_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
  }

  update(
    id: string,
    data: Prisma.UserReleaseRecordUpdateInput,
    client: PrismaClientLike = this.prisma,
  ) {
    return client.userReleaseRecord.update({
      where: {
        id,
      },
      data,
      include: USER_RELEASE_RECORD_INCLUDE,
    });
  }

  async updateForUser(
    id: string,
    userId: string,
    input: UpsertUserReleaseRecordDto,
  ) {
    const existing = await this.findByIdForUser(id, userId);

    if (!existing) {
      throw new NotFoundException(`Release record with id "${id}" was not found.`);
    }

    return this.update(id, this.buildUpdateData(input));
  }

  async softDeleteForUser(id: string, userId: string) {
    const existing = await this.findByIdForUser(id, userId);

    if (!existing) {
      throw new NotFoundException(`Release record with id "${id}" was not found.`);
    }

    return this.update(id, {
      deletedAt: new Date(),
      serverVersion: {
        increment: 1,
      },
      syncStatus: WorkSyncStatus.synced,
    });
  }

  async restoreForUser(id: string, userId: string) {
    const existing = await this.findByIdForUser(id, userId);

    if (!existing) {
      throw new NotFoundException(`Release record with id "${id}" was not found.`);
    }

    return this.update(id, {
      deletedAt: null,
      serverVersion: {
        increment: 1,
      },
      syncStatus: WorkSyncStatus.synced,
    });
  }

  buildUpdateData(input: UpsertUserReleaseRecordDto) {
    const data: Prisma.UserReleaseRecordUpdateInput = {};

    if (input.status !== undefined) {
      data.status = input.status;
    }

    if (input.rating !== undefined) {
      data.rating = input.rating;
    }

    if (input.shortReview !== undefined) {
      data.shortReview = input.shortReview.trim();
    }

    if (input.review !== undefined) {
      data.review = input.review.trim();
    }

    if (input.favorite !== undefined) {
      data.favorite = input.favorite;
    }

    return {
      ...data,
      serverVersion: {
        increment: 1,
      },
      syncStatus: WorkSyncStatus.synced,
    };
  }
}

export function toUserReleaseRecordResponse(record: UserReleaseRecordAggregate) {
  return {
    id: record.id,
    userWorkRecordId: record.userWorkRecordId,
    catalogReleaseId: record.catalogReleaseId,
    status: record.status,
    rating: record.rating,
    shortReview: record.shortReview,
    review: record.review,
    favorite: record.favorite,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
    syncStatus: toWorkSyncStatusValue(record.syncStatus),
    serverVersion: record.serverVersion,
  };
}
