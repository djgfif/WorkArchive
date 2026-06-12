import type { Prisma } from '@prisma/client';

import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';
import type { SyncCreateTitleView } from './sync-push.shared';
import { SYNC_CODES } from './sync-push.shared';
import {
  buildCatalogCreateData,
  buildCompatibilityCatalogWorkCreateData,
  buildImportTitleCreateData,
  buildUserRecordCreateData,
  resolveImportDraftCatalogTitle,
} from './sync-push.data-builders';

type MissingWorkCreateFailureCode =
  | typeof SYNC_CODES.failedImportDraftUnresolved
  | typeof SYNC_CODES.failedMissingCatalogTitle;

interface MissingWorkCreateFailure {
  status: 'failed';
  code: MissingWorkCreateFailureCode;
  message: string;
}

interface ExistingCatalogTitleCreatePlan {
  source: 'existing-catalog-title';
  compatibilityCatalogWorkCreateData: Prisma.CatalogWorkUncheckedCreateInput;
  userRecordCreateData: Prisma.UserWorkRecordUncheckedCreateInput;
}

interface ImportDraftCreatePlan {
  source: 'import-draft';
  compatibilityCatalogWorkCreateData: Prisma.CatalogWorkUncheckedCreateInput;
  importTitleCreateData: ReturnType<typeof buildImportTitleCreateData>;
  buildUserRecordCreateData: (
    catalogTitleId: string,
  ) => Prisma.UserWorkRecordUncheckedCreateInput;
}

interface LegacyFlatCreatePlan {
  source: 'legacy-flat';
  catalogCreateData: Prisma.CatalogWorkUncheckedCreateInput;
  userRecordCreateData: Prisma.UserWorkRecordUncheckedCreateInput;
}

export type MissingWorkCreatePlan =
  | ExistingCatalogTitleCreatePlan
  | ImportDraftCreatePlan
  | LegacyFlatCreatePlan;

export type MissingWorkCreatePlanResult =
  | MissingWorkCreateFailure
  | {
      plan: MissingWorkCreatePlan;
      status: 'ready';
    };

export function buildMissingWorkCreatePlan(
  userId: string,
  payload: SyncWorkPayloadDto,
  existingTitle: SyncCreateTitleView | null,
): MissingWorkCreatePlanResult {
  const importDraftCatalogTitle = payload.importDraft
    ? resolveImportDraftCatalogTitle(payload)
    : null;

  if (payload.catalogTitleId && !existingTitle) {
    return {
      status: 'failed',
      code: SYNC_CODES.failedMissingCatalogTitle,
      message: `Catalog title with id "${payload.catalogTitleId}" was not found.`,
    };
  }

  if (payload.importDraft && !importDraftCatalogTitle) {
    return {
      status: 'failed',
      code: SYNC_CODES.failedImportDraftUnresolved,
      message:
        'Catalog title could not be resolved from importDraft.catalogTitle or payload.title.',
    };
  }

  if (existingTitle) {
    return {
      status: 'ready',
      plan: {
        source: 'existing-catalog-title',
        compatibilityCatalogWorkCreateData:
          buildCompatibilityCatalogWorkCreateData(payload, existingTitle),
        userRecordCreateData: buildUserRecordCreateData(
          userId,
          payload,
          existingTitle.id,
        ),
      },
    };
  }

  if (payload.importDraft) {
    return {
      status: 'ready',
      plan: {
        source: 'import-draft',
        compatibilityCatalogWorkCreateData:
          buildCompatibilityCatalogWorkCreateData(payload),
        importTitleCreateData: buildImportTitleCreateData(
          payload,
          importDraftCatalogTitle!,
        ),
        buildUserRecordCreateData: (catalogTitleId) =>
          buildUserRecordCreateData(userId, payload, catalogTitleId),
      },
    };
  }

  return {
    status: 'ready',
    plan: {
      source: 'legacy-flat',
      catalogCreateData: buildCatalogCreateData(payload),
      userRecordCreateData: buildUserRecordCreateData(userId, payload),
    },
  };
}
