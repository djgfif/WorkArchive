import { normalizeGenresAndPersonalTags } from '../../works/work-aggregate';
import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';
import { parseIsoDate } from './sync-service-utils';

export { parseIsoDate };

export function parseOptionalIsoDate(value: string | null, fieldName: string) {
  if (value === null) {
    return null;
  }

  return parseIsoDate(value, fieldName);
}

export function normalizeWorkPayloadTaxonomy(payload: SyncWorkPayloadDto) {
  return normalizeGenresAndPersonalTags(payload.genres, payload.personalTags);
}
