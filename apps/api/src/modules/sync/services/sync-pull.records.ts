import type {
  Prisma,
  UserContributor,
  UserSeries,
  WorkSyncStatus,
} from '@prisma/client';

import type { UserReleaseRecordAggregate } from '../../user-records/user-release-records.service';
import type { UserTimelineEntryAggregate } from '../../user-records/user-timeline-entries.service';
import type { WorkAggregate } from '../../user-records/user-records.service';

export const USER_WORK_SERIES_LINK_INCLUDE = {
  userSeries: {
    select: {
      id: true,
      userId: true,
    },
  },
  userWork: {
    select: {
      id: true,
      userId: true,
    },
  },
} satisfies Prisma.UserWorkSeriesLinkInclude;

export const USER_WORK_CONTRIBUTOR_INCLUDE = {
  userContributor: {
    select: {
      id: true,
      userId: true,
    },
  },
  userWork: {
    select: {
      id: true,
      userId: true,
    },
  },
} satisfies Prisma.UserWorkContributorInclude;

export const USER_WORK_RELATION_INCLUDE = {
  sourceWork: {
    select: {
      id: true,
      userId: true,
    },
  },
  targetWork: {
    select: {
      id: true,
      userId: true,
    },
  },
} satisfies Prisma.UserWorkRelationInclude;

export type UserWorkSeriesLinkSyncView = Prisma.UserWorkSeriesLinkGetPayload<{
  include: typeof USER_WORK_SERIES_LINK_INCLUDE;
}>;
export type UserWorkContributorSyncView = Prisma.UserWorkContributorGetPayload<{
  include: typeof USER_WORK_CONTRIBUTOR_INCLUDE;
}>;
export type UserWorkRelationSyncView = Prisma.UserWorkRelationGetPayload<{
  include: typeof USER_WORK_RELATION_INCLUDE;
}>;

export type TierBoardSyncView = {
  id: string;
  slug: string;
  title: string;
  description: string;
  boardType: string;
  visibility: string;
  coverImageUrl: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
};

export type TierLaneSyncView = {
  id: string;
  boardId: string;
  title: string;
  description: string;
  colorToken: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
};

export type TierBoardCardSyncView = {
  id: string;
  boardId: string;
  laneId: string | null;
  cardSourceType: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  note: string;
  userWorkId: string | null;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
};

export type TierBoardAssetSyncView = {
  id: string;
  boardId: string;
  cardId: string | null;
  kind: string;
  storageType: string;
  objectUrl: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  syncStatus: WorkSyncStatus;
  serverVersion: number;
};

export type PullChangeRecords = {
  contributors: UserContributor[];
  releaseRecords: UserReleaseRecordAggregate[];
  series: UserSeries[];
  tierBoardAssets: TierBoardAssetSyncView[];
  tierBoardCards: TierBoardCardSyncView[];
  tierLanes: TierLaneSyncView[];
  tierBoards: TierBoardSyncView[];
  timelineEntries: UserTimelineEntryAggregate[];
  workContributors: UserWorkContributorSyncView[];
  workRelations: UserWorkRelationSyncView[];
  workSeriesLinks: UserWorkSeriesLinkSyncView[];
  works: WorkAggregate[];
};
