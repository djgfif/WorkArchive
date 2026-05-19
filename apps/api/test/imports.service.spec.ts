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
  BRAVE_SEARCH_PROVIDER,
  GOOGLE_BOOKS_PROVIDER,
  KAKAO_BOOK_PROVIDER,
  KAKAO_WEB_PROVIDER,
  KOBIS_PROVIDER,
  MANUAL_PROVIDER,
  NAVER_BOOK_PROVIDER,
  NAVER_WEB_PROVIDER,
  OPEN_LIBRARY_PROVIDER,
  TAVILY_SEARCH_PROVIDER,
  TMDB_PROVIDER,
  TVMAZE_PROVIDER,
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
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.TAVILY_API_KEY;
    delete process.env.IMPORT_SERVER_SEARCH_GUEST_ENABLED;
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
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.TAVILY_API_KEY;
    delete process.env.IMPORT_SERVER_SEARCH_GUEST_ENABLED;
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
          credentialMode: 'user',
          configured: false,
        }),
        expect.objectContaining({
          provider: BRAVE_SEARCH_PROVIDER,
          credentialMode: 'server',
          configured: false,
        }),
      ]),
    );
    expect(credentialService.hasCredential).not.toHaveBeenCalled();
  });

  it('reports server provider readiness from environment keys', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'brave-server-key';

    const providers = await service.listProviders(null);

    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: BRAVE_SEARCH_PROVIDER,
          credentialMode: 'server',
          configured: true,
        }),
        expect.objectContaining({
          provider: TAVILY_SEARCH_PROVIDER,
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
    expect(credentialService.hasCredential).toHaveBeenCalledWith(
      USER_ID,
      TMDB_PROVIDER,
    );
  });

  it('stores and deletes provider-generic user credentials as encrypted JSON payloads', async () => {
    await expect(
      service.saveProviderKey(USER_ID, NAVER_BOOK_PROVIDER, {
        clientId: ' naver-client-id ',
        clientSecret: ' naver-client-secret ',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        provider: NAVER_BOOK_PROVIDER,
        configured: true,
      }),
    );

    expect(credentialService.saveCredential).toHaveBeenCalledWith(
      USER_ID,
      NAVER_BOOK_PROVIDER,
      JSON.stringify({
        clientId: 'naver-client-id',
        clientSecret: 'naver-client-secret',
      }),
    );

    await service.deleteProviderKey(USER_ID, NAVER_BOOK_PROVIDER);

    expect(credentialService.deleteCredential).toHaveBeenCalledWith(
      USER_ID,
      NAVER_BOOK_PROVIDER,
    );
  });

  it('keeps the legacy Aladin raw key wrapper compatible with generic storage', async () => {
    await service.saveAladinKey(USER_ID, ' ttb-test-key ');

    expect(credentialService.saveCredential).toHaveBeenCalledWith(
      USER_ID,
      ALADIN_PROVIDER,
      JSON.stringify({
        ttbKey: 'ttb-test-key',
      }),
    );

    await service.deleteAladinKey(USER_ID);

    expect(credentialService.deleteCredential).toHaveBeenCalledWith(
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

  it('keeps manual Quick Add candidates visibly separate from external identity matches', async () => {
    const result = await service.search(USER_ID, {
      provider: MANUAL_PROVIDER,
      query: '전지적 독자 시점',
      type: WorkType.web_novel,
    });

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        externalRefs: [],
        reason: expect.not.stringContaining('외부 식별자'),
        sourceCoverage: expect.objectContaining({
          externalIdentityCount: 0,
        }),
        sourceId: MANUAL_PROVIDER,
        title: '전지적 독자 시점',
      }),
    );
    expect(result.candidates[0]?.reason).not.toContain('출처 내부 순위');
  });

  it('records skipped diagnostics for guest automatic user-key providers', async () => {
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
          credentialMode: 'user',
          reasonCode: 'guest_provider_not_allowed',
        }),
        expect.objectContaining({
          provider: KOBIS_PROVIDER,
          status: 'skipped',
          credentialMode: 'user',
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

  it('keeps exact title matches ahead of partial title matches', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        docs: [
          {
            key: '/works/OL456W',
            title: 'Dune Messiah',
            author_name: ['Frank Herbert'],
            first_publish_year: 1969,
          },
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

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        title: 'Dune',
        reason: expect.stringContaining('제목 정확히 일치'),
      }),
    );
    expect(result.candidates[1]?.title).toBe('Dune Messiah');
  });

  it('retries official provider search with a cleaned Korean title when the original query has no strong match', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          items: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'google-solo-leveling',
              volumeInfo: {
                authors: ['추공'],
                industryIdentifiers: [
                  {
                    type: 'ISBN_13',
                    identifier: '9790000000001',
                  },
                ],
                publishedDate: '2018',
                title: '나 혼자만 레벨업',
              },
            },
          ],
        }),
      );

    const result = await service.search(null, {
      provider: GOOGLE_BOOKS_PROVIDER,
      query: '나 혼자만 레벨업 1권',
      limit: 5,
      type: WorkType.novel,
    });

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        sourceId: GOOGLE_BOOKS_PROVIDER,
        title: '나 혼자만 레벨업',
      }),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    const secondUrl = new URL(String(fetchSpy.mock.calls[1]?.[0]));

    expect(firstUrl.searchParams.get('q')).toBe('나 혼자만 레벨업 1권');
    expect(secondUrl.searchParams.get('q')).toBe('나 혼자만 레벨업');
  });

  it('uses official book providers as auxiliary web novel search without removing manual fallback', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: 'google-web-novel',
            volumeInfo: {
              authors: ['싱숑'],
              title: '전지적 독자 시점',
            },
          },
        ],
      }),
    );

    const result = await service.search(null, {
      query: '전지적 독자 시점',
      limit: 5,
      type: WorkType.web_novel,
    });

    expect(result.providers).toEqual([GOOGLE_BOOKS_PROVIDER, MANUAL_PROVIDER]);
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: GOOGLE_BOOKS_PROVIDER,
          title: '전지적 독자 시점',
        }),
        expect.objectContaining({
          sourceId: MANUAL_PROVIDER,
          title: '전지적 독자 시점',
          type: WorkType.web_novel,
        }),
      ]),
    );
    expect(result.diagnostics.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: BRAVE_SEARCH_PROVIDER,
          reasonCode: 'guest_provider_not_allowed',
          status: 'skipped',
        }),
        expect.objectContaining({
          provider: KAKAO_WEB_PROVIDER,
          reasonCode: 'guest_provider_not_allowed',
          status: 'skipped',
        }),
        expect.objectContaining({
          provider: NAVER_WEB_PROVIDER,
          reasonCode: 'guest_provider_not_allowed',
          status: 'skipped',
        }),
        expect.objectContaining({
          provider: TAVILY_SEARCH_PROVIDER,
          reasonCode: 'guest_provider_not_allowed',
          status: 'skipped',
        }),
        expect.objectContaining({
          provider: KAKAO_BOOK_PROVIDER,
          reasonCode: 'guest_provider_not_allowed',
          status: 'skipped',
        }),
        expect.objectContaining({
          provider: NAVER_BOOK_PROVIDER,
          reasonCode: 'guest_provider_not_allowed',
          status: 'skipped',
        }),
        expect.objectContaining({
          provider: GOOGLE_BOOKS_PROVIDER,
          status: 'searched',
        }),
        expect.objectContaining({
          provider: MANUAL_PROVIDER,
          status: 'searched',
        }),
      ]),
    );
  });

  it('uses Naver and Kakao web providers before book providers for authenticated web novel search', async () => {
    credentialService.hasCredential.mockResolvedValue(true);
    credentialService.getDecryptedCredential.mockImplementation(
      async (_userId, provider) => {
        if (
          provider === NAVER_WEB_PROVIDER ||
          provider === NAVER_BOOK_PROVIDER
        ) {
          return JSON.stringify({
            clientId: 'naver-client-id',
            clientSecret: 'naver-client-secret',
          });
        }

        if (
          provider === KAKAO_WEB_PROVIDER ||
          provider === KAKAO_BOOK_PROVIDER
        ) {
          return JSON.stringify({
            restApiKey: 'kakao-rest-key',
          });
        }

        return null;
      },
    );
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          documents: [
            {
              contents: '웹소설 연재 작품',
              datetime: '2018-01-01T00:00:00.000+09:00',
              title: '<b>전지적 독자 시점</b> 외전 - 카카오페이지',
              url: 'https://page.kakao.com/content/12345',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              description: '네이버 시리즈 웹소설',
              link: 'https://series.naver.com/novel/detail.series?productNo=1',
              title: '<b>전지적 독자 시점</b> 1권 - 네이버 시리즈',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ documents: [] }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }));

    const result = await service.search(USER_ID, {
      query: '전지적 독자 시점',
      limit: 5,
      type: WorkType.web_novel,
    });

    expect(result.providers).toEqual([
      BRAVE_SEARCH_PROVIDER,
      KAKAO_WEB_PROVIDER,
      NAVER_WEB_PROVIDER,
      TAVILY_SEARCH_PROVIDER,
      KAKAO_BOOK_PROVIDER,
      NAVER_BOOK_PROVIDER,
      GOOGLE_BOOKS_PROVIDER,
      MANUAL_PROVIDER,
    ]);
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: KAKAO_WEB_PROVIDER,
          title: '전지적 독자 시점',
          mediumType: WorkType.web_novel,
          sourceUrl: 'https://page.kakao.com/content/12345',
        }),
        expect.objectContaining({
          sourceId: NAVER_WEB_PROVIDER,
          title: '전지적 독자 시점',
          mediumType: WorkType.web_novel,
          sourceUrl: 'https://series.naver.com/novel/detail.series?productNo=1',
        }),
      ]),
    );

    const firstUrl = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    const firstHeaders = new Headers(fetchSpy.mock.calls[0]?.[1]?.headers);
    const secondUrl = new URL(String(fetchSpy.mock.calls[1]?.[0]));
    const secondHeaders = new Headers(fetchSpy.mock.calls[1]?.[1]?.headers);

    expect(firstUrl.hostname).toBe('dapi.kakao.com');
    expect(firstHeaders.get('authorization')).toBe('KakaoAK kakao-rest-key');
    expect(secondUrl.hostname).toBe('openapi.naver.com');
    expect(secondHeaders.get('X-Naver-Client-Id')).toBe('naver-client-id');
  });

  it('maps web search results to webtoon candidates and strips site or episode suffixes', async () => {
    credentialService.getDecryptedCredential.mockResolvedValue(
      JSON.stringify({
        clientId: 'naver-client-id',
        clientSecret: 'naver-client-secret',
      }),
    );
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        items: [
          {
            description: '인기 웹툰',
            link: 'https://comic.naver.com/webtoon/list?titleId=123',
            title: '<b>외모지상주의</b> 10화 - 네이버 웹툰',
          },
        ],
      }),
    );

    const result = await service.search(USER_ID, {
      provider: NAVER_WEB_PROVIDER,
      query: '외모지상주의',
      limit: 5,
      type: WorkType.webtoon,
    });

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        sourceId: NAVER_WEB_PROVIDER,
        title: '외모지상주의',
        mediumType: WorkType.webtoon,
        sourceLabel: 'Naver Web',
        sourceUrl: 'https://comic.naver.com/webtoon/list?titleId=123',
      }),
    );
  });

  it('skips unconfigured server search providers with diagnostics', async () => {
    const result = await service.search(USER_ID, {
      providers: [
        BRAVE_SEARCH_PROVIDER,
        TAVILY_SEARCH_PROVIDER,
        MANUAL_PROVIDER,
      ],
      query: '전지적 독자 시점',
      limit: 5,
      type: WorkType.web_novel,
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        sourceId: MANUAL_PROVIDER,
        title: '전지적 독자 시점',
      }),
    ]);
    expect(result.diagnostics.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: BRAVE_SEARCH_PROVIDER,
          configured: false,
          reasonCode: 'server_credential_missing',
          status: 'skipped',
        }),
        expect.objectContaining({
          provider: TAVILY_SEARCH_PROVIDER,
          configured: false,
          reasonCode: 'server_credential_missing',
          status: 'skipped',
        }),
      ]),
    );
  });

  it('uses Brave Search server credentials and Korean query rewrite for web novel search', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'brave-server-key';
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        web: {
          results: [
            {
              description: '무협 웹소설 연재',
              title: '<b>화산귀환</b> - 네이버 시리즈',
              url: 'https://series.naver.com/novel/detail.series?productNo=1',
            },
          ],
        },
      }),
    );

    const result = await service.search(USER_ID, {
      provider: BRAVE_SEARCH_PROVIDER,
      query: '화산귀환',
      limit: 5,
      type: WorkType.web_novel,
    });

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        sourceId: BRAVE_SEARCH_PROVIDER,
        title: '화산귀환',
        mediumType: WorkType.web_novel,
        sourceUrl: 'https://series.naver.com/novel/detail.series?productNo=1',
      }),
    );

    const fetchCall = fetchSpy.mock.calls[0];
    const fetchUrl = new URL(String(fetchCall?.[0]));
    const fetchHeaders = new Headers(fetchCall?.[1]?.headers);

    expect(fetchUrl.hostname).toBe('api.search.brave.com');
    expect(fetchUrl.searchParams.get('q')).toBe('"화산귀환" 웹소설 OR 소설');
    expect(fetchUrl.searchParams.get('country')).toBe('kr');
    expect(fetchUrl.searchParams.get('search_lang')).toBe('ko');
    expect(fetchUrl.searchParams.get('count')).toBe('5');
    expect(fetchHeaders.get('X-Subscription-Token')).toBe('brave-server-key');
  });

  it('uses Tavily domain-constrained server search for webtoon search', async () => {
    process.env.TAVILY_API_KEY = 'tavily-server-key';
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        results: [
          {
            content: '네이버 웹툰 연재',
            title: '외모지상주의 - 네이버 웹툰',
            url: 'https://comic.naver.com/webtoon/list?titleId=123',
          },
        ],
      }),
    );

    const result = await service.search(USER_ID, {
      provider: TAVILY_SEARCH_PROVIDER,
      query: '외모지상주의',
      limit: 5,
      type: WorkType.webtoon,
    });

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        sourceId: TAVILY_SEARCH_PROVIDER,
        title: '외모지상주의',
        mediumType: WorkType.webtoon,
        sourceUrl: 'https://comic.naver.com/webtoon/list?titleId=123',
      }),
    );

    const fetchCall = fetchSpy.mock.calls[0];
    const fetchBody = JSON.parse(String(fetchCall?.[1]?.body)) as {
      country: string;
      include_domains: string[];
      max_results: number;
      query: string;
      search_depth: string;
    };
    const fetchHeaders = new Headers(fetchCall?.[1]?.headers);

    expect(fetchHeaders.get('authorization')).toBe('Bearer tavily-server-key');
    expect(fetchBody).toEqual(
      expect.objectContaining({
        country: 'south korea',
        max_results: 5,
        query: '"외모지상주의" 웹툰 OR 만화',
        search_depth: 'basic',
      }),
    );
    expect(fetchBody.include_domains).toEqual(
      expect.arrayContaining([
        'series.naver.com',
        'comic.naver.com',
        'page.kakao.com',
        'webtoon.kakao.com',
      ]),
    );
  });

  it('resolves anime search providers with Brave Search between AniList and TVmaze', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            Page: {
              media: [],
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse([]));

    const result = await service.search(USER_ID, {
      query: '슈타인즈 게이트',
      limit: 5,
      type: WorkType.anime,
    });

    expect(result.providers).toEqual([
      ANILIST_PROVIDER,
      BRAVE_SEARCH_PROVIDER,
      TVMAZE_PROVIDER,
      MANUAL_PROVIDER,
    ]);
    expect(result.diagnostics.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: BRAVE_SEARCH_PROVIDER,
          reasonCode: 'server_credential_missing',
          status: 'skipped',
        }),
      ]),
    );
  });

  it('uses query year and contributor signals when titles are similar', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        docs: [
          {
            key: '/works/OL-wrong-year',
            title: 'Dune',
            author_name: ['Brian Herbert'],
            first_publish_year: 1999,
          },
          {
            key: '/works/OL-right-year',
            title: 'Dune',
            author_name: ['Frank Herbert'],
            first_publish_year: 1965,
          },
        ],
      }),
    );

    const result = await service.search(null, {
      provider: OPEN_LIBRARY_PROVIDER,
      query: 'Dune Frank Herbert 1965',
      limit: 5,
      type: WorkType.novel,
    });

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        externalId: '/works/OL-right-year',
        reason: expect.stringContaining('발매연도 근접'),
        scoreBreakdown: expect.arrayContaining([
          expect.objectContaining({
            label: '제작자 일치',
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
    credentialService.getDecryptedCredential.mockResolvedValue(
      JSON.stringify({
        clientId: 'naver-client-id',
        clientSecret: 'naver-client-secret',
      }),
    );
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

    const fetchCall = jest.mocked(globalThis.fetch).mock.calls[0];
    const fetchHeaders = new Headers(fetchCall?.[1]?.headers);

    expect(fetchHeaders.get('X-Naver-Client-Id')).toBe('naver-client-id');
    expect(fetchHeaders.get('X-Naver-Client-Secret')).toBe(
      'naver-client-secret',
    );
  });

  it('uses the authenticated user TMDB credential for movie search', async () => {
    credentialService.getDecryptedCredential.mockResolvedValue(
      JSON.stringify({
        readToken: 'tmdb-read-token',
      }),
    );
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: 123,
            overview: 'Desert planet.',
            poster_path: '/dune.jpg',
            release_date: '2021-10-22',
            title: 'Dune',
          },
        ],
      }),
    );

    const result = await service.search(USER_ID, {
      provider: TMDB_PROVIDER,
      query: 'Dune',
      type: WorkType.movie,
    });

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        sourceId: TMDB_PROVIDER,
        title: 'Dune',
      }),
    );

    const fetchCall = jest.mocked(globalThis.fetch).mock.calls[0];
    const fetchHeaders = new Headers(fetchCall?.[1]?.headers);

    expect(fetchHeaders.get('authorization')).toBe('Bearer tmdb-read-token');
  });

  it('uses the authenticated user Kakao credential for book search', async () => {
    credentialService.getDecryptedCredential.mockResolvedValue(
      JSON.stringify({
        restApiKey: 'kakao-rest-key',
      }),
    );
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        documents: [
          {
            authors: ['Frank Herbert'],
            contents: 'Desert planet.',
            datetime: '1965-08-01T00:00:00.000+09:00',
            isbn: '9780441172719',
            title: 'Dune',
            url: 'https://book.example.test/dune',
          },
        ],
      }),
    );

    const result = await service.search(USER_ID, {
      provider: KAKAO_BOOK_PROVIDER,
      query: 'Dune',
      type: WorkType.novel,
    });

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        sourceId: KAKAO_BOOK_PROVIDER,
        title: 'Dune',
      }),
    );

    const fetchCall = jest.mocked(globalThis.fetch).mock.calls[0];
    const fetchHeaders = new Headers(fetchCall?.[1]?.headers);

    expect(fetchHeaders.get('authorization')).toBe('KakaoAK kakao-rest-key');
  });

  it('uses the authenticated user KOBIS credential for movie search', async () => {
    credentialService.getDecryptedCredential.mockResolvedValue(
      JSON.stringify({
        apiKey: 'kobis-api-key',
      }),
    );
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        movieListResult: {
          movieList: [
            {
              movieCd: '20210001',
              movieNm: 'Dune',
              openDt: '20211020',
              prdtYear: '2021',
            },
          ],
        },
      }),
    );

    const result = await service.search(USER_ID, {
      provider: KOBIS_PROVIDER,
      query: 'Dune',
      type: WorkType.movie,
    });

    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        sourceId: KOBIS_PROVIDER,
        title: 'Dune',
      }),
    );

    const fetchCall = jest.mocked(globalThis.fetch).mock.calls[0];
    const fetchUrl = new URL(String(fetchCall?.[0]));

    expect(fetchUrl.searchParams.get('key')).toBe('kobis-api-key');
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
        scoreBreakdown: expect.arrayContaining([
          expect.objectContaining({
            label: '출처 2개 확인',
          }),
        ]),
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

  it('does not weak-merge variant titles such as theatrical editions', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'google-dune-base',
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
              key: '/works/OL-movie-edition',
              title: 'Dune (극장판)',
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

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        title: 'Dune',
      }),
    );
    expect(
      result.candidates.find((candidate) => candidate.title === 'Dune (극장판)')
        ?.scoreBreakdown,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '변형판 제목 신호',
          weight: expect.any(Number),
        }),
      ]),
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

  it('keeps provider cache entries separate by normalized limit and medium type', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          docs: [
            {
              key: '/works/OL123W',
              title: 'Dune',
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
            },
            {
              key: '/works/OL456W',
              title: 'Dune Archive',
            },
          ],
        }),
      );

    await service.search(null, {
      provider: OPEN_LIBRARY_PROVIDER,
      query: 'Dune',
      limit: 1,
      type: WorkType.novel,
    });
    await service.search(null, {
      provider: OPEN_LIBRARY_PROVIDER,
      query: 'Dune',
      limit: 2,
      type: WorkType.novel,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
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

  it('keeps user-key providers unavailable to guest search by default', async () => {
    await expect(
      service.search(null, {
        provider: TMDB_PROVIDER,
        query: 'Dune',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects explicit authenticated search when a user-key provider is not configured', async () => {
    credentialService.getDecryptedCredential.mockResolvedValue(null);
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(
      service.search(USER_ID, {
        provider: TMDB_PROVIDER,
        query: 'Dune',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(fetchSpy).not.toHaveBeenCalled();
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
