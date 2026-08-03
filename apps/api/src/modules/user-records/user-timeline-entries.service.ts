import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { toWorkSyncStatusValue } from '../works/works.constants';

export const USER_TIMELINE_ENTRY_INCLUDE = {
  userWorkRecord: {
    select: {
      id: true,
      userId: true,
    },
  },
} satisfies Prisma.UserTimelineEntryInclude;

export type UserTimelineEntryAggregate = Prisma.UserTimelineEntryGetPayload<{
  include: typeof USER_TIMELINE_ENTRY_INCLUDE;
}>;

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class UserTimelineEntriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findById(id: string, client: PrismaClientLike = this.prisma) {
    return client.userTimelineEntry.findUnique({
      where: {
        id,
      },
      include: USER_TIMELINE_ENTRY_INCLUDE,
    });
  }

  findByUserSince(userId: string, since?: Date | null) {
    return this.prisma.userTimelineEntry.findMany({
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
      include: USER_TIMELINE_ENTRY_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });
  }

  update(
    id: string,
    data: Prisma.UserTimelineEntryUpdateInput,
    client: PrismaClientLike = this.prisma,
  ) {
    return client.userTimelineEntry.update({
      where: {
        id,
      },
      data,
      include: USER_TIMELINE_ENTRY_INCLUDE,
    });
  }

  create(
    data: Prisma.UserTimelineEntryUncheckedCreateInput,
    client: PrismaClientLike = this.prisma,
  ) {
    return client.userTimelineEntry.create({
      data,
      include: USER_TIMELINE_ENTRY_INCLUDE,
    });
  }
}

export function toUserTimelineEntryResponse(entry: UserTimelineEntryAggregate) {
  return {
    id: entry.id,
    workId: entry.userWorkRecordId,
    type: entry.type,
    source:
      entry.source === 'automatic'
        ? ('automatic' as const)
        : ('manual' as const),
    occurredAt: entry.occurredAt.toISOString(),
    note: entry.note,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    deletedAt: entry.deletedAt?.toISOString() ?? null,
    syncStatus: toWorkSyncStatusValue(entry.syncStatus),
    serverVersion: entry.serverVersion,
  };
}
