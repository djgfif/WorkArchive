import type { Prisma } from '@prisma/client';

import type { CreateWorkDto } from './dto/create-work.dto';
import type { UpdateWorkDto } from './dto/update-work.dto';
import {
  hasChanges,
  normalizeGenresAndPersonalTags,
} from './work-aggregate';
import {
  buildCatalogCreateData,
  buildCatalogUpdateData,
  buildUserRecordCreateData,
  buildUserRecordUpdateData,
  DEFAULT_SYNC_STATUS,
} from './work-compatibility-data';
import type { WorkAggregate } from '../user-records/user-records.service';

export {
  buildCatalogCreateData,
  buildCatalogUpdateData,
  buildUserRecordCreateData,
  buildUserRecordUpdateData,
  parseOptionalDtoDate,
} from './work-compatibility-data';

export function buildWorkCreateCompatibilityPlan(
  userId: string,
  workId: string,
  createWorkDto: CreateWorkDto,
) {
  const normalizedTaxonomy = normalizeGenresAndPersonalTags(
    createWorkDto.genres,
    createWorkDto.personalTags,
  );

  return {
    catalogCreateData: buildCatalogCreateData(
      createWorkDto,
      normalizedTaxonomy.genres,
    ),
    userRecordCreateData: buildUserRecordCreateData(
      userId,
      workId,
      createWorkDto,
      normalizedTaxonomy.personalTags,
    ),
  };
}

export function buildWorkUpdateCompatibilityPlan(
  existingWork: WorkAggregate,
  updateWorkDto: UpdateWorkDto,
) {
  const normalizedTaxonomy =
    updateWorkDto.genres !== undefined ||
    updateWorkDto.personalTags !== undefined
      ? normalizeGenresAndPersonalTags(
          updateWorkDto.genres ?? existingWork.catalogWork.genres,
          updateWorkDto.personalTags ?? existingWork.personalTags,
        )
      : null;
  const catalogUpdateData = buildCatalogUpdateData(
    updateWorkDto,
    normalizedTaxonomy?.genres,
  );
  const userRecordUpdateData = buildUserRecordUpdateData(
    updateWorkDto,
    normalizedTaxonomy?.personalTags,
  );

  return {
    catalogUpdateData,
    hasCatalogChanges: hasChanges(catalogUpdateData),
    hasUserRecordChanges: hasChanges(userRecordUpdateData),
    userRecordUpdateData,
  };
}

export function withSyncedRecordMutationVersion<
  TData extends Prisma.UserWorkRecordUpdateManyMutationInput,
>(data: TData): TData & {
  serverVersion: {
    increment: 1;
  };
  syncStatus: typeof DEFAULT_SYNC_STATUS;
} {
  return {
    ...data,
    syncStatus: DEFAULT_SYNC_STATUS,
    serverVersion: {
      increment: 1,
    },
  };
}
