import { BadRequestException } from '@nestjs/common';
import {
  CatalogWorkSource,
  WorkStatus,
  WorkSyncStatus,
  WorkType,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

import type { CreateWorkDto } from './dto/create-work.dto';
import type { UpdateWorkDto } from './dto/update-work.dto';
import {
  normalizeGenres,
  normalizePersonalTags,
  normalizeString,
} from './work-aggregate';

export const DEFAULT_SYNC_STATUS = WorkSyncStatus.synced;

export function parseOptionalDtoDate(
  value: string | null | undefined,
  fieldName: string,
) {
  if (value === undefined || value === null) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(
      `${fieldName} must be a valid ISO 8601 date string.`,
    );
  }

  return parsed;
}

export function buildCatalogCreateData(
  createWorkDto: CreateWorkDto,
  normalizedGenres: string[],
): Prisma.CatalogWorkUncheckedCreateInput {
  const title = createWorkDto.title.trim();

  if (!title) {
    throw new BadRequestException('title must not be empty');
  }

  return {
    source: CatalogWorkSource.legacy_flat,
    type: createWorkDto.type ?? WorkType.novel,
    title,
    author: normalizeString(createWorkDto.author),
    genres: normalizedGenres,
    description: normalizeString(createWorkDto.description),
    thumbnailUrl: normalizeString(createWorkDto.thumbnailUrl),
  };
}

export function buildUserRecordCreateData(
  userId: string,
  catalogWorkId: string,
  createWorkDto: CreateWorkDto,
  normalizedPersonalTags: string[],
): Prisma.UserWorkRecordUncheckedCreateInput {
  return {
    userId,
    // Compatibility stage: flat works still create a 1:1 catalog work and user record.
    catalogWorkId,
    catalogTitleId: catalogWorkId,
    status: createWorkDto.status ?? WorkStatus.planned,
    rating: createWorkDto.rating ?? null,
    shortReview: normalizeString(createWorkDto.shortReview),
    review: normalizeString(createWorkDto.review),
    personalTags: normalizedPersonalTags,
    favorite: createWorkDto.favorite ?? false,
    startedAt: parseOptionalDtoDate(createWorkDto.startedAt, 'startedAt'),
    completedAt: parseOptionalDtoDate(
      createWorkDto.completedAt,
      'completedAt',
    ),
    droppedAt: parseOptionalDtoDate(createWorkDto.droppedAt, 'droppedAt'),
    lastConsumedAt: parseOptionalDtoDate(
      createWorkDto.lastConsumedAt,
      'lastConsumedAt',
    ),
    syncStatus: DEFAULT_SYNC_STATUS,
    serverVersion: 1,
  };
}

export function buildCatalogUpdateData(
  updateWorkDto: UpdateWorkDto,
  normalizedGenres?: string[],
): Prisma.CatalogWorkUpdateInput {
  const data: Prisma.CatalogWorkUpdateInput = {};

  if (updateWorkDto.type !== undefined) {
    data.type = updateWorkDto.type;
  }

  if (updateWorkDto.title !== undefined) {
    const title = updateWorkDto.title.trim();

    if (!title) {
      throw new BadRequestException('title must not be empty');
    }

    data.title = title;
  }

  if (updateWorkDto.author !== undefined) {
    data.author = normalizeString(updateWorkDto.author);
  }

  if (updateWorkDto.genres !== undefined) {
    data.genres = normalizedGenres ?? normalizeGenres(updateWorkDto.genres);
  }

  if (updateWorkDto.description !== undefined) {
    data.description = normalizeString(updateWorkDto.description);
  }

  if (updateWorkDto.thumbnailUrl !== undefined) {
    data.thumbnailUrl = normalizeString(updateWorkDto.thumbnailUrl);
  }

  return data;
}

export function buildUserRecordUpdateData(
  updateWorkDto: UpdateWorkDto,
  normalizedPersonalTags?: string[],
): Prisma.UserWorkRecordUpdateManyMutationInput {
  const data: Prisma.UserWorkRecordUpdateManyMutationInput = {};

  if (updateWorkDto.status !== undefined) {
    data.status = updateWorkDto.status;
  }

  if (updateWorkDto.rating !== undefined) {
    data.rating = updateWorkDto.rating;
  }

  if (updateWorkDto.shortReview !== undefined) {
    data.shortReview = normalizeString(updateWorkDto.shortReview);
  }

  if (updateWorkDto.review !== undefined) {
    data.review = normalizeString(updateWorkDto.review);
  }

  if (
    updateWorkDto.personalTags !== undefined ||
    normalizedPersonalTags !== undefined
  ) {
    data.personalTags =
      normalizedPersonalTags ?? normalizePersonalTags(updateWorkDto.personalTags);
  }

  if (updateWorkDto.favorite !== undefined) {
    data.favorite = updateWorkDto.favorite;
  }

  if (updateWorkDto.startedAt !== undefined) {
    data.startedAt = parseOptionalDtoDate(
      updateWorkDto.startedAt,
      'startedAt',
    );
  }

  if (updateWorkDto.completedAt !== undefined) {
    data.completedAt = parseOptionalDtoDate(
      updateWorkDto.completedAt,
      'completedAt',
    );
  }

  if (updateWorkDto.droppedAt !== undefined) {
    data.droppedAt = parseOptionalDtoDate(updateWorkDto.droppedAt, 'droppedAt');
  }

  if (updateWorkDto.lastConsumedAt !== undefined) {
    data.lastConsumedAt = parseOptionalDtoDate(
      updateWorkDto.lastConsumedAt,
      'lastConsumedAt',
    );
  }

  return data;
}
