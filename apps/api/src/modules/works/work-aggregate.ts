import type { Prisma } from '@prisma/client';

import type { WorkResponseDto } from './dto/work-response.dto';
import { toWorkSyncStatusValue } from './works.constants';
import type { WorkAggregate } from '../user-records/user-records.service';

export function toFlatWorkResponse(work: WorkAggregate): WorkResponseDto {
  return {
    id: work.id,
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
