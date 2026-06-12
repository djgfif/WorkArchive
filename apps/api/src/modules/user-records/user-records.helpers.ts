import { BadRequestException } from '@nestjs/common';
import {
  WorkStatus,
  WorkSyncStatus,
  WorkType,
  type Prisma,
} from '@prisma/client';

import {
  canUseProgressUnit,
  canCreateReleaseRecord,
  getDefaultProgressUnit,
  RECORDING_UNIT,
} from '../recording/recording-policy';
import type { GroupedWorksQueryDto } from '../works/dto/grouped-works-query.dto';
import {
  normalizePersonalTags,
  normalizeString,
} from '../works/work-aggregate';
import type { CatalogService } from '../catalog/catalog.service';
import type {
  CreateUserRecordDto,
  CreateUserRecordFromImportDto,
  UpdateProgressDto,
  UpdateUserRecordDto,
} from './dto/user-record.dto';
import type { UpsertUserReleaseRecordDto } from './dto/user-release-record.dto';
import type { WorkAggregate } from './user-records.types';

type CatalogTitleImportInput = Parameters<
  CatalogService['createTitleFromImportCandidate']
>[0];

export function parseOptionalUserRecordDtoDate(
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

export function getUserRecordMedium(record: WorkAggregate) {
  return record.catalogTitle?.mediumType ?? record.catalogWork.type;
}

export function buildUserRecordRecordingPolicy(mediumType: WorkType) {
  return {
    recordingUnit: RECORDING_UNIT,
    mediumType,
    releaseRecordsSupported: canCreateReleaseRecord(mediumType),
    progressOnly:
      mediumType === WorkType.anime ||
      mediumType === WorkType.drama ||
      mediumType === WorkType.web_novel ||
      mediumType === WorkType.webtoon,
    defaultProgressUnit: getDefaultProgressUnit(mediumType),
    webPartSplitEnabled:
      mediumType !== WorkType.web_novel && mediumType !== WorkType.webtoon,
  };
}

export function getUserRecordGroupKey(
  record: WorkAggregate,
  by: GroupedWorksQueryDto['by'],
) {
  if (by === 'status') {
    return {
      key: record.status,
      label: record.status,
    };
  }

  if (by === 'medium') {
    const mediumType = getUserRecordMedium(record);

    return {
      key: mediumType,
      label: mediumType,
    };
  }

  if (by === 'franchise') {
    const franchise = record.catalogTitle?.franchise;

    return {
      key: franchise?.id ?? 'unfranchised',
      label: franchise?.displayName ?? '프랜차이즈 미지정',
    };
  }

  const contributor = record.catalogTitle?.contributors[0]?.contributor;

  return {
    key: contributor?.id ?? 'unknown-contributor',
    label:
      contributor?.displayName ??
      (record.catalogWork.author || '기여자 미지정'),
  };
}

export function buildSyncedUserRecordUpdateData(
  input: UpdateUserRecordDto,
): Prisma.UserWorkRecordUpdateManyMutationInput {
  const data: Prisma.UserWorkRecordUpdateManyMutationInput = {};

  if (input.status !== undefined) {
    data.status = input.status;
  }

  if (input.rating !== undefined) {
    data.rating = input.rating;
  }

  if (input.shortReview !== undefined) {
    data.shortReview = normalizeString(input.shortReview);
  }

  if (input.review !== undefined) {
    data.review = normalizeString(input.review);
  }

  if (input.favorite !== undefined) {
    data.favorite = input.favorite;
  }

  if (input.personalTags !== undefined) {
    data.personalTags = normalizePersonalTags(input.personalTags);
  }

  if (input.startedAt !== undefined) {
    data.startedAt = parseOptionalUserRecordDtoDate(
      input.startedAt,
      'startedAt',
    );
  }

  if (input.completedAt !== undefined) {
    data.completedAt = parseOptionalUserRecordDtoDate(
      input.completedAt,
      'completedAt',
    );
  }

  if (input.droppedAt !== undefined) {
    data.droppedAt = parseOptionalUserRecordDtoDate(
      input.droppedAt,
      'droppedAt',
    );
  }

  if (input.lastConsumedAt !== undefined) {
    data.lastConsumedAt = parseOptionalUserRecordDtoDate(
      input.lastConsumedAt,
      'lastConsumedAt',
    );
  }

  return {
    ...data,
    serverVersion: {
      increment: 1,
    },
    syncStatus: WorkSyncStatus.synced,
  };
}

export function buildSyncedProgressUpdateData({
  existing,
  input,
  mediumType,
}: {
  existing: Pick<
    WorkAggregate,
    'lastConsumedLabel' | 'progressCurrent' | 'progressTotal'
  >;
  input: UpdateProgressDto;
  mediumType: WorkType;
}): Prisma.UserWorkRecordUpdateManyMutationInput {
  const progressUnit = input.progressUnit ?? getDefaultProgressUnit(mediumType);

  if (
    progressUnit === null ||
    !canUseProgressUnit(mediumType, progressUnit)
  ) {
    throw new BadRequestException(
      `Progress unit is not supported for medium type "${mediumType}".`,
    );
  }

  if (
    input.progressCurrent !== undefined &&
    input.progressTotal !== undefined &&
    input.progressCurrent !== null &&
    input.progressTotal !== null &&
    input.progressCurrent > input.progressTotal
  ) {
    throw new BadRequestException(
      'progressCurrent cannot exceed progressTotal.',
    );
  }

  return {
    lastConsumedLabel:
      input.lastConsumedLabel === undefined
        ? existing.lastConsumedLabel
        : (input.lastConsumedLabel?.trim() ?? null),
    progressCurrent:
      input.progressCurrent === undefined
        ? existing.progressCurrent
        : input.progressCurrent,
    progressTotal:
      input.progressTotal === undefined
        ? existing.progressTotal
        : input.progressTotal,
    progressUnit,
    serverVersion: {
      increment: 1,
    },
    syncStatus: WorkSyncStatus.synced,
  };
}

export function buildSyncedUserReleaseRecordBaseData(
  input: UpsertUserReleaseRecordDto,
): Pick<
  Prisma.UserReleaseRecordUncheckedCreateInput,
  'favorite' | 'rating' | 'review' | 'shortReview' | 'status' | 'syncStatus'
> {
  return {
    favorite: input.favorite ?? false,
    rating: input.rating ?? null,
    review: normalizeString(input.review),
    shortReview: normalizeString(input.shortReview),
    status: input.status ?? WorkStatus.planned,
    syncStatus: WorkSyncStatus.synced,
  };
}

export function buildCreateUserRecordData({
  catalogWorkId,
  input,
  personalTags,
  recordId,
  userId,
}: {
  catalogWorkId: string;
  input: CreateUserRecordDto;
  personalTags: string[];
  recordId: string;
  userId: string;
}): Prisma.UserWorkRecordUncheckedCreateInput {
  return {
    catalogTitleId: input.catalogTitleId ?? recordId,
    catalogWorkId,
    favorite: input.favorite ?? false,
    id: recordId,
    rating: input.rating ?? null,
    review: normalizeString(input.review),
    personalTags,
    startedAt: parseOptionalUserRecordDtoDate(input.startedAt, 'startedAt'),
    completedAt: parseOptionalUserRecordDtoDate(
      input.completedAt,
      'completedAt',
    ),
    droppedAt: parseOptionalUserRecordDtoDate(input.droppedAt, 'droppedAt'),
    lastConsumedAt: parseOptionalUserRecordDtoDate(
      input.lastConsumedAt,
      'lastConsumedAt',
    ),
    serverVersion: 1,
    shortReview: normalizeString(input.shortReview),
    status: input.status ?? WorkStatus.planned,
    syncStatus: WorkSyncStatus.synced,
    userId,
  };
}

export function buildCatalogTitleInputFromImport(
  input: CreateUserRecordFromImportDto,
): CatalogTitleImportInput {
  const titleInput: CatalogTitleImportInput = {
    canonicalTitle: input.catalogTitle,
    displayTitle: input.catalogTitle,
    mediumType: input.mediumType,
  };

  if (input.contributors !== undefined) {
    titleInput.contributorNames = input.contributors.map(
      (contributor) => contributor.name,
    );
  }

  if (input.externalRefs !== undefined) {
    titleInput.externalRefs = input.externalRefs;
  }

  if (input.releaseCandidates !== undefined) {
    titleInput.releaseCandidates = input.releaseCandidates;
  }

  if (input.franchiseName !== undefined) {
    titleInput.franchiseName = input.franchiseName;
  }

  if (input.releaseYear !== undefined) {
    titleInput.releaseYear = input.releaseYear;
  }

  if (input.subType !== undefined) {
    titleInput.subType = input.subType;
  }

  if (input.description !== undefined) {
    titleInput.summary = input.description;
  }

  if (input.thumbnailUrl !== undefined) {
    titleInput.thumbnailUrl = input.thumbnailUrl;
  }

  return titleInput;
}

export function buildUserRecordInputFromImport(
  input: CreateUserRecordFromImportDto,
  catalogTitleId: string,
): CreateUserRecordDto {
  const recordInput: CreateUserRecordDto = {
    catalogTitleId,
    title: input.title || input.catalogTitle,
    type: input.mediumType,
  };
  const author =
    input.author ||
    input.contributors?.map((contributor) => contributor.name).join(', ');

  if (author !== undefined) {
    recordInput.author = author;
  }

  if (input.description !== undefined) {
    recordInput.description = input.description;
  }

  if (input.thumbnailUrl !== undefined) {
    recordInput.thumbnailUrl = input.thumbnailUrl;
  }

  if (input.genres !== undefined) {
    recordInput.genres = input.genres;
  }

  if (input.status !== undefined) {
    recordInput.status = input.status;
  }

  if (input.rating !== undefined) {
    recordInput.rating = input.rating;
  }

  if (input.shortReview !== undefined) {
    recordInput.shortReview = input.shortReview;
  }

  if (input.review !== undefined) {
    recordInput.review = input.review;
  }

  if (input.favorite !== undefined) {
    recordInput.favorite = input.favorite;
  }

  if (input.personalTags !== undefined) {
    recordInput.personalTags = input.personalTags;
  }

  return recordInput;
}
