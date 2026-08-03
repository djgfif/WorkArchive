import type { UserReleaseRecordAggregate } from '../../user-records/user-release-records.service';
import type { WorkAggregate } from '../../user-records/user-records.service';
import type { UserTimelineEntryAggregate } from '../../user-records/user-timeline-entries.service';
import { normalizeString } from '../../works/work-aggregate';
import type { SyncContributorPayloadDto } from '../payloads/sync-contributor-payload.dto';
import type { SyncReleaseRecordPayloadDto } from '../payloads/sync-release-record-payload.dto';
import type { SyncSeriesPayloadDto } from '../payloads/sync-series-payload.dto';
import type { SyncTimelineEntryPayloadDto } from '../payloads/sync-timeline-entry-payload.dto';
import type { SyncWorkContributorPayloadDto } from '../payloads/sync-work-contributor-payload.dto';
import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';
import type { SyncWorkRelationPayloadDto } from '../payloads/sync-work-relation-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from '../payloads/sync-work-series-link-payload.dto';
import {
  type UserContributorSyncView,
  type UserSeriesSyncView,
  type UserWorkContributorSyncView,
  type UserWorkRelationSyncView,
  type UserWorkSeriesLinkSyncView,
} from './sync-push.shared';
import { normalizeWorkPayloadTaxonomy } from './sync-push.data-builders';

export function areWorksEquivalent(
  existing: WorkAggregate,
  payload: SyncWorkPayloadDto,
) {
  const taxonomy = normalizeWorkPayloadTaxonomy(payload);

  return (
    (payload.catalogTitleId === undefined ||
      (payload.catalogTitleId ?? null) === (existing.catalogTitleId ?? null)) &&
    existing.catalogWork.type === payload.type &&
    existing.catalogWork.title === payload.title.trim() &&
    existing.catalogWork.author === normalizeString(payload.author) &&
    JSON.stringify(existing.catalogWork.genres) ===
      JSON.stringify(taxonomy.genres) &&
    existing.catalogWork.description === normalizeString(payload.description) &&
    existing.catalogWork.thumbnailUrl ===
      normalizeString(payload.thumbnailUrl) &&
    existing.status === payload.status &&
    existing.rating === (payload.rating ?? null) &&
    existing.shortReview === normalizeString(payload.shortReview) &&
    existing.review === normalizeString(payload.review) &&
    JSON.stringify(existing.personalTags) ===
      JSON.stringify(taxonomy.personalTags) &&
    existing.favorite === payload.favorite &&
    (existing.progressCurrent ?? null) === (payload.progressCurrent ?? null) &&
    (existing.progressTotal ?? null) === (payload.progressTotal ?? null) &&
    (existing.progressUnit ?? null) === (payload.progressUnit ?? null) &&
    (existing.lastConsumedLabel ?? null) ===
      (payload.lastConsumedLabel?.trim() ?? null) &&
    (payload.startedAt === undefined ||
      (existing.startedAt?.toISOString() ?? null) ===
        (payload.startedAt ?? null)) &&
    (payload.completedAt === undefined ||
      (existing.completedAt?.toISOString() ?? null) ===
        (payload.completedAt ?? null)) &&
    (payload.droppedAt === undefined ||
      (existing.droppedAt?.toISOString() ?? null) ===
        (payload.droppedAt ?? null)) &&
    (payload.lastConsumedAt === undefined ||
      (existing.lastConsumedAt?.toISOString() ?? null) ===
        (payload.lastConsumedAt ?? null)) &&
    existing.deletedAt?.toISOString() ===
      (payload.deletedAt === null ? undefined : payload.deletedAt)
  );
}

export function areReleaseRecordsEquivalent(
  existing: UserReleaseRecordAggregate,
  payload: SyncReleaseRecordPayloadDto,
) {
  return (
    existing.userWorkRecordId === payload.userWorkRecordId &&
    existing.catalogReleaseId === payload.catalogReleaseId &&
    existing.status === payload.status &&
    existing.rating === (payload.rating ?? null) &&
    existing.shortReview === normalizeString(payload.shortReview) &&
    existing.review === normalizeString(payload.review) &&
    existing.favorite === payload.favorite &&
    existing.deletedAt?.toISOString() ===
      (payload.deletedAt === null ? undefined : payload.deletedAt)
  );
}

export function areTimelineEntriesEquivalent(
  existing: UserTimelineEntryAggregate,
  payload: SyncTimelineEntryPayloadDto,
) {
  return (
    existing.userWorkRecordId === payload.workId &&
    existing.type === payload.type &&
    existing.source === (payload.source ?? 'manual') &&
    existing.occurredAt.toISOString() === payload.occurredAt &&
    existing.note === normalizeString(payload.note) &&
    existing.deletedAt?.toISOString() ===
      (payload.deletedAt === null ? undefined : payload.deletedAt)
  );
}

export function areSeriesEquivalent(
  existing: UserSeriesSyncView,
  payload: SyncSeriesPayloadDto,
) {
  return (
    existing.title === payload.title.trim() &&
    existing.normalizedTitle === normalizeString(payload.normalizedTitle) &&
    JSON.stringify(existing.aliases) ===
      JSON.stringify(payload.aliases.map(normalizeString).filter(Boolean)) &&
    existing.kind === payload.kind &&
    (existing.parentId ?? null) === (payload.parentId ?? null) &&
    existing.description === normalizeString(payload.description) &&
    existing.thumbnailUrl === normalizeString(payload.thumbnailUrl) &&
    existing.deletedAt?.toISOString() ===
      (payload.deletedAt === null ? undefined : payload.deletedAt)
  );
}

export function areContributorsEquivalent(
  existing: UserContributorSyncView,
  payload: SyncContributorPayloadDto,
) {
  return (
    existing.name === payload.name.trim() &&
    existing.normalizedName === normalizeString(payload.normalizedName) &&
    JSON.stringify(existing.aliases) ===
      JSON.stringify(payload.aliases.map(normalizeString).filter(Boolean)) &&
    existing.entityType === payload.entityType &&
    existing.deletedAt?.toISOString() ===
      (payload.deletedAt === null ? undefined : payload.deletedAt)
  );
}

export function areWorkSeriesLinksEquivalent(
  existing: UserWorkSeriesLinkSyncView,
  payload: SyncWorkSeriesLinkPayloadDto,
) {
  return (
    existing.userWorkId === payload.workId &&
    existing.userSeriesId === payload.seriesId &&
    existing.role === payload.role &&
    (existing.orderIndex ?? null) === (payload.orderIndex ?? null) &&
    existing.orderLabel === normalizeString(payload.orderLabel) &&
    existing.deletedAt?.toISOString() ===
      (payload.deletedAt === null ? undefined : payload.deletedAt)
  );
}

export function areWorkContributorsEquivalent(
  existing: UserWorkContributorSyncView,
  payload: SyncWorkContributorPayloadDto,
) {
  return (
    existing.userWorkId === payload.workId &&
    existing.userContributorId === payload.contributorId &&
    existing.role === payload.role &&
    existing.displayOrder === payload.displayOrder &&
    existing.deletedAt?.toISOString() ===
      (payload.deletedAt === null ? undefined : payload.deletedAt)
  );
}

export function areWorkRelationsEquivalent(
  existing: UserWorkRelationSyncView,
  payload: SyncWorkRelationPayloadDto,
) {
  return (
    existing.sourceWorkId === payload.sourceWorkId &&
    existing.targetWorkId === payload.targetWorkId &&
    existing.relationType === payload.relationType &&
    existing.note === normalizeString(payload.note) &&
    existing.deletedAt?.toISOString() ===
      (payload.deletedAt === null ? undefined : payload.deletedAt)
  );
}
