import { WorkSyncStatus } from '@prisma/client';
import type { Prisma, UserContributor, UserSeries } from '@prisma/client';

export const SERVER_SYNC_STATUS = WorkSyncStatus.synced;
export const ALREADY_APPLIED_MESSAGE =
  'Remote record already matches the queued change.';
export const APPLIED_CHANGE_MESSAGE = 'Queued change applied on the server.';
export const APPLIED_TOMBSTONE_MESSAGE =
  'Queued tombstone applied on the server.';
export const CREATED_MESSAGE = 'Queued record created on the server.';
export const MISSING_REMOTE_DELETE_NOOP_MESSAGE =
  'Remote delete was a no-op because the server record is missing.';

export const SYNC_CODES = {
  alreadyApplied: 'already_applied',
  appliedChange: 'applied_change',
  appliedTombstone: 'applied_tombstone',
  conflictOwnershipMismatch: 'conflict_ownership_mismatch',
  conflictParentChanged: 'conflict_parent_changed',
  conflictRemoteMissing: 'conflict_remote_missing',
  conflictRemoteNewer: 'conflict_remote_newer',
  created: 'created',
  failedImportDraftUnresolved: 'failed_import_draft_unresolved',
  failedClientMutationReused: 'failed_client_mutation_reused',
  failedMissingCatalogTitle: 'failed_missing_catalog_title',
  failedValidation: 'failed_validation',
  missingRemoteDeleteNoop: 'missing_remote_delete_noop',
} as const;

export function getAppliedMutationResult(deletedAt: string | null) {
  return deletedAt === null
    ? {
        code: SYNC_CODES.appliedChange,
        message: APPLIED_CHANGE_MESSAGE,
      }
    : {
        code: SYNC_CODES.appliedTombstone,
        message: APPLIED_TOMBSTONE_MESSAGE,
      };
}

export const SYNC_CREATE_TITLE_INCLUDE = {
  contributors: {
    include: {
      contributor: true,
    },
    orderBy: {
      displayOrder: 'asc',
    },
  },
} satisfies Prisma.CatalogTitleInclude;

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

export type SyncCreateTitleView = Prisma.CatalogTitleGetPayload<{
  include: typeof SYNC_CREATE_TITLE_INCLUDE;
}>;
export type UserSeriesSyncView = UserSeries;
export type UserContributorSyncView = UserContributor;
export type UserWorkSeriesLinkSyncView = Prisma.UserWorkSeriesLinkGetPayload<{
  include: typeof USER_WORK_SERIES_LINK_INCLUDE;
}>;
export type UserWorkContributorSyncView =
  Prisma.UserWorkContributorGetPayload<{
    include: typeof USER_WORK_CONTRIBUTOR_INCLUDE;
  }>;
export type UserWorkRelationSyncView = Prisma.UserWorkRelationGetPayload<{
  include: typeof USER_WORK_RELATION_INCLUDE;
}>;
export type GraphPayloadKey =
  | 'contributor'
  | 'series'
  | 'workContributor'
  | 'workRelation'
  | 'workSeriesLink';
