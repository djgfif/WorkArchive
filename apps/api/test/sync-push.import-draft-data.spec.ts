import { describe, expect, it } from '@jest/globals';
import { WorkStatus, WorkType } from '@prisma/client';

import type { SyncWorkPayloadDto } from '../src/modules/sync/payloads/sync-work-payload.dto';
import {
  buildCatalogExternalRefInput,
  buildCatalogReleaseCandidateInput,
  buildImportTitleCreateData,
  resolveImportDraftCatalogTitle,
} from '../src/modules/sync/services/sync-push.import-draft-data';

function buildPayload(
  overrides: Partial<SyncWorkPayloadDto> = {},
): SyncWorkPayloadDto {
  return {
    id: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    type: WorkType.novel,
    title: ' Payload Title ',
    author: '',
    genres: [],
    personalTags: [],
    description: ' Summary ',
    thumbnailUrl: ' https://example.com/cover.jpg ',
    status: WorkStatus.planned,
    rating: null,
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

describe('sync push import draft data builders', () => {
  it('resolves the import draft catalog title before falling back to payload title', () => {
    expect(
      resolveImportDraftCatalogTitle(
        buildPayload({
          importDraft: {
            catalogTitle: ' Draft Title ',
            mediumType: WorkType.novel,
          },
        }),
      ),
    ).toBe('Draft Title');
    expect(
      resolveImportDraftCatalogTitle(
        buildPayload({
          importDraft: {
            catalogTitle: '   ',
            mediumType: WorkType.novel,
          },
        }),
      ),
    ).toBe('Payload Title');
    expect(
      resolveImportDraftCatalogTitle(
        buildPayload({
          title: '   ',
          importDraft: {
            catalogTitle: '   ',
            mediumType: WorkType.novel,
          },
        }),
      ),
    ).toBeNull();
  });

  it('trims external references and omits blank optional fields', () => {
    expect(
      buildCatalogExternalRefInput({
        externalId: ' 123 ',
        provider: ' aladin ',
        rawType: '  ',
        url: ' https://example.com/item ',
      }),
    ).toEqual({
      externalId: '123',
      provider: 'aladin',
      url: 'https://example.com/item',
    });
  });

  it('builds release candidates with trimmed optional fields and nested refs', () => {
    expect(
      buildCatalogReleaseCandidateInput({
        displayLabel: ' 1권 ',
        externalRefs: [
          {
            externalId: ' abc ',
            provider: ' open_library ',
            rawType: ' edition ',
          },
        ],
        isbn: ' 9780000000000 ',
        releaseDate: '2026-04-18',
        releaseType: ' volume ',
        sequence: 1,
        thumbnailUrl: '  ',
        title: ' Dune 1 ',
      }),
    ).toEqual({
      displayLabel: '1권',
      externalRefs: [
        {
          externalId: 'abc',
          provider: 'open_library',
          rawType: 'edition',
        },
      ],
      isbn: '9780000000000',
      releaseDate: '2026-04-18',
      releaseType: 'volume',
      sequence: 1,
      title: 'Dune 1',
    });
  });

  it('builds catalog title input from import draft metadata', () => {
    expect(
      buildImportTitleCreateData(
        buildPayload({
          importDraft: {
            catalogTitle: ' Dune ',
            contributors: [{ name: ' Frank Herbert ' }],
            externalRefs: [
              {
                externalId: ' 123 ',
                provider: ' aladin ',
              },
            ],
            franchiseName: ' Dune ',
            mediumType: WorkType.novel,
            releaseCandidates: [
              {
                displayLabel: ' 1권 ',
                title: ' Dune 1 ',
              },
            ],
            releaseYear: 1965,
            subType: ' classic ',
          },
        }),
        'Dune',
      ),
    ).toEqual({
      canonicalTitle: 'Dune',
      contributorNames: ['Frank Herbert'],
      displayTitle: 'Dune',
      externalRefs: [
        {
          externalId: '123',
          provider: 'aladin',
        },
      ],
      franchiseName: 'Dune',
      mediumType: WorkType.novel,
      releaseCandidates: [
        {
          displayLabel: '1권',
          isbn: null,
          releaseDate: null,
          sequence: null,
          title: 'Dune 1',
        },
      ],
      releaseYear: 1965,
      subType: 'classic',
      summary: 'Summary',
      thumbnailUrl: 'https://example.com/cover.jpg',
    });
  });
});
