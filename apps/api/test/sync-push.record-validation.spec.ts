import { TimelineEntryType, WorkStatus, WorkType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { SyncReleaseRecordPayloadDto } from '../src/modules/sync/payloads/sync-release-record-payload.dto';
import type { SyncTimelineEntryPayloadDto } from '../src/modules/sync/payloads/sync-timeline-entry-payload.dto';
import {
  validateReleaseRecordTarget,
  validateTimelineEntryTarget,
} from '../src/modules/sync/services/sync-push.record-validation';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';
const OTHER_USER_ID = 'fcaf0c1d-ac54-422d-a222-b29ff0940d2e';
const WORK_ID = '9fcbf92f-6347-4d79-bdf8-9d0d18439c28';
const CATALOG_TITLE_ID = 'f034e861-af25-4ab1-860f-dd45dcabf5a5';
const CATALOG_RELEASE_ID = '5f7ac03a-0679-4e63-a62d-0d04b5e72a23';

type RecordValidationDependencies = Parameters<
  typeof validateTimelineEntryTarget
>[3];
type RecordValidationClient = Parameters<typeof validateReleaseRecordTarget>[2];

const findById = jest.fn<(_id: string, _client?: unknown) => Promise<unknown>>();
const catalogReleaseFindFirst = jest.fn<(_args: unknown) => Promise<unknown>>();

const dependencies = {
  userRecordsService: { findById },
} as unknown as RecordValidationDependencies;

const client = {
  catalogRelease: { findFirst: catalogReleaseFindFirst },
} as unknown as RecordValidationClient;

function buildReleasePayload(
  overrides: Partial<SyncReleaseRecordPayloadDto> = {},
): SyncReleaseRecordPayloadDto {
  return {
    id: '7fb84ae9-6821-4d68-bb89-2f51f0dd9e11',
    userWorkRecordId: WORK_ID,
    catalogReleaseId: CATALOG_RELEASE_ID,
    status: WorkStatus.completed,
    rating: 4.5,
    shortReview: 'Volume 1 review',
    review: '',
    favorite: false,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T01:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

function buildTimelinePayload(
  overrides: Partial<SyncTimelineEntryPayloadDto> = {},
): SyncTimelineEntryPayloadDto {
  return {
    id: '169626cc-e8db-4e67-bb21-c1a7609e5ebc',
    workId: WORK_ID,
    type: TimelineEntryType.note,
    occurredAt: '2026-04-18T02:00:00.000Z',
    note: 'Manual note',
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T02:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

function buildParentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: WORK_ID,
    userId: USER_ID,
    catalogTitleId: CATALOG_TITLE_ID,
    catalogWork: {
      type: WorkType.light_novel,
    },
    catalogTitle: {
      mediumType: WorkType.light_novel,
    },
    ...overrides,
  };
}

describe('sync push record validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateTimelineEntryTarget', () => {
    it('rejects timeline entries when the parent work is unavailable', async () => {
      for (const parent of [
        null,
        buildParentRecord({
          userId: OTHER_USER_ID,
        }),
      ]) {
        findById.mockResolvedValueOnce(parent);

        await expect(
          validateTimelineEntryTarget(
            USER_ID,
            buildTimelinePayload(),
            client,
            dependencies,
          ),
        ).resolves.toBe(
          'Timeline entry parent is missing or belongs to a different user.',
        );
      }
    });

    it('accepts timeline entries with an owned parent work', async () => {
      findById.mockResolvedValue(buildParentRecord());

      await expect(
        validateTimelineEntryTarget(
          USER_ID,
          buildTimelinePayload(),
          client,
          dependencies,
        ),
      ).resolves.toBeNull();

      expect(findById).toHaveBeenCalledWith(WORK_ID, client);
    });
  });

  describe('validateReleaseRecordTarget', () => {
    it('rejects release records when the parent work is unavailable', async () => {
      for (const parent of [
        null,
        buildParentRecord({
          userId: OTHER_USER_ID,
        }),
      ]) {
        findById.mockResolvedValueOnce(parent);

        await expect(
          validateReleaseRecordTarget(
            USER_ID,
            buildReleasePayload(),
            client,
            dependencies,
          ),
        ).resolves.toBe(
          'Release record parent is missing or belongs to a different user.',
        );
      }

      expect(catalogReleaseFindFirst).not.toHaveBeenCalled();
      expect(findById).toHaveBeenCalledWith(WORK_ID, client);
    });

    it('rejects release records for media without release-level records', async () => {
      findById.mockResolvedValue(
        buildParentRecord({
          catalogWork: {
            type: WorkType.anime,
          },
          catalogTitle: null,
        }),
      );

      await expect(
        validateReleaseRecordTarget(
          USER_ID,
          buildReleasePayload(),
          client,
          dependencies,
        ),
      ).resolves.toBe(
        'Release-level records are not supported for medium type "anime".',
      );

      expect(catalogReleaseFindFirst).not.toHaveBeenCalled();
    });

    it('requires a catalog title bridge for release records', async () => {
      findById.mockResolvedValue(
        buildParentRecord({
          catalogTitleId: null,
        }),
      );

      await expect(
        validateReleaseRecordTarget(
          USER_ID,
          buildReleasePayload(),
          client,
          dependencies,
        ),
      ).resolves.toBe('Release-level records require a catalog title bridge.');

      expect(catalogReleaseFindFirst).not.toHaveBeenCalled();
    });

    it('rejects releases that do not belong to the parent catalog title', async () => {
      findById.mockResolvedValue(buildParentRecord());
      catalogReleaseFindFirst.mockResolvedValue(null);

      await expect(
        validateReleaseRecordTarget(
          USER_ID,
          buildReleasePayload(),
          client,
          dependencies,
        ),
      ).resolves.toBe(
        'Catalog release does not belong to the parent catalog title.',
      );

      expect(catalogReleaseFindFirst).toHaveBeenCalledWith({
        where: {
          id: CATALOG_RELEASE_ID,
          catalogTitleId: CATALOG_TITLE_ID,
        },
      });
    });

    it('accepts release records with an owned parent and matching release', async () => {
      findById.mockResolvedValue(buildParentRecord());
      catalogReleaseFindFirst.mockResolvedValue({
        id: CATALOG_RELEASE_ID,
        catalogTitleId: CATALOG_TITLE_ID,
      });

      await expect(
        validateReleaseRecordTarget(
          USER_ID,
          buildReleasePayload(),
          client,
          dependencies,
        ),
      ).resolves.toBeNull();
    });
  });
});
