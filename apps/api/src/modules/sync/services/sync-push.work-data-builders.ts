import { WorkType } from '@prisma/client';
import type { Prisma, WorkStatus } from '@prisma/client';

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
