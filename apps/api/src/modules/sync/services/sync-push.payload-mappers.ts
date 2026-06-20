import {
  SERVER_SYNC_STATUS,
  type UserContributorSyncView,
  type UserSeriesSyncView,
  type UserWorkContributorSyncView,
  type UserWorkRelationSyncView,
  type UserWorkSeriesLinkSyncView,
} from './sync-push.shared';
import type { SyncContributorPayloadDto } from '../payloads/sync-contributor-payload.dto';
import type { SyncSeriesPayloadDto } from '../payloads/sync-series-payload.dto';
import type {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierLanePayloadDto,
  SyncTierBoardPayloadDto,
} from '../payloads/sync-tier-board-payload.dto';
import type { SyncWorkContributorPayloadDto } from '../payloads/sync-work-contributor-payload.dto';
import type { SyncWorkRelationPayloadDto } from '../payloads/sync-work-relation-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from '../payloads/sync-work-series-link-payload.dto';

export function toPushSyncSeriesPayload(
  series: UserSeriesSyncView,
): SyncSeriesPayloadDto {
  return {
    id: series.id,
    title: series.title,
    normalizedTitle: series.normalizedTitle,
    aliases: series.aliases,
    kind: series.kind,
    parentId: series.parentId ?? null,
    description: series.description,
    thumbnailUrl: series.thumbnailUrl,
    createdAt: series.createdAt.toISOString(),
    updatedAt: series.updatedAt.toISOString(),
    deletedAt: series.deletedAt?.toISOString() ?? null,
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: series.serverVersion,
  };
}

export function toPushSyncContributorPayload(
  contributor: UserContributorSyncView,
): SyncContributorPayloadDto {
  return {
    id: contributor.id,
    name: contributor.name,
    normalizedName: contributor.normalizedName,
    aliases: contributor.aliases,
    entityType: contributor.entityType,
    createdAt: contributor.createdAt.toISOString(),
    updatedAt: contributor.updatedAt.toISOString(),
    deletedAt: contributor.deletedAt?.toISOString() ?? null,
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: contributor.serverVersion,
  };
}

export function toPushSyncWorkSeriesLinkPayload(
  link: UserWorkSeriesLinkSyncView,
): SyncWorkSeriesLinkPayloadDto {
  return {
    id: link.id,
    workId: link.userWorkId,
    seriesId: link.userSeriesId,
    role: link.role,
    orderIndex: link.orderIndex ?? null,
    orderLabel: link.orderLabel,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
    deletedAt: link.deletedAt?.toISOString() ?? null,
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: link.serverVersion,
  };
}

export function toPushSyncWorkContributorPayload(
  link: UserWorkContributorSyncView,
): SyncWorkContributorPayloadDto {
  return {
    id: link.id,
    workId: link.userWorkId,
    contributorId: link.userContributorId,
    role: link.role,
    displayOrder: link.displayOrder,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
    deletedAt: link.deletedAt?.toISOString() ?? null,
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: link.serverVersion,
  };
}

export function toPushSyncWorkRelationPayload(
  relation: UserWorkRelationSyncView,
): SyncWorkRelationPayloadDto {
  return {
    id: relation.id,
    sourceWorkId: relation.sourceWorkId,
    targetWorkId: relation.targetWorkId,
    relationType: relation.relationType,
    note: relation.note,
    createdAt: relation.createdAt.toISOString(),
    updatedAt: relation.updatedAt.toISOString(),
    deletedAt: relation.deletedAt?.toISOString() ?? null,
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: relation.serverVersion,
  };
}

export function toPushSyncTierBoardPayload(board: {
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
  serverVersion: number;
}): SyncTierBoardPayloadDto {
  return {
    id: board.id,
    title: board.title,
    description: board.description,
    slug: board.slug,
    boardType: board.boardType as SyncTierBoardPayloadDto['boardType'],
    visibility: board.visibility as SyncTierBoardPayloadDto['visibility'],
    coverImageUrl: board.coverImageUrl,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    deletedAt: board.deletedAt?.toISOString() ?? null,
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: board.serverVersion,
  };
}

export function toPushSyncTierLanePayload(lane: {
  id: string;
  boardId: string;
  title: string;
  description: string;
  colorToken: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  serverVersion: number;
}): SyncTierLanePayloadDto {
  return {
    id: lane.id,
    boardId: lane.boardId,
    title: lane.title,
    description: lane.description,
    colorToken: lane.colorToken,
    orderIndex: lane.orderIndex,
    createdAt: lane.createdAt.toISOString(),
    updatedAt: lane.updatedAt.toISOString(),
    deletedAt: lane.deletedAt?.toISOString() ?? null,
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: lane.serverVersion,
  };
}

export function toPushSyncTierBoardCardPayload(card: {
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
  serverVersion: number;
}): SyncTierBoardCardPayloadDto {
  return {
    id: card.id,
    boardId: card.boardId,
    laneId: card.laneId,
    cardSourceType:
      card.cardSourceType as SyncTierBoardCardPayloadDto['cardSourceType'],
    title: card.title,
    subtitle: card.subtitle,
    imageUrl: card.imageUrl,
    note: card.note,
    workId: card.userWorkId,
    orderIndex: card.orderIndex,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
    deletedAt: card.deletedAt?.toISOString() ?? null,
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: card.serverVersion,
  };
}

export function toPushSyncTierBoardAssetPayload(asset: {
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
  serverVersion: number;
}): SyncTierBoardAssetPayloadDto {
  return {
    id: asset.id,
    boardId: asset.boardId,
    cardId: asset.cardId,
    kind: asset.kind as SyncTierBoardAssetPayloadDto['kind'],
    storageType: asset.storageType as SyncTierBoardAssetPayloadDto['storageType'],
    objectUrl: asset.objectUrl,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    deletedAt: asset.deletedAt?.toISOString() ?? null,
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: asset.serverVersion,
  };
}
