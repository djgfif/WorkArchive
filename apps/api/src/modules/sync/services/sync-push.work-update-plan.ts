import type { Prisma } from '@prisma/client';

import type { WorkAggregate } from '../../user-records/user-records.service';
import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';
import { getAppliedMutationResult } from './sync-push.shared';
import {
  buildCatalogUpdateData,
  buildUserRecordUpdateData,
} from './sync-push.data-builders';

type AppliedMutationResult = ReturnType<typeof getAppliedMutationResult>;

export interface ExistingWorkUpdatePlan {
  catalogUpdateData: Prisma.CatalogWorkUpdateInput;
  catalogWorkId: string;
  resultCode: AppliedMutationResult['code'];
  resultMessage: AppliedMutationResult['message'];
  userRecordId: string;
  userRecordUpdateData: Prisma.UserWorkRecordUpdateInput;
}

export function buildExistingWorkUpdatePlan(
  existing: WorkAggregate,
  payload: SyncWorkPayloadDto,
): ExistingWorkUpdatePlan {
  const appliedResult = getAppliedMutationResult(payload.deletedAt);

  return {
    catalogUpdateData: buildCatalogUpdateData(payload),
    catalogWorkId: existing.catalogWorkId,
    resultCode: appliedResult.code,
    resultMessage: appliedResult.message,
    userRecordId: existing.id,
    userRecordUpdateData: buildUserRecordUpdateData(payload),
  };
}
