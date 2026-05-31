import { BadRequestException } from '@nestjs/common';
import { WorkType } from '@prisma/client';
import type {
  ContributorEntityType,
  Prisma,
  SeriesKind,
  TimelineEntryType,
  WorkContributorRole,
  WorkRelationType,
  WorkSeriesRole,
  WorkStatus,
} from '@prisma/client';

import type { CreateCatalogTitleInput } from '../../catalog/catalog-ingestion.service';
import {
  normalizeGenres,
  normalizeGenresAndPersonalTags,
  normalizeString,
} from '../../works/work-aggregate';
import type { SyncContributorPayloadDto } from '../payloads/sync-contributor-payload.dto';
import type { SyncReleaseRecordPayloadDto } from '../payloads/sync-release-record-payload.dto';
import type { SyncSeriesPayloadDto } from '../payloads/sync-series-payload.dto';
import type { SyncTimelineEntryPayloadDto } from '../payloads/sync-timeline-entry-payload.dto';
import type { SyncWorkContributorPayloadDto } from '../payloads/sync-work-contributor-payload.dto';
import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';
import type { SyncWorkRelationPayloadDto } from '../payloads/sync-work-relation-payload.dto';
import type { SyncWorkSeriesLinkPayloadDto } from '../payloads/sync-work-series-link-payload.dto';
import {
  SERVER_SYNC_STATUS,
  type SyncCreateTitleView,
} from './sync-push.shared';

export function parseIsoDate(value: string, fieldName: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(
      `${fieldName} must be a valid ISO 8601 date string.`,
    );
  }

  return parsed;
}

export function parseOptionalIsoDate(value: string | null, fieldName: string) {
  if (value === null) {
    return null;
  }

  return parseIsoDate(value, fieldName);
}

export function normalizeWorkPayloadTaxonomy(payload: SyncWorkPayloadDto) {
  return normalizeGenresAndPersonalTags(payload.genres, payload.personalTags);
}

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
    occurredAt: parseIsoDate(payload.occurredAt, 'payload.occurredAt'),
    note: normalizeString(payload.note),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: {
      increment: 1,
    },
  };
}

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

export function buildCatalogCreateData(
  payload: SyncWorkPayloadDto,
): Prisma.CatalogWorkUncheckedCreateInput {
  return {
    id: payload.id,
    type: payload.type as WorkType,
    title: payload.title.trim(),
    author: normalizeString(payload.author),
    genres: normalizeGenres(payload.genres),
    description: normalizeString(payload.description),
    thumbnailUrl: normalizeString(payload.thumbnailUrl),
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
  };
}

export function buildUserRecordCreateData(
  userId: string,
  payload: SyncWorkPayloadDto,
  catalogTitleId = payload.catalogTitleId ?? payload.id,
): Prisma.UserWorkRecordUncheckedCreateInput {
  return {
    id: payload.id,
    userId,
    // Split-only compatibility: keep catalogWorkId mapped 1:1 to payload.id.
    catalogWorkId: payload.id,
    catalogTitleId,
    status: payload.status as WorkStatus,
    rating: payload.rating ?? null,
    shortReview: normalizeString(payload.shortReview),
    review: normalizeString(payload.review),
    personalTags: normalizeWorkPayloadTaxonomy(payload).personalTags,
    favorite: payload.favorite,
    progressCurrent: payload.progressCurrent ?? null,
    progressTotal: payload.progressTotal ?? null,
    progressUnit: payload.progressUnit ?? null,
    lastConsumedLabel: payload.lastConsumedLabel?.trim() ?? null,
    ...(payload.startedAt !== undefined
      ? {
          startedAt: parseOptionalIsoDate(
            payload.startedAt,
            'payload.startedAt',
          ),
        }
      : {}),
    ...(payload.completedAt !== undefined
      ? {
          completedAt: parseOptionalIsoDate(
            payload.completedAt,
            'payload.completedAt',
          ),
        }
      : {}),
    ...(payload.droppedAt !== undefined
      ? {
          droppedAt: parseOptionalIsoDate(
            payload.droppedAt,
            'payload.droppedAt',
          ),
        }
      : {}),
    ...(payload.lastConsumedAt !== undefined
      ? {
          lastConsumedAt: parseOptionalIsoDate(
            payload.lastConsumedAt,
            'payload.lastConsumedAt',
          ),
        }
      : {}),
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: 1,
  };
}

export function buildImportTitleCreateData(
  payload: SyncWorkPayloadDto,
  catalogTitle: string,
): CreateCatalogTitleInput {
  const importDraft = payload.importDraft!;

  return {
    canonicalTitle: catalogTitle,
    ...(importDraft.contributors && importDraft.contributors.length > 0
      ? {
          contributorNames: importDraft.contributors.map((contributor) =>
            contributor.name.trim(),
          ),
        }
      : {}),
    displayTitle: catalogTitle,
    ...(importDraft.externalRefs && importDraft.externalRefs.length > 0
      ? {
          externalRefs: importDraft.externalRefs.map((ref) =>
            buildCatalogExternalRefInput(ref),
          ),
        }
      : {}),
    franchiseName: importDraft.franchiseName?.trim() ?? null,
    mediumType: importDraft.mediumType as WorkType,
    ...(importDraft.releaseCandidates &&
    importDraft.releaseCandidates.length > 0
      ? {
          releaseCandidates: importDraft.releaseCandidates.map((release) =>
            buildCatalogReleaseCandidateInput(release),
          ),
        }
      : {}),
    releaseYear: importDraft.releaseYear ?? null,
    subType: importDraft.subType?.trim() ?? null,
    summary: normalizeString(payload.description),
    thumbnailUrl: normalizeString(payload.thumbnailUrl),
  };
}

export function buildCompatibilityCatalogWorkCreateData(
  payload: SyncWorkPayloadDto,
  title?: SyncCreateTitleView,
): Prisma.CatalogWorkUncheckedCreateInput {
  const fallbackAuthor =
    title?.contributors
      .map((entry) => entry.contributor.displayName)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ') ??
    payload.importDraft?.contributors
      ?.map((contributor) => contributor.name.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(', ') ??
    '';

  return {
    id: payload.id,
    type: (payload.type ?? title?.mediumType ?? WorkType.other) as WorkType,
    title:
      payload.title.trim() ||
      title?.displayTitle ||
      payload.importDraft?.catalogTitle?.trim() ||
      payload.id,
    author: normalizeString(payload.author) || fallbackAuthor,
    genres: normalizeGenres(payload.genres),
    description:
      normalizeString(payload.description) || normalizeString(title?.summary),
    thumbnailUrl:
      normalizeString(payload.thumbnailUrl) ||
      normalizeString(title?.thumbnailUrl),
    createdAt: parseIsoDate(payload.createdAt, 'payload.createdAt'),
    updatedAt: parseIsoDate(payload.updatedAt, 'payload.updatedAt'),
  };
}

export function resolveImportDraftCatalogTitle(payload: SyncWorkPayloadDto) {
  const catalogTitle = payload.importDraft?.catalogTitle?.trim();

  if (catalogTitle) {
    return catalogTitle;
  }

  const fallbackTitle = payload.title.trim();

  return fallbackTitle || null;
}

export function buildCatalogExternalRefInput(ref: {
  externalId: string;
  provider: string;
  rawType?: string | null;
  url?: string | null;
}) {
  return {
    externalId: ref.externalId.trim(),
    provider: ref.provider.trim(),
    ...(ref.rawType?.trim() ? { rawType: ref.rawType.trim() } : {}),
    ...(ref.url?.trim() ? { url: ref.url.trim() } : {}),
  };
}

export function buildCatalogReleaseCandidateInput(release: {
  displayLabel?: string | null;
  externalRefs?: Array<{
    externalId: string;
    provider: string;
    rawType?: string | null;
    url?: string | null;
  }> | null;
  isbn?: string | null;
  releaseDate?: string | Date | null;
  releaseType?: string | null;
  sequence?: number | null;
  thumbnailUrl?: string | null;
  title?: string | null;
}) {
  return {
    ...(release.displayLabel?.trim()
      ? { displayLabel: release.displayLabel.trim() }
      : {}),
    ...(release.externalRefs && release.externalRefs.length > 0
      ? {
          externalRefs: release.externalRefs.map((ref) =>
            buildCatalogExternalRefInput(ref),
          ),
        }
      : {}),
    isbn: release.isbn?.trim() ?? null,
    releaseDate: release.releaseDate ?? null,
    ...(release.releaseType?.trim()
      ? { releaseType: release.releaseType.trim() }
      : {}),
    sequence: release.sequence ?? null,
    ...(release.thumbnailUrl?.trim()
      ? { thumbnailUrl: release.thumbnailUrl.trim() }
      : {}),
    ...(release.title?.trim() ? { title: release.title.trim() } : {}),
  };
}

export function buildCatalogUpdateData(
  payload: SyncWorkPayloadDto,
): Prisma.CatalogWorkUpdateInput {
  return {
    type: payload.type as WorkType,
    title: payload.title.trim(),
    author: normalizeString(payload.author),
    genres: normalizeGenres(payload.genres),
    description: normalizeString(payload.description),
    thumbnailUrl: normalizeString(payload.thumbnailUrl),
  };
}

export function buildUserRecordUpdateData(
  payload: SyncWorkPayloadDto,
): Prisma.UserWorkRecordUpdateInput {
  return {
    status: payload.status as WorkStatus,
    rating: payload.rating ?? null,
    shortReview: normalizeString(payload.shortReview),
    review: normalizeString(payload.review),
    personalTags: normalizeWorkPayloadTaxonomy(payload).personalTags,
    favorite: payload.favorite,
    progressCurrent: payload.progressCurrent ?? null,
    progressTotal: payload.progressTotal ?? null,
    progressUnit: payload.progressUnit ?? null,
    lastConsumedLabel: payload.lastConsumedLabel?.trim() ?? null,
    startedAt: parseOptionalIsoDate(
      payload.startedAt ?? null,
      'payload.startedAt',
    ),
    completedAt: parseOptionalIsoDate(
      payload.completedAt ?? null,
      'payload.completedAt',
    ),
    droppedAt: parseOptionalIsoDate(
      payload.droppedAt ?? null,
      'payload.droppedAt',
    ),
    lastConsumedAt: parseOptionalIsoDate(
      payload.lastConsumedAt ?? null,
      'payload.lastConsumedAt',
    ),
    deletedAt: parseOptionalIsoDate(payload.deletedAt, 'payload.deletedAt'),
    syncStatus: SERVER_SYNC_STATUS,
    serverVersion: {
      increment: 1,
    },
  };
}
