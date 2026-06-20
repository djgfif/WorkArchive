import { normalizeString } from '../../works/work-aggregate';
import type {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierBoardPayloadDto,
  SyncTierLanePayloadDto,
} from '../payloads/sync-tier-board-payload.dto';
import { parseIsoDate, parseOptionalIsoDate } from './sync-push.data-utils';
import { SERVER_SYNC_STATUS } from './sync-push.shared';

export function buildTierBoardUpdateData(payload: SyncTierBoardPayloadDto) {
  return {
    title: normalizeString(payload.title) || payload.id,
    description: normalizeString(payload.description),
    slug: normalizeString(payload.slug) || payload.id,
    boardType: payload.boardType,
    visibility: payload.visibility,
    coverImageUrl: normalizeString(payload.coverImageUrl),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: { increment: 1 },
  };
}

export function buildTierBoardCreateData(
  userId: string,
  payload: SyncTierBoardPayloadDto,
) {
  return {
    id: payload.id,
    userId,
    slug: normalizeString(payload.slug) || payload.id,
    title: normalizeString(payload.title) || payload.id,
    description: normalizeString(payload.description),
    boardType: payload.boardType,
    visibility: payload.visibility,
    coverImageUrl: normalizeString(payload.coverImageUrl),
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: 1,
  };
}

export function buildTierLaneUpdateData(payload: SyncTierLanePayloadDto) {
  return {
    title: normalizeString(payload.title) || payload.id,
    description: normalizeString(payload.description),
    colorToken: normalizeString(payload.colorToken) || '#64748b',
    orderIndex: payload.orderIndex,
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: { increment: 1 },
  };
}

export function buildTierLaneCreateData(payload: SyncTierLanePayloadDto) {
  return {
    id: payload.id,
    boardId: payload.boardId,
    title: normalizeString(payload.title) || payload.id,
    description: normalizeString(payload.description),
    colorToken: normalizeString(payload.colorToken) || '#64748b',
    orderIndex: payload.orderIndex,
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: 1,
  };
}

export function buildTierBoardCardUpdateData(
  payload: SyncTierBoardCardPayloadDto,
) {
  return {
    ...buildTierBoardCardBaseData(payload),
    serverVersion: { increment: 1 },
  };
}

export function buildTierBoardCardCreateData(
  payload: SyncTierBoardCardPayloadDto,
) {
  return {
    ...buildTierBoardCardBaseData(payload),
    id: payload.id,
    boardId: payload.boardId,
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    serverVersion: 1,
  };
}

export function buildTierBoardAssetUpdateData(
  payload: SyncTierBoardAssetPayloadDto,
) {
  return {
    kind: payload.kind,
    storageType: payload.storageType,
    objectUrl: normalizeString(payload.objectUrl),
    originalName: normalizeString(payload.originalName),
    mimeType: normalizeString(payload.mimeType),
    sizeBytes: payload.sizeBytes,
    cardId: payload.cardId,
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: { increment: 1 },
  };
}

export function buildTierBoardAssetCreateData(
  payload: SyncTierBoardAssetPayloadDto,
) {
  return {
    ...buildTierBoardAssetUpdateData(payload),
    id: payload.id,
    boardId: payload.boardId,
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    serverVersion: 1,
  };
}

function buildTierBoardCardBaseData(payload: SyncTierBoardCardPayloadDto) {
  return {
    cardSourceType: payload.cardSourceType,
    title: normalizeString(payload.title) || payload.id,
    subtitle: normalizeString(payload.subtitle),
    imageUrl: normalizeString(payload.imageUrl),
    note: normalizeString(payload.note),
    laneId: payload.laneId,
    userWorkId: payload.workId,
    orderIndex: payload.orderIndex,
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
  };
}
