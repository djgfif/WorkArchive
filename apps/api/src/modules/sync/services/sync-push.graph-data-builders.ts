import type {
  ContributorEntityType,
  Prisma,
  SeriesKind,
  WorkContributorRole,
  WorkRelationType,
  WorkSeriesRole,
} from '@prisma/client';

import { normalizeString } from '../../works/work-aggregate';
import type { SyncContributorPayloadDto } from '../payloads/sync-contributor-payload.dto';
import type { SyncSeriesPayloadDto } from '../payloads/sync-series-payload.dto';
import type { SyncWorkContributorPayloadDto } from '../payloads/sync-work-contributor-payload.dto';
import type { SyncWorkRelationPayloadDto } from '../payloads/sync-work-relation-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from '../payloads/sync-work-series-link-payload.dto';
import { SERVER_SYNC_STATUS } from './sync-push.shared';
import { parseIsoDate, parseOptionalIsoDate } from './sync-push.data-utils';

export function buildSeriesCreateData(
  userId: string,
  payload: SyncSeriesPayloadDto,
): Prisma.UserSeriesUncheckedCreateInput {
  return {
    id: payload.id,
    userId,
    title: payload.title.trim(),
    normalizedTitle: normalizeString(payload.normalizedTitle),
    aliases: payload.aliases.map(normalizeString).filter(Boolean),
    kind: payload.kind as SeriesKind,
    parentId: payload.parentId ?? null,
    description: normalizeString(payload.description),
    thumbnailUrl: normalizeString(payload.thumbnailUrl),
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: 1,
  };
}

export function buildSeriesUpdateData(
  payload: SyncSeriesPayloadDto,
): Prisma.UserSeriesUncheckedUpdateInput {
  return {
    title: payload.title.trim(),
    normalizedTitle: normalizeString(payload.normalizedTitle),
    aliases: payload.aliases.map(normalizeString).filter(Boolean),
    kind: payload.kind as SeriesKind,
    parentId: payload.parentId ?? null,
    description: normalizeString(payload.description),
    thumbnailUrl: normalizeString(payload.thumbnailUrl),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: { increment: 1 },
  };
}

export function buildContributorCreateData(
  userId: string,
  payload: SyncContributorPayloadDto,
): Prisma.UserContributorUncheckedCreateInput {
  return {
    id: payload.id,
    userId,
    name: payload.name.trim(),
    normalizedName: normalizeString(payload.normalizedName),
    aliases: payload.aliases.map(normalizeString).filter(Boolean),
    entityType: payload.entityType as ContributorEntityType,
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: 1,
  };
}

export function buildContributorUpdateData(
  payload: SyncContributorPayloadDto,
): Prisma.UserContributorUncheckedUpdateInput {
  return {
    name: payload.name.trim(),
    normalizedName: normalizeString(payload.normalizedName),
    aliases: payload.aliases.map(normalizeString).filter(Boolean),
    entityType: payload.entityType as ContributorEntityType,
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: { increment: 1 },
  };
}

export function buildWorkSeriesLinkCreateData(
  payload: SyncWorkSeriesLinkPayloadDto,
): Prisma.UserWorkSeriesLinkUncheckedCreateInput {
  return {
    id: payload.id,
    userWorkId: payload.workId,
    userSeriesId: payload.seriesId,
    role: payload.role as WorkSeriesRole,
    orderIndex: payload.orderIndex ?? null,
    orderLabel: normalizeString(payload.orderLabel),
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: 1,
  };
}

export function buildWorkSeriesLinkUpdateData(
  payload: SyncWorkSeriesLinkPayloadDto,
): Prisma.UserWorkSeriesLinkUncheckedUpdateInput {
  return {
    role: payload.role as WorkSeriesRole,
    orderIndex: payload.orderIndex ?? null,
    orderLabel: normalizeString(payload.orderLabel),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: { increment: 1 },
  };
}

export function buildWorkContributorCreateData(
  payload: SyncWorkContributorPayloadDto,
): Prisma.UserWorkContributorUncheckedCreateInput {
  return {
    id: payload.id,
    userWorkId: payload.workId,
    userContributorId: payload.contributorId,
    role: payload.role as WorkContributorRole,
    displayOrder: payload.displayOrder,
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: 1,
  };
}

export function buildWorkContributorUpdateData(
  payload: SyncWorkContributorPayloadDto,
): Prisma.UserWorkContributorUncheckedUpdateInput {
  return {
    role: payload.role as WorkContributorRole,
    displayOrder: payload.displayOrder,
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: { increment: 1 },
  };
}

export function buildWorkRelationCreateData(
  userId: string,
  payload: SyncWorkRelationPayloadDto,
): Prisma.UserWorkRelationUncheckedCreateInput {
  return {
    id: payload.id,
    userId,
    sourceWorkId: payload.sourceWorkId,
    targetWorkId: payload.targetWorkId,
    relationType: payload.relationType as WorkRelationType,
    note: normalizeString(payload.note),
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: 1,
  };
}

export function buildWorkRelationUpdateData(
  payload: SyncWorkRelationPayloadDto,
): Prisma.UserWorkRelationUncheckedUpdateInput {
  return {
    relationType: payload.relationType as WorkRelationType,
    note: normalizeString(payload.note),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: { increment: 1 },
  };
}
