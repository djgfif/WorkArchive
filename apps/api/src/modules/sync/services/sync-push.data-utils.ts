import { BadRequestException } from '@nestjs/common';

import { normalizeGenresAndPersonalTags } from '../../works/work-aggregate';
import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';

export function parseIsoDate(value: string, fieldName: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(
      `${fieldName} must be a valid ISO 8601 date string.`,
    );
  }

  return parsed;
}

export function parseOptionalIsoDate(value: string | null, fieldName: string) {
  if (value === null) {
    return null;
  }

  return parseIsoDate(value, fieldName);
}

export function normalizeWorkPayloadTaxonomy(payload: SyncWorkPayloadDto) {
  return normalizeGenresAndPersonalTags(payload.genres, payload.personalTags);
}
