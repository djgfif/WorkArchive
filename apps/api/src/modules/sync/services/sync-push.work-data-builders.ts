import { WorkType } from '@prisma/client';
import type { Prisma, WorkStatus } from '@prisma/client';

import type { CreateCatalogTitleInput } from '../../catalog/catalog-ingestion.service';
import { normalizeGenres, normalizeString } from '../../works/work-aggregate';
import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';
import {
  SERVER_SYNC_STATUS,
  type SyncCreateTitleView,
} from './sync-push.shared';
import {
  normalizeWorkPayloadTaxonomy,
  parseIsoDate,
  parseOptionalIsoDate,
} from './sync-push.data-utils';

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
