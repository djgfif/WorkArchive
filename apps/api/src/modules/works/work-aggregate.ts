import type { Prisma } from '@prisma/client';

import type { WorkResponseDto } from './dto/work-response.dto';
import { toWorkSyncStatusValue } from './works.constants';
import type { WorkAggregate } from '../user-records/user-records.service';

function getCatalogTitleContributorName(work: WorkAggregate) {
  const contributors = work.catalogTitle?.contributors ?? [];
  const author = contributors.find((entry) => entry.role === 'author');

  return (author ?? contributors[0])?.contributor.displayName ?? null;
}

export function toFlatWorkResponse(work: WorkAggregate): WorkResponseDto {
  const catalogTitle = work.catalogTitle;

  return {
    id: work.id,
    catalogTitleId: work.catalogTitleId,
    type: catalogTitle?.mediumType ?? work.catalogWork.type,
    title: catalogTitle?.displayTitle ?? work.catalogWork.title,
    author: getCatalogTitleContributorName(work) ?? work.catalogWork.author,
    genres: work.catalogWork.genres,
    description: catalogTitle?.summary ?? work.catalogWork.description,
    thumbnailUrl: catalogTitle?.thumbnailUrl ?? work.catalogWork.thumbnailUrl,
    status: work.status,
    rating: work.rating,
    personalTags: work.personalTags,
    shortReview: work.shortReview,
    review: work.review,
    favorite: work.favorite,
    progressCurrent: work.progressCurrent,
    progressTotal: work.progressTotal,
    progressUnit: work.progressUnit,
    lastConsumedLabel: work.lastConsumedLabel,
    startedAt: work.startedAt,
    completedAt: work.completedAt,
    droppedAt: work.droppedAt,
    lastConsumedAt: work.lastConsumedAt,
    createdAt: work.createdAt,
    updatedAt: work.updatedAt,
    deletedAt: work.deletedAt,
    syncStatus: toWorkSyncStatusValue(work.syncStatus),
    serverVersion: work.serverVersion,
  };
}

export function normalizeString(value?: string | null) {
  return value?.trim() ?? '';
}

export function normalizeGenres(genres?: string[] | null) {
  if (!genres) {
    return [];
  }

  return Array.from(
    new Set(genres.map((genre) => genre.trim()).filter(Boolean)),
  );
}

export function normalizePersonalTags(personalTags?: string[] | null) {
  if (!personalTags) {
    return [];
  }

  return Array.from(
    new Set(personalTags.map((tag) => tag.trim()).filter(Boolean)),
  );
}

export function hasChanges(
  data: Prisma.CatalogWorkUpdateInput | Prisma.UserWorkRecordUpdateInput,
) {
  return Object.keys(data).length > 0;
}
