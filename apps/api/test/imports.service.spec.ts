import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { WorkType } from '@prisma/client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { ExternalApiKeyCryptoService } from '../src/modules/imports/external-api-key-crypto.service';
import { ImportsCredentialService } from '../src/modules/imports/imports-credential.service';
import {
  ALADIN_PROVIDER,
  ANILIST_PROVIDER,
  GOOGLE_BOOKS_PROVIDER,
  KOBIS_PROVIDER,
  MANUAL_PROVIDER,
  NAVER_BOOK_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
  TMDB_PROVIDER,
} from '../src/modules/imports/imports.constants';
import { ImportsService } from '../src/modules/imports/imports.service';
import type { CatalogIngestionService } from '../src/modules/catalog/catalog-ingestion.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';

interface StoredCredential {
  authTag: string;
  encryptedKey: string;
  id: string;
  iv: string;
  provider: string;
  userId: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function createCredentialPrismaMock() {
  const records: StoredCredential[] = [];
  const externalApiCredential = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  };

  externalApiCredential.findUnique.mockImplementation(
    async (input: unknown) => {
      const { where } = input as {
        where: {
          userId_provider: {
            provider: string;
            userId: string;
          };
        };
      };

      return (
        records.find(
          (record) =>
            record.userId === where.userId_provider.userId &&
            record.provider === where.userId_provider.provider,
        ) ?? null
      );
    },
  );
  externalApiCredential.upsert.mockImplementation(async (input: unknown) => {
    const { create, update, where } = input as {
      create: Omit<StoredCredential, 'id'>;
      update: Pick<StoredCredential, 'authTag' | 'encryptedKey' | 'iv'>;
      where: {
        userId_provider: {
          provider: string;
          userId: string;
        };
      };
    };
    const existingIndex = records.findIndex(
      (record) =>
        record.userId === where.userId_provider.userId &&
        record.provider === where.userId_provider.provider,
    );

    if (existingIndex >= 0) {
      records[existingIndex] = {
        ...records[existingIndex]!,
        ...update,
      };

      return records[existingIndex];
    }

    const record = {
      id: crypto.randomUUID(),
      ...create,
    };

    records.push(record);

    return record;
  });
  externalApiCredential.deleteMany.mockImplementation(
    async (input: unknown) => {
      const { where } = input as {
        where: {
          provider: string;
          userId: string;
        };
      };
      const nextRecords = records.filter(
        (record) =>
          record.userId !== where.userId || record.provider !== where.provider,
      );
      const deletedCount = records.length - nextRecords.length;

      records.splice(0, records.length, ...nextRecords);

      return {
        count: deletedCount,
      };
    },
  );

  return {
    prisma: {
      externalApiCredential,
    } as unknown as PrismaService,
    records,
  };
}

describe('ExternalApiKeyCryptoService', () => {
  beforeEach(() => {
    process.env.EXTERNAL_API_KEY_ENCRYPTION_SECRET =
      'test-external-api-key-encryption-secret';
  });

  afterEach(() => {
    delete process.env.EXTERNAL_API_KEY_ENCRYPTION_SECRET;
  });

  it('encrypts and decrypts provider keys without exposing the raw key', () => {
    const service = new ExternalApiKeyCryptoService();
    const encrypted = service.encrypt('ttb-test-key');

    expect(encrypted.encryptedKey).not.toBe('ttb-test-key');
    expect(encrypted.iv).toEqual(expect.any(String));
    expect(encrypted.authTag).toEqual(expect.any(String));
    expect(service.decrypt(encrypted)).toBe('ttb-test-key');
  });

  it('fails clearly when the encryption secret is missing', () => {
    delete process.env.EXTERNAL_API_KEY_ENCRYPTION_SECRET;

    expect(() =>
      new ExternalApiKeyCryptoService().encrypt('ttb-test-key'),
    ).toThrow('EXTERNAL_API_KEY_ENCRYPTION_SECRET');
  });
});

describe('ImportsCredentialService', () => {
  beforeEach(() => {
    process.env.EXTERNAL_API_KEY_ENCRYPTION_SECRET =
      'test-external-api-key-encryption-secret';
  });

  afterEach(() => {
    delete process.env.EXTERNAL_API_KEY_ENCRYPTION_SECRET;
  });

  it('saves, decrypts, and deletes user-scoped provider credentials', async () => {
    const { prisma, records } = createCredentialPrismaMock();
    const service = new ImportsCredentialService(
      prisma,
      new ExternalApiKeyCryptoService(),
    );

    await service.saveCredential(USER_ID, ALADIN_PROVIDER, 'ttb-test-key');

    expect(records).toHaveLength(1);
    expect(records[0]?.encryptedKey).not.toBe('ttb-test-key');
    await expect(
      service.getDecryptedCredential(USER_ID, ALADIN_PROVIDER),
    ).resolves.toBe('ttb-test-key');
    await expect(service.hasCredential(USER_ID, ALADIN_PROVIDER)).resolves.toBe(
      true,
    );

    await service.deleteCredential(USER_ID, ALADIN_PROVIDER);

    expect(records).toHaveLength(0);
    await expect(
      service.getDecryptedCredential(USER_ID, ALADIN_PROVIDER),
    ).resolves.toBeNull();
  });
});

describe('ImportsService', () => {
  let credentialService: jest.Mocked<
    Pick<
      ImportsCredentialService,
      | 'deleteCredential'
      | 'getDecryptedCredential'
      | 'hasCredential'
      | 'saveCredential'
    >
  >;
  let service: ImportsService;

  beforeEach(() => {
    credentialService = {
      deleteCredential: jest.fn(),
      getDecryptedCredential: jest.fn(),
      hasCredential: jest.fn(),
      saveCredential: jest.fn(),
    };
    service = new ImportsService(
      credentialService as unknown as ImportsCredentialService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects blank searches before calling a provider', async () => {
    await expect(
      service.search(USER_ID, {
        query: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(credentialService.getDecryptedCredential).not.toHaveBeenCalled();
  });

  it('returns forbidden when the current user has no Aladin key', async () => {
    credentialService.getDecryptedCredential.mockResolvedValue(null);

    await expect(
      service.search(USER_ID, {
        provider: ALADIN_PROVIDER,
        query: 'Dune',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reports guest provider readiness without reading user credentials', async () => {
    const providers = await service.listProviders(null);

    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: MANUAL_PROVIDER,
          credentialMode: 'none',
          configured: true,
        }),
        expect.objectContaining({
          provider: OPEN_LIBRARY_PROVIDER,
          credentialMode: 'none',
          configured: true,
        }),
        expect.objectContaining({
          provider: ALADIN_PROVIDER,
          credentialMode: 'user',
          configured: false,
        }),
        expect.objectContaining({
          provider: TMDB_PROVIDER,
          credentialMode: 'server',
          configured: false,
        }),
      ]),
    );
    expect(credentialService.hasCredential).not.toHaveBeenCalled();
  });

  it('reports user-scoped provider readiness when a valid user is present', async () => {
    credentialService.hasCredential.mockResolvedValue(true);

    const providers = await service.listProviders(USER_ID);

    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: ALADIN_PROVIDER,
          credentialMode: 'user',
          configured: true,
        }),
        expect.objectContaining({
          provider: MANUAL_PROVIDER,
          credentialMode: 'none',
          configured: true,
        }),
      ]),
    );
    expect(credentialService.hasCredential).toHaveBeenCalledWith(
      USER_ID,
      ALADIN_PROVIDER,
    );
  });

  it('allows guest search for no-key providers without reading user credentials', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        docs: [
          {
            key: '/works/OL123W',
            title: 'Dune',
            author_name: ['Frank Herbert'],
            first_publish_year: 1965,
          },
        ],
      }),
    );

    const result = await service.search(null, {
      provider: OPEN_LIBRARY_PROVIDER,
      query: 'Dune',
      limit: 5,
      type: WorkType.novel,
    });

    expect(result).toEqual(
      expect.objectContaining({
        provider: OPEN_LIBRARY_PROVIDER,
        providers: [OPEN_LIBRARY_PROVIDER],
        query: 'Dune',
        candidates: [
          expect.objectContaining({
            id: 'open_library:/works/OL123W',
            sourceId: OPEN_LIBRARY_PROVIDER,
            title: 'Dune',
            existingRecord: null,
          }),
        ],
        diagnostics: {
          providers: [
            expect.objectContaining({
              provider: OPEN_LIBRARY_PROVIDER,
              status: 'searched',
              configured: true,
              resultCount: 1,
              reasonCode: null,
            }),
          ],
        },
      }),
    );
    expect(credentialService.getDecryptedCredential).not.toHaveBeenCalled();
  });

  it('records skipped diagnostics for guest automatic server providers', async () => {
    const result = await service.search(null, {
      query: 'Dune',
      type: WorkType.movie,
    });

    expect(result.providers).toEqual([MANUAL_PROVIDER]);
    expect(result.diagnostics.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: TMDB_PROVIDER,
          status: 'skipped',
          credentialMode: 'server',
          reasonCode: 'guest_provider_not_allowed',
        }),
        expect.objectContaining({
          provider: KOBIS_PROVIDER,
          status: 'skipped',
          credentialMode: 'server',
          reasonCode: 'guest_provider_not_allowed',
        }),
        expect.objectContaining({
          provider: MANUAL_PROVIDER,
          status: 'searched',
          reasonCode: null,
          resultCount: 1,
        }),
      ]),
    );
  });

  it('ranks an exact title match ahead of earlier provider-order candidates', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'google-dune-messiah',
              volumeInfo: {
                authors: ['Frank Herbert'],
                publishedDate: '1969',
                title: 'Dune Messiah',
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          docs: [
            {
              key: '/works/OL123W',
              title: 'Dune',
              author_name: ['Frank Herbert'],
              first_publish_year: 1965,
            },
          ],
        }),
      );

    const result = await service.search(null, {
      providers: [GOOGLE_BOOKS_PROVIDER, OPEN_LIBRARY_PROVIDER],
      query: 'Dune',
      limit: 2,
      type: WorkType.novel,
    });

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        sourceId: OPEN_LIBRARY_PROVIDER,
        title: 'Dune',
        confidenceLabel: '신뢰도 높음',
        reason: expect.stringContaining('제목 정확히 일치'),
      }),
    );
    expect(result.candidates[0]?.confidence).toBeGreaterThan(
      result.candidates[1]?.confidence ?? 0,
    );
  });

  it('uses multilingual title aliases when ranking candidates', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: {
          Page: {
            media: [
              {
                id: 9253,
                title: {
                  english: 'Steins;Gate',
                  native: 'シュタインズ・ゲート',
                  romaji: 'Steins;Gate',
                },
                format: 'TV',
                startDate: {
                  year: 2011,
                },
                coverImage: {
                  large: 'https://img.example.test/steins-gate.jpg',
                },
                studios: {
                  nodes: [
                    {
                      name: 'White Fox',
                    },
                  ],
                },
                staff: {
                  nodes: [],
                },
              },
            ],
          },
        },
      }),
    );

    const result = await service.search(null, {
      provider: ANILIST_PROVIDER,
      query: 'シュタインズ・ゲート',
      limit: 5,
      type: WorkType.anime,
    });

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        sourceId: ANILIST_PROVIDER,
        title: 'Steins;Gate',
        titleAliases: expect.arrayContaining([
          'Steins;Gate',
          'シュタインズ・ゲート',
        ]),
        reason: expect.stringContaining('별칭 제목 일치'),
        scoreBreakdown: expect.arrayContaining([
          expect.objectContaining({
            label: '별칭 제목 일치',
          }),
        ]),
      }),
    );
  });

  it('uses catalog matches as a ranking advantage', async () => {
    const catalogIngestionService = {
      findCatalogMatchForImportCandidate: jest.fn(
        async (candidate: {
          externalRefs: Array<{
            externalId: string;
          }>;
        }) => {
          return candidate.externalRefs.some(
            (externalRef) => externalRef.externalId === '/works/OL456W',
          )
            ? {
                id: 'catalog-title-1',
                title: 'Dune',
                verificationStatus: 'draft',
              }
            : null;
        },
      ),
    };
    service = new ImportsService(
      credentialService as unknown as ImportsCredentialService,
      catalogIngestionService as unknown as CatalogIngestionService,
    );
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        docs: [
          {
            key: '/works/OL123W',
            title: 'Dune',
            author_name: ['Frank Herbert'],
            first_publish_year: 1965,
          },
          {
            key: '/works/OL456W',
            title: 'Dune',
            author_name: ['Frank Herbert'],
            first_publish_year: 1965,
          },
        ],
      }),
    );

    const result = await service.search(null, {
      provider: OPEN_LIBRARY_PROVIDER,
      query: 'Dune',
      limit: 2,
      type: WorkType.novel,
    });

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        catalogMatch: expect.objectContaining({
          id: 'catalog-title-1',
        }),
        confidenceLabel: '신뢰도 높음',
        reason: expect.stringContaining('카탈로그 매칭됨'),
      }),
    );
  });

  it('ranks before applying the final limit so later provider matches are not cut off', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          items: Array.from({ length: 5 }, (_, index) => ({
            id: `google-dune-archive-${index}`,
            volumeInfo: {
              authors: ['Frank Herbert'],
              publishedDate: `${1965 + index}`,
              title: `Dune Archive ${index}`,
            },
          })),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          docs: [
            {
              key: '/works/OL123W',
              title: 'Dune',
              author_name: ['Frank Herbert'],
              first_publish_year: 1965,
            },
          ],
        }),
      );

    const result = await service.search(null, {
      providers: [GOOGLE_BOOKS_PROVIDER, OPEN_LIBRARY_PROVIDER],
      query: 'Dune',
      limit: 5,
      type: WorkType.novel,
    });

    expect(result.candidates).toHaveLength(5);
    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        sourceId: OPEN_LIBRARY_PROVIDER,
        title: 'Dune',
      }),
    );
    expect(
      result.candidates.some(
        (candidate) => candidate.sourceId === OPEN_LIBRARY_PROVIDER,
      ),
    ).toBe(true);
  });

  it('dedupes candidates with the same id before ranking', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        docs: [
          {
            key: '/works/OL123W',
            title: 'Dune',
          },
          {
            key: '/works/OL123W',
            title: 'Dune',
          },
        ],
      }),
    );

    const result = await service.search(null, {
      provider: OPEN_LIBRARY_PROVIDER,
      query: 'Dune',
      limit: 5,
      type: WorkType.novel,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.id).toBe('open_library:/works/OL123W');
  });

  it('merges Google Books and Open Library candidates that share an ISBN', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'google-dune',
              volumeInfo: {
                authors: ['Frank Herbert'],
                description: 'A desert saga.',
                industryIdentifiers: [
                  {
                    type: 'ISBN_13',
                    identifier: '9780441172719',
                  },
                ],
                infoLink: 'https://books.google.com/dune',
                publishedDate: '1965',
                title: 'Dune',
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          docs: [
            {
              author_name: ['Frank Herbert'],
              first_publish_year: 1965,
              isbn: ['978-0-441-17271-9'],
              key: '/works/OL123W',
              title: 'Dune',
            },
          ],
        }),
      );

    const result = await service.search(null, {
      providers: [GOOGLE_BOOKS_PROVIDER, OPEN_LIBRARY_PROVIDER],
      query: 'Dune',
      limit: 5,
      type: WorkType.novel,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        title: 'Dune',
        externalRefs: [
          expect.objectContaining({
            externalId: '/works/OL123W',
            provider: OPEN_LIBRARY_PROVIDER,
          }),
        ],
        releaseCandidates: [
          expect.objectContaining({
            isbn: '9780441172719',
            externalRefs: expect.arrayContaining([
              expect.objectContaining({
                externalId: 'google-dune',
                provider: GOOGLE_BOOKS_PROVIDER,
              }),
              expect.objectContaining({
                externalId: '/works/OL123W',
                provider: OPEN_LIBRARY_PROVIDER,
              }),
            ]),
          }),
        ],
      }),
    );
  });

  it('normalizes provider ISBN, date, title, and contributor fields', async () => {
    const originalNaverClientId = process.env.NAVER_CLIENT_ID;
    const originalNaverClientSecret = process.env.NAVER_CLIENT_SECRET;

    process.env.NAVER_CLIENT_ID = 'naver-client-id';
    process.env.NAVER_CLIENT_SECRET = 'naver-client-secret';
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        items: [
          {
            author: 'Frank Herbert; Frank Herbert / Brian Herbert',
            description: '<b> A desert saga &amp; archive. </b>',
            image: ' https://image.example.test/dune.jpg ',
            isbn: '0441172717 9780441172719',
            link: ' https://book.example.test/dune ',
            pubdate: '20260418',
            publisher: ' Ace ',
            title: '<b> Dune &amp; Messiah </b>',
          },
        ],
      }),
    );

    try {
      const result = await service.search(USER_ID, {
        provider: NAVER_BOOK_PROVIDER,
        query: 'Dune',
        limit: 5,
        type: WorkType.novel,
      });

      expect(result.candidates[0]).toEqual(
        expect.objectContaining({
          title: 'Dune & Messiah',
          description: 'A desert saga & archive.',
          releaseYear: 2026,
          thumbnailUrl: 'https://image.example.test/dune.jpg',
          sourceUrl: 'https://book.example.test/dune',
          contributors: [
            {
              name: 'Frank Herbert',
              role: 'author',
            },
            {
              name: 'Brian Herbert',
              role: 'author',
            },
          ],
          releaseCandidates: [
            expect.objectContaining({
              isbn: '9780441172719',
              releaseDate: '2026-04-18',
              externalRefs: [
                expect.objectContaining({
                  externalId: '0441172717 9780441172719',
                  provider: NAVER_BOOK_PROVIDER,
                  rawType: 'volume',
                  url: 'https://book.example.test/dune',
                }),
              ],
            }),
          ],
        }),
      );
    } finally {
      if (originalNaverClientId === undefined) {
        delete process.env.NAVER_CLIENT_ID;
      } else {
        process.env.NAVER_CLIENT_ID = originalNaverClientId;
      }

      if (originalNaverClientSecret === undefined) {
        delete process.env.NAVER_CLIENT_SECRET;
      } else {
        process.env.NAVER_CLIENT_SECRET = originalNaverClientSecret;
      }
    }
  });

  it('dedupes repeated provider external refs while preserving merged identity', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: 'google-dune',
            volumeInfo: {
              industryIdentifiers: [
                {
                  type: 'ISBN_13',
                  identifier: '9780441172719',
                },
              ],
              title: 'Dune',
            },
          },
          {
            id: 'google-dune',
            volumeInfo: {
              industryIdentifiers: [
                {
                  type: 'ISBN_13',
                  identifier: '9780441172719',
                },
              ],
              title: 'Dune Deluxe',
            },
          },
        ],
      }),
    );

    const result = await service.search(null, {
      provider: GOOGLE_BOOKS_PROVIDER,
      query: 'Dune',
      limit: 5,
      type: WorkType.novel,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.releaseCandidates).toHaveLength(1);
    expect(result.candidates[0]?.releaseCandidates[0]?.externalRefs).toEqual([
      expect.objectContaining({
        externalId: 'google-dune',
        provider: GOOGLE_BOOKS_PROVIDER,
      }),
    ]);
  });

  it('does not merge title-only candidates without a shared ISBN or external ref', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        docs: [
          {
            key: '/works/OL123W',
            title: 'Dune',
          },
          {
            key: '/works/OL456W',
            title: 'Dune',
          },
        ],
      }),
    );

    const result = await service.search(null, {
      provider: OPEN_LIBRARY_PROVIDER,
      query: 'Dune',
      limit: 5,
      type: WorkType.novel,
    });

    expect(result.candidates).toHaveLength(2);
  });

  it('conservatively merges title, year, and contributor matches without over-merging title-only results', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'google-dune-no-isbn',
              volumeInfo: {
                authors: ['Frank Herbert'],
                publishedDate: '1965',
                title: 'Dune',
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          docs: [
            {
              author_name: ['Frank Herbert'],
              first_publish_year: 1965,
              key: '/works/OL123W',
              title: 'Dune',
            },
          ],
        }),
      );

    const result = await service.search(null, {
      providers: [GOOGLE_BOOKS_PROVIDER, OPEN_LIBRARY_PROVIDER],
      query: 'Dune',
      limit: 5,
      type: WorkType.novel,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        sourceCoverage: expect.objectContaining({
          providerCount: 2,
          providers: expect.arrayContaining([
            GOOGLE_BOOKS_PROVIDER,
            OPEN_LIBRARY_PROVIDER,
          ]),
        }),
      }),
    );
  });

  it('merges before catalog decoration so combined identity can match catalog', async () => {
    const catalogIngestionService = {
      findCatalogMatchForImportCandidate: jest.fn(
        async (candidate: {
          releaseCandidates: Array<{
            externalRefs?: Array<{
              provider: string;
            }>;
            isbn?: string | null;
          }>;
        }) => {
          const providers = new Set(
            candidate.releaseCandidates.flatMap((releaseCandidate) =>
              (releaseCandidate.externalRefs ?? []).map(
                (externalRef) => externalRef.provider,
              ),
            ),
          );

          return candidate.releaseCandidates.some(
            (releaseCandidate) => releaseCandidate.isbn === '9780441172719',
          ) &&
            providers.has(GOOGLE_BOOKS_PROVIDER) &&
            providers.has(OPEN_LIBRARY_PROVIDER)
            ? {
                id: 'catalog-title-1',
                title: 'Dune',
                verificationStatus: 'draft',
              }
            : null;
        },
      ),
    };

    service = new ImportsService(
      credentialService as unknown as ImportsCredentialService,
      catalogIngestionService as unknown as CatalogIngestionService,
    );
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'google-dune',
              volumeInfo: {
                industryIdentifiers: [
                  {
                    type: 'ISBN_13',
                    identifier: '9780441172719',
                  },
                ],
                title: 'Dune',
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          docs: [
            {
              isbn: ['9780441172719'],
              key: '/works/OL123W',
              title: 'Dune',
            },
          ],
        }),
      );

    const result = await service.search(null, {
      providers: [GOOGLE_BOOKS_PROVIDER, OPEN_LIBRARY_PROVIDER],
      query: 'Dune',
      limit: 5,
      type: WorkType.novel,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.catalogMatch).toEqual(
      expect.objectContaining({
        id: 'catalog-title-1',
      }),
    );
  });

  it('continues search when a non-explicit provider fails', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce(
        jsonResponse({
          docs: [
            {
              key: '/works/OL123W',
              title: 'Dune',
            },
          ],
        }),
      );

    const result = await service.search(null, {
      providers: [GOOGLE_BOOKS_PROVIDER, OPEN_LIBRARY_PROVIDER],
      query: 'Dune',
      limit: 5,
      type: WorkType.novel,
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        id: 'open_library:/works/OL123W',
      }),
    ]);
    expect(result.diagnostics.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: GOOGLE_BOOKS_PROVIDER,
          status: 'failed',
          reasonCode: 'provider_failed',
          resultCount: 0,
        }),
        expect.objectContaining({
          provider: OPEN_LIBRARY_PROVIDER,
          status: 'searched',
          resultCount: 1,
        }),
      ]),
    );
  });

  it('caches credential-safe provider responses for repeated searches', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        docs: [
          {
            key: '/works/OL123W',
            title: 'Dune',
          },
        ],
      }),
    );

    await service.search(null, {
      provider: OPEN_LIBRARY_PROVIDER,
      query: 'Dune',
      limit: 5,
      type: WorkType.novel,
    });
    await service.search(null, {
      provider: OPEN_LIBRARY_PROVIDER,
      query: 'Dune',
      limit: 5,
      type: WorkType.novel,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('times out stalled provider requests', async () => {
    jest.useFakeTimers();

    try {
      jest.spyOn(globalThis, 'fetch').mockImplementation(
        async (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = (init as RequestInit | undefined)?.signal;

            signal?.addEventListener('abort', () => {
              reject(new Error('aborted'));
            });
          }),
      );

      const searchPromise = service.search(null, {
        provider: OPEN_LIBRARY_PROVIDER,
        query: 'Dune',
        limit: 5,
        type: WorkType.novel,
      });
      const expectation =
        expect(searchPromise).rejects.toBeInstanceOf(BadGatewayException);

      await jest.advanceTimersByTimeAsync(5_000);
      await expectation;
    } finally {
      jest.useRealTimers();
    }
  });

  it('requires login for guest requests to user-scoped providers', async () => {
    await expect(
      service.search(null, {
        provider: ALADIN_PROVIDER,
        query: 'Dune',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(credentialService.getDecryptedCredential).not.toHaveBeenCalled();
  });

  it('keeps server-key providers unavailable to guest search by default', async () => {
    await expect(
      service.search(null, {
        provider: TMDB_PROVIDER,
        query: 'Dune',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('records skipped diagnostics when an authenticated server provider is not configured', async () => {
    const originalTmdbApiKey = process.env.TMDB_API_KEY;
    const originalTmdbReadToken = process.env.TMDB_API_READ_TOKEN;

    delete process.env.TMDB_API_KEY;
    delete process.env.TMDB_API_READ_TOKEN;

    try {
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      const result = await service.search(USER_ID, {
        provider: TMDB_PROVIDER,
        query: 'Dune',
      });

      expect(result.candidates).toEqual([]);
      expect(result.diagnostics.providers).toEqual([
        expect.objectContaining({
          provider: TMDB_PROVIDER,
          status: 'skipped',
          credentialMode: 'server',
          configured: false,
          reasonCode: 'server_credential_missing',
          resultCount: 0,
        }),
      ]);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      if (originalTmdbApiKey === undefined) {
        delete process.env.TMDB_API_KEY;
      } else {
        process.env.TMDB_API_KEY = originalTmdbApiKey;
      }

      if (originalTmdbReadToken === undefined) {
        delete process.env.TMDB_API_READ_TOKEN;
      } else {
        process.env.TMDB_API_READ_TOKEN = originalTmdbReadToken;
      }
    }
  });

  it('maps Aladin book results into Quick Add candidates', async () => {
    credentialService.getDecryptedCredential.mockResolvedValue('ttb-test-key');
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        item: [
          {
            itemId: 123,
            title: '듄',
            author: '프랭크 허버트',
            description: ' 사막 행성을 둘러싼 이야기 ',
            cover: 'https://image.aladin.co.kr/cover.jpg',
            categoryName: '국내도서>소설/시/희곡>영미소설',
            publisher: '황금가지',
            pubDate: '2026-04-18',
            link: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123',
          },
        ],
      }),
    );

    const result = await service.search(USER_ID, {
      provider: ALADIN_PROVIDER,
      query: '듄',
      limit: 10,
      type: WorkType.novel,
    });

    expect(result).toEqual(
      expect.objectContaining({
        provider: ALADIN_PROVIDER,
        providers: [ALADIN_PROVIDER],
        query: '듄',
        candidates: [
          expect.objectContaining({
            id: 'aladin:123',
            externalId: '123',
            sourceId: 'aladin',
            sourceLabel: 'Aladin Book',
            title: '듄',
            author: '프랭크 허버트',
            type: WorkType.novel,
            mediumType: WorkType.novel,
            thumbnailUrl: 'https://image.aladin.co.kr/cover.jpg',
            genresText: '소설/시/희곡, 영미소설',
            note: '도서 DB 제공: 알라딘 인터넷서점(www.aladin.co.kr)',
            externalRefs: [],
            releaseCandidates: [
              expect.objectContaining({
                externalRefs: [
                  expect.objectContaining({
                    provider: ALADIN_PROVIDER,
                    externalId: '123',
                    rawType: 'volume',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('SearchTarget=Book'),
      }),
      expect.any(Object),
    );
  });

  it('returns forbidden when Aladin reports a key error', async () => {
    credentialService.getDecryptedCredential.mockResolvedValue('bad-key');
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        errorCode: 8,
        errorMessage: 'Invalid TTBKey',
      }),
    );

    await expect(
      service.search(USER_ID, {
        provider: ALADIN_PROVIDER,
        query: 'Dune',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('converts malformed upstream responses into bad gateway', async () => {
    credentialService.getDecryptedCredential.mockResolvedValue('ttb-test-key');
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]));

    await expect(
      service.search(USER_ID, {
        provider: ALADIN_PROVIDER,
        query: 'Dune',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
