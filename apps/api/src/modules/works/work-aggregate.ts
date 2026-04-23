import type { Prisma } from '@prisma/client';

import type { WorkResponseDto } from './dto/work-response.dto';
import { toWorkSyncStatusValue } from './works.constants';
import type { WorkAggregate } from '../user-records/user-records.service';

export function toFlatWorkResponse(work: WorkAggregate): WorkResponseDto {
  return {
    id: work.id,
    catalogTitleId: work.catalogTitleId,
    type: work.catalogWork.type,
    title: work.catalogWork.title,
    author: work.catalogWork.author,
    genres: work.catalogWork.genres,
    description: work.catalogWork.description,
    thumbnailUrl: work.catalogWork.thumbnailUrl,
    status: work.status,
    rating: work.rating,
    shortReview: work.shortReview,
    review: work.review,
    tier: work.tier,
    favorite: work.favorite,
    createdAt: work.createdAt,
    updatedAt: work.updatedAt,
    deletedAt: work.deletedAt,
    syncStatus: toWorkSyncStatusValue(work.syncStatus),
    serverVersion: work.serverVersion,
  };
}

export function toUserWorkRecordView(work: WorkAggregate) {
  const title = work.catalogTitle;

  return {
    record: {
      id: work.id,
      status: work.status,
      rating: work.rating,
      shortReview: work.shortReview,
      review: work.review,
      tier: work.tier,
      favorite: work.favorite,
      createdAt: work.createdAt,
      updatedAt: work.updatedAt,
      deletedAt: work.deletedAt,
      syncStatus: toWorkSyncStatusValue(work.syncStatus),
      serverVersion: work.serverVersion,
    },
    catalog: title
      ? {
          id: title.id,
          mediumType: title.mediumType,
          subType: title.subType,
          title: title.displayTitle,
          originalTitle: title.originalTitle,
          releaseYear: title.releaseYear,
          status: title.status,
          summary: title.summary,
          thumbnailUrl: title.thumbnailUrl,
          verificationStatus: title.verificationStatus,
          franchise: title.franchise
            ? {
                id: title.franchise.id,
                name: title.franchise.displayName,
              }
            : null,
          contributors: title.contributors.map((entry) => ({
            id: entry.contributor.id,
            name: entry.contributor.displayName,
            role: entry.role,
          })),
          relations: title.outgoingRelations.map((relation) => ({
            relationType: relation.relationType,
            targetTitle: relation.targetTitle.displayTitle,
            targetTitleId: relation.targetTitleId,
          })),
          genres: work.catalogWork.genres,
        }
      : {
          id: work.catalogWorkId,
          mediumType: work.catalogWork.type,
          subType: null,
          title: work.catalogWork.title,
          originalTitle: null,
          releaseYear: null,
          status: 'unknown',
          summary: work.catalogWork.description,
          thumbnailUrl: work.catalogWork.thumbnailUrl,
          verificationStatus: 'draft',
          franchise: null,
          contributors: work.catalogWork.author
            ? [
                {
                  id: null,
                  name: work.catalogWork.author,
                  role: 'author',
                },
              ]
            : [],
          relations: [],
          genres: work.catalogWork.genres,
        },
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

export function hasChanges(
  data: Prisma.CatalogWorkUpdateInput | Prisma.UserWorkRecordUpdateInput,
) {
  return Object.keys(data).length > 0;
}
