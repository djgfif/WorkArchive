import { ProgressUnit, WorkStatus, WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import type { SyncWorkPayloadDto } from '../src/modules/sync/payloads/sync-work-payload.dto';
import { validateWorkProgressPayload } from '../src/modules/sync/services/sync-push.work-validation';

function buildPayload(
  overrides: Partial<SyncWorkPayloadDto> = {},
): SyncWorkPayloadDto {
  return {
    id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    type: WorkType.anime,
    title: 'Episode Work',
    author: '',
    genres: [],
    personalTags: [],
    description: '',
    thumbnailUrl: '',
    status: WorkStatus.in_progress,
    rating: null,
    shortReview: '',
    review: '',
    favorite: false,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T01:00:00.000Z',
    deletedAt: null,
    syncStatus: 'pending',
    serverVersion: 1,
    ...overrides,
  };
}

describe('validateWorkProgressPayload', () => {
  it('accepts matching progress units and bounded progress counts', () => {
    expect(
      validateWorkProgressPayload(
        buildPayload({
          progressCurrent: 3,
          progressTotal: 12,
          progressUnit: ProgressUnit.episode,
        }),
      ),
    ).toBeNull();
  });

  it('rejects progress units that the medium type cannot use', () => {
    expect(
      validateWorkProgressPayload(
        buildPayload({
          progressUnit: ProgressUnit.volume,
        }),
      ),
    ).toBe(
      'Progress unit "volume" is not supported for medium type "anime".',
    );
  });

  it('rejects progressCurrent values above progressTotal', () => {
    expect(
      validateWorkProgressPayload(
        buildPayload({
          progressCurrent: 13,
          progressTotal: 12,
          progressUnit: ProgressUnit.episode,
        }),
      ),
    ).toBe('progressCurrent cannot exceed progressTotal.');
  });

  it('allows partial progress counts when one side is omitted', () => {
    expect(
      validateWorkProgressPayload(
        buildPayload({
          progressCurrent: 13,
          progressTotal: null,
          progressUnit: ProgressUnit.episode,
        }),
      ),
    ).toBeNull();
  });
});
