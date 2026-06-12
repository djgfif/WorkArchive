import type { Prisma, WorkType } from '@prisma/client';
import { normalizeWorkGenres } from '@work-archive/shared-types';

export interface CreateTitleFromLegacyWorkInput {
  id: string;
  type?: WorkType;
  title: string;
  author?: string;
  genres?: string[];
  description?: string;
  thumbnailUrl?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export function normalizeCatalogWorkGenres<T extends { genres?: unknown }>(
  data: T,
): T {
  if (!Array.isArray(data.genres)) {
    return data;
  }

  return {
    ...data,
    genres: normalizeWorkGenres(
      data.genres.filter((value): value is string => typeof value === 'string'),
    ),
  };
}

export function buildLegacyCatalogTitleUpsertData(
  work: CreateTitleFromLegacyWorkInput,
) {
  const displayTitle = work.title.trim();

  if (!displayTitle) {
    return null;
  }

  const create: Prisma.CatalogTitleUncheckedCreateInput = {
    canonicalTitle: displayTitle,
    displayTitle,
    id: work.id,
    mediumType: work.type ?? 'other',
    summary: work.description?.trim() ?? '',
    thumbnailUrl: work.thumbnailUrl?.trim() ?? '',
  };
  const update: Prisma.CatalogTitleUncheckedUpdateInput = {
    canonicalTitle: displayTitle,
    displayTitle,
    summary: work.description?.trim() ?? '',
    thumbnailUrl: work.thumbnailUrl?.trim() ?? '',
  };

  if (work.createdAt !== undefined) {
    create.createdAt = work.createdAt;
  }

  if (work.updatedAt !== undefined) {
    create.updatedAt = work.updatedAt;
  }

  if (work.type !== undefined) {
    update.mediumType = work.type;
  }

  return {
    create,
    update,
  };
}
