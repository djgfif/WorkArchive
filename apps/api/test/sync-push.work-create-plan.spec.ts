import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import type { SyncWorkPayloadDto } from '../src/modules/sync/payloads/sync-work-payload.dto';
import { buildMissingWorkCreatePlan } from '../src/modules/sync/services/sync-push.work-create-plan';
import type { SyncCreateTitleView } from '../src/modules/sync/services/sync-push.shared';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';
const WORK_ID = '9fcbf92f-6347-4d79-bdf8-9d0d18439c28';
const CATALOG_TITLE_ID = '4fb2a50f-2807-46a2-af4f-f9709afe0a8e';

function buildPayload(
  overrides: Partial<SyncWorkPayloadDto> = {},
): SyncWorkPayloadDto {
  return {
    id: WORK_ID,
    type: WorkType.novel,
    title: '  Dune  ',
    author: '',
    genres: ['판타지', '회귀'],
    personalTags: ['완독'],
    description: '',
    thumbnailUrl: '',
    status: WorkStatus.completed,
    rating: 5,
    shortReview: '',
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

function buildCatalogTitle(
  overrides: Partial<SyncCreateTitleView> = {},
): SyncCreateTitleView {
  return {
    id: CATALOG_TITLE_ID,
    mediumType: WorkType.novel,
    displayTitle: 'Dune',
    summary: 'A desert saga.',
    thumbnailUrl: 'https://image.example/dune.jpg',
    contributors: [
      {
        contributor: {
          displayName: 'Frank Herbert',
        },
      },
    ],
    ...overrides,
  } as SyncCreateTitleView;
}

describe('buildMissingWorkCreatePlan', () => {
  it('builds an existing catalog title compatibility create plan', () => {
    const result = buildMissingWorkCreatePlan(
      USER_ID,
      buildPayload({
        catalogTitleId: CATALOG_TITLE_ID,
        author: '',
        description: '',
        thumbnailUrl: '',
      }),
      buildCatalogTitle(),
    );

    expect(result.status).toBe('ready');

    if (result.status !== 'ready') {
      throw new Error('expected a ready create plan');
    }

    expect(result.plan).toEqual(
      expect.objectContaining({
        source: 'existing-catalog-title',
        compatibilityCatalogWorkCreateData: expect.objectContaining({
          author: 'Frank Herbert',
          description: 'A desert saga.',
          id: WORK_ID,
          thumbnailUrl: 'https://image.example/dune.jpg',
          title: 'Dune',
        }),
        userRecordCreateData: expect.objectContaining({
          catalogTitleId: CATALOG_TITLE_ID,
          catalogWorkId: WORK_ID,
          personalTags: ['완독', '회귀'],
          syncStatus: WorkSyncStatus.synced,
          userId: USER_ID,
        }),
      }),
    );
  });

  it('fails when a referenced catalog title is missing', () => {
    const result = buildMissingWorkCreatePlan(
      USER_ID,
      buildPayload({
        catalogTitleId: CATALOG_TITLE_ID,
      }),
      null,
    );

    expect(result).toEqual({
      status: 'failed',
      code: 'failed_missing_catalog_title',
      message: `Catalog title with id "${CATALOG_TITLE_ID}" was not found.`,
    });
  });

  it('builds an import draft create plan and defers user record catalog title assignment', () => {
    const result = buildMissingWorkCreatePlan(
      USER_ID,
      buildPayload({
        importDraft: {
          catalogTitle: ' Dune ',
          mediumType: WorkType.novel,
          contributors: [{ name: ' Frank Herbert ' }],
          externalRefs: [
            {
              provider: ' aladin ',
              externalId: ' 123 ',
              rawType: ' novel ',
            },
          ],
        },
      }),
      null,
    );

    expect(result.status).toBe('ready');

    if (result.status !== 'ready') {
      throw new Error('expected a ready create plan');
    }

    expect(result.plan.source).toBe('import-draft');

    if (result.plan.source !== 'import-draft') {
      throw new Error('expected an import draft plan');
    }

    expect(result.plan.importTitleCreateData).toEqual(
      expect.objectContaining({
        canonicalTitle: 'Dune',
        contributorNames: ['Frank Herbert'],
        displayTitle: 'Dune',
        mediumType: WorkType.novel,
      }),
    );
    expect(result.plan.importTitleCreateData.externalRefs).toEqual([
      {
        externalId: '123',
        provider: 'aladin',
        rawType: 'novel',
      },
    ]);
    expect(
      result.plan.buildUserRecordCreateData(CATALOG_TITLE_ID),
    ).toEqual(
      expect.objectContaining({
        catalogTitleId: CATALOG_TITLE_ID,
        catalogWorkId: WORK_ID,
        userId: USER_ID,
      }),
    );
  });

  it('fails when import draft title resolution has no catalog title or payload title', () => {
    const result = buildMissingWorkCreatePlan(
      USER_ID,
      buildPayload({
        title: '   ',
        importDraft: {
          catalogTitle: '   ',
          mediumType: WorkType.novel,
        },
      }),
      null,
    );

    expect(result).toEqual({
      status: 'failed',
      code: 'failed_import_draft_unresolved',
      message:
        'Catalog title could not be resolved from importDraft.catalogTitle or payload.title.',
    });
  });

  it('builds the legacy flat create plan when no catalog identity is present', () => {
    const result = buildMissingWorkCreatePlan(USER_ID, buildPayload(), null);

    expect(result.status).toBe('ready');

    if (result.status !== 'ready') {
      throw new Error('expected a ready create plan');
    }

    expect(result.plan).toEqual(
      expect.objectContaining({
        source: 'legacy-flat',
        catalogCreateData: expect.objectContaining({
          genres: ['판타지'],
          id: WORK_ID,
          title: 'Dune',
        }),
        userRecordCreateData: expect.objectContaining({
          catalogTitleId: WORK_ID,
          catalogWorkId: WORK_ID,
          personalTags: ['완독', '회귀'],
          serverVersion: 1,
        }),
      }),
    );
  });
});
