import type { Prisma } from '@prisma/client';

export const WORK_AGGREGATE_INCLUDE = {
  catalogWork: true,
  catalogTitle: {
    include: {
      franchise: true,
      contributors: {
        include: {
          contributor: true,
        },
        orderBy: {
          displayOrder: 'asc',
        },
      },
      outgoingRelations: {
        include: {
          targetTitle: true,
        },
      },
    },
  },
} satisfies Prisma.UserWorkRecordInclude;

export type WorkAggregate = Prisma.UserWorkRecordGetPayload<{
  include: typeof WORK_AGGREGATE_INCLUDE;
}>;
