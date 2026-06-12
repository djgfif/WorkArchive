import type { WorkType } from '@prisma/client';

import { canUseProgressUnit } from '../../recording/recording-policy';
import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';

export function validateWorkProgressPayload(payload: SyncWorkPayloadDto) {
  if (payload.progressUnit !== null && payload.progressUnit !== undefined) {
    const type = payload.type as WorkType;

    if (!canUseProgressUnit(type, payload.progressUnit)) {
      return `Progress unit "${payload.progressUnit}" is not supported for medium type "${payload.type}".`;
    }
  }

  if (
    payload.progressCurrent !== null &&
    payload.progressCurrent !== undefined &&
    payload.progressTotal !== null &&
    payload.progressTotal !== undefined &&
    payload.progressCurrent > payload.progressTotal
  ) {
    return 'progressCurrent cannot exceed progressTotal.';
  }

  return null;
}
