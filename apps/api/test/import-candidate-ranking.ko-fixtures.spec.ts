import { WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import type { ImportCandidateResponseDto } from '../src/modules/imports/dto/import-candidate-response.dto';
import {
  rankImportCandidates,
  scoreImportCandidate,
} from '../src/modules/imports/candidates/import-candidate-ranking';

interface KoreanRankingFixture {
  expectedType: WorkType;
  provider: string;
  query: string;
}

const fixtures: KoreanRankingFixture[] = [
  { query: '데미안', expectedType: WorkType.novel, provider: 'aladin' },
  { query: '어린 왕자', expectedType: WorkType.novel, provider: 'aladin' },
  { query: '채식주의자', expectedType: WorkType.novel, provider: 'aladin' },
  { query: '82년생 김지영', expectedType: WorkType.novel, provider: 'aladin' },
  { query: '아몬드', expectedType: WorkType.novel, provider: 'aladin' },
  {
    query: '눈먼 자들의 도시',
    expectedType: WorkType.novel,
    provider: 'aladin',
  },
  { query: '파과', expectedType: WorkType.novel, provider: 'aladin' },
  {
    query: '달러구트 꿈 백화점',
    expectedType: WorkType.novel,
    provider: 'aladin',
  },
  { query: '드래곤 라자', expectedType: WorkType.novel, provider: 'aladin' },
  { query: '퇴마록', expectedType: WorkType.novel, provider: 'aladin' },
  { query: '원피스', expectedType: WorkType.manga, provider: 'anilist' },
  { query: '슬램덩크', expectedType: WorkType.manga, provider: 'anilist' },
  { query: '진격의 거인', expectedType: WorkType.manga, provider: 'anilist' },
  { query: '귀멸의 칼날', expectedType: WorkType.manga, provider: 'anilist' },
  { query: '체인소 맨', expectedType: WorkType.manga, provider: 'anilist' },
  { query: '나루토', expectedType: WorkType.manga, provider: 'anilist' },
  { query: '블리치', expectedType: WorkType.manga, provider: 'anilist' },
  { query: '명탐정 코난', expectedType: WorkType.manga, provider: 'anilist' },
  {
    query: '강철의 연금술사',
    expectedType: WorkType.manga,
    provider: 'anilist',
  },
  { query: '주술회전', expectedType: WorkType.manga, provider: 'anilist' },
  { query: '너의 이름은', expectedType: WorkType.anime, provider: 'anilist' },
  {
    query: '스즈메의 문단속',
    expectedType: WorkType.anime,
    provider: 'anilist',
  },
  {
    query: '센과 치히로의 행방불명',
    expectedType: WorkType.anime,
    provider: 'anilist',
  },
  { query: '에반게리온', expectedType: WorkType.anime, provider: 'anilist' },
  {
    query: '슈타인즈 게이트',
    expectedType: WorkType.anime,
    provider: 'anilist',
  },
  {
    query: '진격의 거인 애니메이션',
    expectedType: WorkType.anime,
    provider: 'anilist',
  },
  { query: '너에게 닿기를', expectedType: WorkType.anime, provider: 'anilist' },
  {
    query: '바이올렛 에버가든',
    expectedType: WorkType.anime,
    provider: 'anilist',
  },
  {
    query: '소드 아트 온라인',
    expectedType: WorkType.light_novel,
    provider: 'aladin',
  },
  {
    query: 'Re:제로부터 시작하는 이세계 생활',
    expectedType: WorkType.light_novel,
    provider: 'aladin',
  },
  {
    query: '어떤 마술의 금서목록',
    expectedType: WorkType.light_novel,
    provider: 'aladin',
  },
  {
    query: '스즈미야 하루히의 우울',
    expectedType: WorkType.light_novel,
    provider: 'aladin',
  },
  {
    query: '전지적 독자 시점',
    expectedType: WorkType.web_novel,
    provider: 'kakao_book',
  },
  {
    query: '나 혼자만 레벨업',
    expectedType: WorkType.web_novel,
    provider: 'kakao_book',
  },
  {
    query: '화산귀환',
    expectedType: WorkType.web_novel,
    provider: 'kakao_book',
  },
  {
    query: '재벌집 막내아들',
    expectedType: WorkType.web_novel,
    provider: 'kakao_book',
  },
  {
    query: '상수리나무 아래',
    expectedType: WorkType.web_novel,
    provider: 'kakao_book',
  },
  {
    query: '외모지상주의',
    expectedType: WorkType.webtoon,
    provider: 'naver_book',
  },
  { query: '신의 탑', expectedType: WorkType.webtoon, provider: 'naver_book' },
  {
    query: '유미의 세포들',
    expectedType: WorkType.webtoon,
    provider: 'naver_book',
  },
  {
    query: '이태원 클라쓰',
    expectedType: WorkType.webtoon,
    provider: 'naver_book',
  },
  {
    query: '연의 편지',
    expectedType: WorkType.webtoon,
    provider: 'naver_book',
  },
  { query: '기생충', expectedType: WorkType.movie, provider: 'tmdb' },
  { query: '헤어질 결심', expectedType: WorkType.movie, provider: 'tmdb' },
  { query: '올드보이', expectedType: WorkType.movie, provider: 'kobis' },
  { query: '부산행', expectedType: WorkType.movie, provider: 'kobis' },
  { query: '오징어 게임', expectedType: WorkType.drama, provider: 'tmdb' },
  {
    query: '이상한 변호사 우영우',
    expectedType: WorkType.drama,
    provider: 'tmdb',
  },
  { query: '미스터 션샤인', expectedType: WorkType.drama, provider: 'tmdb' },
  {
    query: '슬기로운 의사생활',
    expectedType: WorkType.drama,
    provider: 'tmdb',
  },
];

function createCandidate(
  fixture: KoreanRankingFixture,
  overrides: Partial<ImportCandidateResponseDto> = {},
): ImportCandidateResponseDto {
  const provider = overrides.sourceId ?? fixture.provider;
  const externalRefs =
    overrides.externalRefs ??
    (provider === 'manual'
      ? []
      : [
          {
            externalId: `external-${fixture.query}`,
            provider,
            rawType: String(overrides.mediumType ?? fixture.expectedType),
            url: `https://example.test/${encodeURIComponent(fixture.query)}`,
          },
        ]);
  const sourceCoverage = overrides.sourceCoverage ?? {
    externalIdentityCount: externalRefs.length,
    providerCount: provider === 'manual' ? 0 : 1,
    providers: provider === 'manual' ? [] : [provider],
    releaseCandidateCount: 0,
  };

  return {
    author: '대표 제작자',
    catalogMatch: null,
    confidence: 0.75,
    confidenceLabel: '후보',
    contributors: [{ name: '대표 제작자', role: 'creator' }],
    countLabel: '',
    description: '',
    existingRecord: null,
    externalId: `${provider}-${fixture.query}`,
    externalRefs,
    formatLabel: '',
    franchiseName: null,
    genresText: '',
    id: `${provider}-${fixture.expectedType}-${fixture.query}`,
    mediumType: fixture.expectedType,
    note: '',
    reason: '',
    relationsHint: [],
    releaseCandidates: [],
    releaseYear: 2020,
    scoreBreakdown: [],
    sourceCoverage,
    sourceId: provider,
    sourceLabel: provider,
    sourceUrl: '',
    subType: null,
    thumbnailUrl: '',
    title: fixture.query,
    titleAliases: [],
    type: fixture.expectedType,
    ...overrides,
  };
}

describe('Korean Quick Add ranking fixtures', () => {
  const productFixtures = [
    {
      query: '나 혼자만 레벨업',
      mediumType: WorkType.web_novel,
      expectedId: 'solo-leveling-web-novel',
      candidates: [
        createCandidate(
          {
            query: '나 혼자만 레벨업',
            expectedType: WorkType.web_novel,
            provider: 'kakao_book',
          },
          {
            id: 'solo-leveling-web-novel',
            releaseYear: 2016,
            titleAliases: ['Solo Leveling', 'Only I Level Up'],
          },
        ),
        createCandidate(
          {
            query: '나 혼자만 레벨업',
            expectedType: WorkType.webtoon,
            provider: 'kakao_web',
          },
          {
            id: 'solo-leveling-webtoon',
            releaseYear: 2018,
            titleAliases: ['Solo Leveling'],
          },
        ),
        createCandidate(
          {
            query: '나 혼자만 레벨업 외전',
            expectedType: WorkType.web_novel,
            provider: 'kakao_book',
          },
          {
            id: 'solo-leveling-side-story',
            releaseYear: 2024,
            title: '나 혼자만 레벨업 외전',
          },
        ),
      ],
    },
    {
      query: '전지적 독자 시점',
      mediumType: WorkType.web_novel,
      expectedId: 'orv-web-novel',
      candidates: [
        createCandidate(
          {
            query: "Omniscient Reader's Viewpoint",
            expectedType: WorkType.web_novel,
            provider: 'google_books',
          },
          {
            id: 'orv-web-novel',
            releaseYear: 2018,
            titleAliases: ['전지적 독자 시점', 'Omniscient Reader'],
          },
        ),
        createCandidate(
          {
            query: '전지적 독자 시점 외전',
            expectedType: WorkType.web_novel,
            provider: 'kakao_book',
          },
          {
            id: 'orv-side-story',
            releaseYear: 2024,
            title: '전지적 독자 시점 외전',
          },
        ),
        createCandidate(
          {
            query: '전지적 독자 시점',
            expectedType: WorkType.webtoon,
            provider: 'kakao_web',
          },
          {
            id: 'orv-webtoon',
            releaseYear: 2020,
          },
        ),
      ],
    },
    {
      query: '괴담동아리',
      mediumType: WorkType.web_novel,
      expectedId: 'ghost-story-club',
      candidates: [
        createCandidate(
          {
            query: '괴담동아리',
            expectedType: WorkType.web_novel,
            provider: 'naver_web',
          },
          {
            id: 'ghost-story-club',
            author: '오직재미',
            contributors: [{ name: '오직재미', role: 'author' }],
            releaseYear: 2020,
            titleAliases: ['Ghost Story Club'],
          },
        ),
        createCandidate(
          {
            query: '괴담 동아리',
            expectedType: WorkType.webtoon,
            provider: 'naver_web',
          },
          {
            id: 'ghost-story-club-webtoon',
            releaseYear: 2022,
          },
        ),
      ],
    },
    {
      query: '장송의 프리렌',
      mediumType: WorkType.anime,
      expectedId: 'frieren-anime-ko',
      candidates: [
        createCandidate(
          {
            query: '葬送のフリーレン',
            expectedType: WorkType.anime,
            provider: 'anilist',
          },
          {
            id: 'frieren-anime-ko',
            releaseYear: 2023,
            titleAliases: ['장송의 프리렌', 'Sousou no Frieren'],
          },
        ),
        createCandidate(
          {
            query: '葬送のフリーレン',
            expectedType: WorkType.manga,
            provider: 'anilist',
          },
          {
            id: 'frieren-manga',
            releaseYear: 2020,
            titleAliases: ['장송의 프리렌', 'Sousou no Frieren'],
          },
        ),
      ],
    },
    {
      query: '葬送のフリーレン',
      mediumType: WorkType.manga,
      expectedId: 'frieren-manga-ja',
      candidates: [
        createCandidate(
          {
            query: '장송의 프리렌',
            expectedType: WorkType.manga,
            provider: 'anilist',
          },
          {
            id: 'frieren-manga-ja',
            releaseYear: 2020,
            titleAliases: ['葬送のフリーレン', 'Sousou no Frieren'],
          },
        ),
        createCandidate(
          {
            query: '장송의 프리렌',
            expectedType: WorkType.anime,
            provider: 'anilist',
          },
          {
            id: 'frieren-anime-wrong-medium',
            releaseYear: 2023,
            titleAliases: ['葬送のフリーレン', 'Sousou no Frieren'],
          },
        ),
      ],
    },
    {
      query: 'Sousou no Frieren',
      mediumType: WorkType.anime,
      expectedId: 'frieren-anime-en',
      candidates: [
        createCandidate(
          {
            query: '葬送のフリーレン',
            expectedType: WorkType.anime,
            provider: 'anilist',
          },
          {
            id: 'frieren-anime-en',
            releaseYear: 2023,
            titleAliases: ['장송의 프리렌', 'Sousou no Frieren'],
          },
        ),
        createCandidate(
          {
            query: 'Frieren: Beyond Journey’s End Official Guide',
            expectedType: WorkType.manga,
            provider: 'google_books',
          },
          {
            id: 'frieren-guidebook',
            releaseYear: 2024,
          },
        ),
      ],
    },
    {
      query: 'Steins;Gate',
      mediumType: WorkType.anime,
      expectedId: 'steins-gate-anime',
      candidates: [
        createCandidate(
          {
            query: 'STEINS;GATE',
            expectedType: WorkType.anime,
            provider: 'anilist',
          },
          {
            id: 'steins-gate-anime',
            author: 'WHITE FOX',
            contributors: [{ name: 'WHITE FOX', role: 'studio' }],
            releaseYear: 2011,
            titleAliases: ['シュタインズ・ゲート', '슈타인즈 게이트'],
          },
        ),
        createCandidate(
          {
            query: 'Steins;Gate 0',
            expectedType: WorkType.anime,
            provider: 'anilist',
          },
          {
            id: 'steins-gate-zero',
            releaseYear: 2018,
          },
        ),
      ],
    },
    {
      query: 'Dune',
      mediumType: WorkType.novel,
      expectedId: 'dune-novel',
      candidates: [
        createCandidate(
          {
            query: 'Dune',
            expectedType: WorkType.novel,
            provider: 'google_books',
          },
          {
            id: 'dune-novel',
            author: 'Frank Herbert',
            contributors: [{ name: 'Frank Herbert', role: 'author' }],
            releaseYear: 1965,
          },
        ),
        createCandidate(
          {
            query: 'Dune',
            expectedType: WorkType.movie,
            provider: 'tmdb',
          },
          {
            id: 'dune-movie-2021',
            author: 'Denis Villeneuve',
            contributors: [{ name: 'Denis Villeneuve', role: 'director' }],
            releaseYear: 2021,
          },
        ),
        createCandidate(
          {
            query: 'Dune Messiah',
            expectedType: WorkType.novel,
            provider: 'google_books',
          },
          {
            id: 'dune-messiah-distractor',
            releaseYear: 1969,
          },
        ),
      ],
    },
    {
      query: 'Dune Messiah',
      mediumType: WorkType.novel,
      expectedId: 'dune-messiah',
      candidates: [
        createCandidate(
          {
            query: 'Dune Messiah',
            expectedType: WorkType.novel,
            provider: 'google_books',
          },
          {
            id: 'dune-messiah',
            author: 'Frank Herbert',
            contributors: [{ name: 'Frank Herbert', role: 'author' }],
            releaseYear: 1969,
          },
        ),
        createCandidate(
          {
            query: 'Dune',
            expectedType: WorkType.novel,
            provider: 'google_books',
          },
          {
            id: 'dune-base',
            releaseYear: 1965,
          },
        ),
      ],
    },
    {
      query: '너의 이름은',
      mediumType: WorkType.anime,
      expectedId: 'your-name-anime-ko',
      candidates: [
        createCandidate(
          {
            query: '君の名は。',
            expectedType: WorkType.anime,
            provider: 'anilist',
          },
          {
            id: 'your-name-anime-ko',
            author: '신카이 마코토',
            contributors: [{ name: '신카이 마코토', role: 'director' }],
            releaseYear: 2016,
            titleAliases: ['너의 이름은', 'Your Name.'],
          },
        ),
        createCandidate(
          {
            query: '君の名は',
            expectedType: WorkType.drama,
            provider: 'tvmaze',
          },
          {
            id: 'your-name-drama',
            releaseYear: 1991,
          },
        ),
      ],
    },
    {
      query: '君の名は。',
      mediumType: WorkType.anime,
      expectedId: 'your-name-anime-ja',
      candidates: [
        createCandidate(
          {
            query: '너의 이름은',
            expectedType: WorkType.anime,
            provider: 'anilist',
          },
          {
            id: 'your-name-anime-ja',
            releaseYear: 2016,
            titleAliases: ['君の名は。', 'Your Name.'],
          },
        ),
        createCandidate(
          {
            query: '너의 이름은 드라마',
            expectedType: WorkType.drama,
            provider: 'tvmaze',
          },
          {
            id: 'your-name-drama-ja',
            releaseYear: 1991,
            titleAliases: ['君の名は'],
          },
        ),
      ],
    },
    {
      query: '오징어 게임',
      mediumType: WorkType.drama,
      expectedId: 'squid-game-drama',
      candidates: [
        createCandidate(
          {
            query: 'Squid Game',
            expectedType: WorkType.drama,
            provider: 'tmdb',
          },
          {
            id: 'squid-game-drama',
            author: '황동혁',
            contributors: [{ name: '황동혁', role: 'creator' }],
            releaseYear: 2021,
            titleAliases: ['오징어 게임'],
          },
        ),
        createCandidate(
          {
            query: '오징어 게임 챌린지',
            expectedType: WorkType.drama,
            provider: 'tvmaze',
          },
          {
            id: 'squid-game-challenge',
            releaseYear: 2023,
          },
        ),
      ],
    },
  ];

  it('keeps deterministic Quick Add QA fixtures in the top 3 without external API calls', () => {
    for (const fixture of productFixtures) {
      const ranked = rankImportCandidates({
        candidates: fixture.candidates,
        mediumType: fixture.mediumType,
        query: fixture.query,
      });

      expect(ranked.slice(0, 3).map((candidate) => candidate.id)).toContain(
        fixture.expectedId,
      );
    }
  });

  it('scores exact, normalized, alias, contributor, release year, medium, and coverage signals', () => {
    const exact = scoreImportCandidate({
      candidate: createCandidate({
        query: 'Dune',
        expectedType: WorkType.novel,
        provider: 'google_books',
      }),
      mediumType: WorkType.novel,
      query: 'Dune',
    });
    const normalized = scoreImportCandidate({
      candidate: createCandidate(
        {
          query: '君の名は。',
          expectedType: WorkType.anime,
          provider: 'anilist',
        },
        {
          releaseYear: 2016,
        },
      ),
      mediumType: WorkType.anime,
      query: '君の名は',
    });
    const alias = scoreImportCandidate({
      candidate: createCandidate(
        {
          query: '葬送のフリーレン',
          expectedType: WorkType.anime,
          provider: 'anilist',
        },
        {
          titleAliases: ['장송의 프리렌', 'Sousou no Frieren'],
        },
      ),
      mediumType: WorkType.anime,
      query: 'Sousou no Frieren',
    });
    const detailed = scoreImportCandidate({
      candidate: createCandidate(
        {
          query: 'Dune',
          expectedType: WorkType.novel,
          provider: 'google_books',
        },
        {
          author: 'Frank Herbert',
          contributors: [{ name: 'Frank Herbert', role: 'author' }],
          releaseYear: 1965,
          sourceCoverage: {
            externalIdentityCount: 3,
            providerCount: 2,
            providers: ['google_books', 'open_library'],
            releaseCandidateCount: 2,
          },
        },
      ),
      mediumType: WorkType.novel,
      query: 'Dune Frank Herbert 1965',
    });
    const wrongMedium = scoreImportCandidate({
      candidate: createCandidate(
        {
          query: 'Dune',
          expectedType: WorkType.movie,
          provider: 'tmdb',
        },
        {
          releaseYear: 2021,
        },
      ),
      mediumType: WorkType.novel,
      query: 'Dune Frank Herbert 1965',
    });

    expect(exact.breakdown).toContainEqual(
      expect.objectContaining({ label: '제목 정확히 일치' }),
    );
    expect(normalized.breakdown).toContainEqual(
      expect.objectContaining({ label: '정규화 제목 일치' }),
    );
    expect(alias.breakdown).toContainEqual(
      expect.objectContaining({ label: '별칭 제목 일치' }),
    );
    expect(detailed.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '제작자 일치' }),
        expect.objectContaining({ label: '발매연도 근접' }),
        expect.objectContaining({ label: '매체 유형 일치' }),
        expect.objectContaining({ label: '출처 2개 확인' }),
        expect.objectContaining({ label: '릴리스 후보 2개' }),
      ]),
    );
    expect(wrongMedium.breakdown).toContainEqual(
      expect.objectContaining({ label: '매체 유형 다름' }),
    );
    expect(detailed.totalScore).toBeGreaterThan(wrongMedium.totalScore);
  });

  it('keeps Wikidata below domain providers when title quality is otherwise equal', () => {
    const fixture = {
      query: '듄',
      expectedType: WorkType.novel,
      provider: 'google_books',
    };
    const googleBooks = createCandidate(fixture, {
      id: 'google-books-dune',
      sourceId: 'google_books',
      sourceLabel: 'Google Books',
      title: '듄',
    });
    const wikidata = createCandidate(fixture, {
      id: 'wikidata-dune',
      sourceId: 'wikidata',
      sourceLabel: 'Wikidata',
      title: '듄',
    });

    const ranked = rankImportCandidates({
      candidates: [wikidata, googleBooks],
      mediumType: WorkType.novel,
      query: '듄',
    });

    expect(ranked[0]).toEqual(
      expect.objectContaining({
        id: 'google-books-dune',
      }),
    );
    expect(ranked[1]).toEqual(
      expect.objectContaining({
        id: 'wikidata-dune',
      }),
    );
  });

  it('ranks exact base-title matches ahead of Korean side-story variants', () => {
    const fixture = {
      query: '전지적 독자 시점',
      expectedType: WorkType.web_novel,
      provider: 'kakao_book',
    };
    const expected = createCandidate(fixture, {
      id: 'base-title',
      releaseYear: 2018,
      title: '전지적 독자 시점',
    });
    const sideStory = createCandidate(fixture, {
      catalogMatch: {
        id: 'catalog-side-story',
        title: '전지적 독자 시점 외전',
        verificationStatus: 'verified',
      },
      confidence: 0.99,
      id: 'side-story',
      releaseYear: 2024,
      sourceCoverage: {
        externalIdentityCount: 3,
        providerCount: 2,
        providers: ['kakao_book', 'naver_book'],
        releaseCandidateCount: 2,
      },
      title: '전지적 독자 시점 외전',
    });

    const ranked = rankImportCandidates({
      candidates: [sideStory, expected],
      mediumType: WorkType.web_novel,
      query: '전지적 독자 시점',
    });

    expect(ranked[0]).toEqual(
      expect.objectContaining({
        id: 'base-title',
        title: '전지적 독자 시점',
      }),
    );
    expect(ranked[1]).toEqual(
      expect.objectContaining({
        id: 'side-story',
        reason: expect.not.stringContaining('제목 정확히 일치'),
        scoreBreakdown: expect.arrayContaining([
          expect.objectContaining({
            label: '변형판 제목 신호',
          }),
        ]),
      }),
    );
  });

  it('uses explicit medium hints when imported web entities share the same mapped type', () => {
    const fixture = {
      query: '유미의 세포들',
      expectedType: WorkType.webtoon,
      provider: 'wikidata',
    };
    const dramaAdaptation = createCandidate(fixture, {
      id: 'yumi-drama',
      title: '유미의 세포들 (드라마)',
    });
    const webtoonOriginal = createCandidate(fixture, {
      id: 'yumi-webtoon',
      title: '유미의 세포들 (웹툰)',
    });

    const ranked = rankImportCandidates({
      candidates: [dramaAdaptation, webtoonOriginal],
      mediumType: WorkType.webtoon,
      query: '유미의 세포들',
    });

    expect(ranked[0]).toEqual(
      expect.objectContaining({
        id: 'yumi-webtoon',
        scoreBreakdown: expect.arrayContaining([
          expect.objectContaining({ label: '매체 단서 일치' }),
        ]),
      }),
    );
    expect(ranked[1]).toEqual(
      expect.objectContaining({
        id: 'yumi-drama',
        scoreBreakdown: expect.arrayContaining([
          expect.objectContaining({ label: '매체 단서 충돌' }),
        ]),
      }),
    );
  });

  it('demotes cour and season variants when the query asks for the base title', () => {
    const fixture = {
      query: 'SPY x FAMILY',
      expectedType: WorkType.anime,
      provider: 'anilist',
    };
    const base = createCandidate(fixture, {
      id: 'spy-family-base',
      title: 'SPY x FAMILY',
    });
    const courVariant = createCandidate(fixture, {
      confidence: 0.99,
      id: 'spy-family-cour-2',
      title: 'SPY x FAMILY Cour 2',
    });
    const seasonVariant = createCandidate(fixture, {
      confidence: 0.98,
      id: 'spy-family-season-2',
      title: 'SPY x FAMILY Season 2',
    });

    const ranked = rankImportCandidates({
      candidates: [courVariant, seasonVariant, base],
      mediumType: WorkType.anime,
      query: 'SPY x FAMILY',
    });

    expect(ranked.map((candidate) => candidate.id)).toEqual([
      'spy-family-base',
      'spy-family-cour-2',
      'spy-family-season-2',
    ]);
    expect(ranked[1]).toEqual(
      expect.objectContaining({
        scoreBreakdown: expect.arrayContaining([
          expect.objectContaining({ label: '변형판 제목 신호' }),
        ]),
      }),
    );
  });

  it('uses Korean aliases and avoids over-promoting volume or subtitle variants', () => {
    const fixture = {
      query: '나 혼자만 레벨업',
      expectedType: WorkType.web_novel,
      provider: 'google_books',
    };
    const aliasMatch = createCandidate(fixture, {
      id: 'alias-match',
      title: 'Solo Leveling',
      titleAliases: ['나 혼자만 레벨업'],
    });
    const volumeVariant = createCandidate(fixture, {
      confidence: 0.99,
      id: 'volume-variant',
      title: '나 혼자만 레벨업 1권',
    });
    const subtitleVariant = createCandidate(fixture, {
      confidence: 0.98,
      id: 'subtitle-variant',
      title: '나 혼자만 레벨업 (외전)',
    });

    const ranked = rankImportCandidates({
      candidates: [volumeVariant, subtitleVariant, aliasMatch],
      mediumType: WorkType.web_novel,
      query: '나 혼자만 레벨업',
    });

    expect(ranked[0]).toEqual(
      expect.objectContaining({
        id: 'alias-match',
        reason: expect.stringContaining('별칭 제목 일치'),
      }),
    );
    expect(ranked.slice(1).map((candidate) => candidate.id)).toEqual([
      'volume-variant',
      'subtitle-variant',
    ]);
  });

  it('keeps exact Korean title matches in the top 3 across media types', () => {
    for (const fixture of fixtures) {
      const expected = createCandidate(fixture, {
        catalogMatch:
          fixture.provider === 'manual'
            ? null
            : {
                id: `catalog-${fixture.query}`,
                title: fixture.query,
                verificationStatus: 'verified',
              },
      });
      const variant = createCandidate(fixture, {
        confidence: 0.7,
        id: `variant-${fixture.query}`,
        title: `${fixture.query} 외전`,
      });
      const wrongMedium = createCandidate(fixture, {
        confidence: 0.95,
        id: `wrong-medium-${fixture.query}`,
        mediumType: WorkType.other,
        sourceId: 'manual',
        sourceLabel: 'Manual',
        sourceCoverage: {
          externalIdentityCount: 0,
          providerCount: 0,
          providers: [],
          releaseCandidateCount: 0,
        },
        title: fixture.query,
        type: WorkType.other,
      });

      const ranked = rankImportCandidates({
        candidates: [wrongMedium, variant, expected],
        mediumType: fixture.expectedType,
        query: fixture.query,
      });

      expect(ranked.slice(0, 3)).toContainEqual(
        expect.objectContaining({
          id: expected.id,
          mediumType: fixture.expectedType,
          title: fixture.query,
        }),
      );
      expect(ranked[0]).not.toEqual(
        expect.objectContaining({
          sourceId: 'manual',
          mediumType: WorkType.other,
        }),
      );
    }
  });
});
