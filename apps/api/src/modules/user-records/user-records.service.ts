import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export const WORK_AGGREGATE_INCLUDE = {
  catalogWork: true,
} satisfies Prisma.UserWorkRecordInclude;

export type WorkAggregate = Prisma.UserWorkRecordGetPayload<{
  include: typeof WORK_AGGREGATE_INCLUDE;
}>;

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class UserRecordsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findActiveByUser(userId: string) {
    return this.prisma.userWorkRecord.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: WORK_AGGREGATE_INCLUDE,
      orderBy: {
        updatedAt: 'desc',
      },
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
      orderBy: {
        updatedAt: 'asc',
      },
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
}
