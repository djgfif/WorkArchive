import type { Prisma } from '@prisma/client';
import {
  moveUnknownGenresToPersonalTags,
  normalizeStringList,
} from '@work-archive/shared-types';

import type { WorkResponseDto } from './dto/work-response.dto';
import { toWorkSyncStatusValue } from './works.constants';
import type { WorkAggregate } from '../user-records/user-records.service';

function getCatalogTitleContributorName(work: WorkAggregate) {
  const contributors = work.catalogTitle?.contributors ?? [];
  const author = contributors.find((entry) => entry.role === 'author');

  return (author ?? contributors[0])?.contributor.displayName ?? null;
}

function getDisplayThumbnailUrl(work: WorkAggregate) {
  return (
    work.catalogTitle?.thumbnailUrl.trim() || work.catalogWork.thumbnailUrl
  );
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
    thumbnailUrl: getDisplayThumbnailUrl(work),
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
  return moveUnknownGenresToPersonalTags(genres ?? []).genres;
}

export function normalizePersonalTags(personalTags?: string[] | null) {
  return normalizeStringList(personalTags ?? []);
}

export function normalizeGenresAndPersonalTags(
  genres?: string[] | null,
  personalTags?: string[] | null,
) {
  return moveUnknownGenresToPersonalTags(genres ?? [], personalTags ?? []);
}

export function hasChanges(
  data: Prisma.CatalogWorkUpdateInput | Prisma.UserWorkRecordUpdateInput,
) {
  return Object.keys(data).length > 0;
}
