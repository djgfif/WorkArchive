import type { Prisma, TimelineEntryType, WorkStatus } from '@prisma/client';

import { normalizeString } from '../../works/work-aggregate';
import type { SyncReleaseRecordPayloadDto } from '../payloads/sync-release-record-payload.dto';
import type { SyncTimelineEntryPayloadDto } from '../payloads/sync-timeline-entry-payload.dto';
import { SERVER_SYNC_STATUS } from './sync-push.shared';
import { parseIsoDate, parseOptionalIsoDate } from './sync-push.data-utils';

export function buildReleaseRecordCreateData(
  payload: SyncReleaseRecordPayloadDto,
): Prisma.UserReleaseRecordUncheckedCreateInput {
  return {
    id: payload.id,
    userWorkRecordId: payload.userWorkRecordId,
    catalogReleaseId: payload.catalogReleaseId,
    status: payload.status as WorkStatus,
    rating: payload.rating ?? null,
    shortReview: normalizeString(payload.shortReview),
    review: normalizeString(payload.review),
    favorite: payload.favorite,
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: 1,
  };
}

export function buildReleaseRecordUpdateData(
  payload: SyncReleaseRecordPayloadDto,
): Prisma.UserReleaseRecordUpdateInput {
  return {
    status: payload.status as WorkStatus,
    rating: payload.rating ?? null,
    shortReview: normalizeString(payload.shortReview),
    review: normalizeString(payload.review),
    favorite: payload.favorite,
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: {
      increment: 1,
    },
  };
}

export function buildTimelineEntryCreateData(
  userId: string,
  payload: SyncTimelineEntryPayloadDto,
): Prisma.UserTimelineEntryUncheckedCreateInput {
  return {
    id: payload.id,
    userId,
    userWorkRecordId: payload.workId,
    type: payload.type as TimelineEntryType,
    source: payload.source === 'automatic' ? 'automatic' : 'manual',
    occurredAt: parseIsoDate(payload.occurredAt, 'payload.occurredAt'),
    note: normalizeString(payload.note),
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: 1,
  };
}

export function buildTimelineEntryUpdateData(
  payload: SyncTimelineEntryPayloadDto,
): Prisma.UserTimelineEntryUpdateInput {
  return {
    type: payload.type as TimelineEntryType,
    source: payload.source === 'automatic' ? 'automatic' : 'manual',
    occurredAt: parseIsoDate(payload.occurredAt, 'payload.occurredAt'),
    note: normalizeString(payload.note),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: {
      increment: 1,
    },
  };
}
