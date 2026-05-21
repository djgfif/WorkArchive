import { WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import type { ImportCandidateResponseDto } from '../src/modules/imports/dto/import-candidate-response.dto';
import { rankImportCandidates } from '../src/modules/imports/import-candidate-ranking';

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
  { query: '눈먼 자들의 도시', expectedType: WorkType.novel, provider: 'aladin' },
  { query: '파과', expectedType: WorkType.novel, provider: 'aladin' },
  { query: '달러구트 꿈 백화점', expectedType: WorkType.novel, provider: 'aladin' },
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
  { query: '강철의 연금술사', expectedType: WorkType.manga, provider: 'anilist' },
  { query: '주술회전', expectedType: WorkType.manga, provider: 'anilist' },
  { query: '너의 이름은', expectedType: WorkType.anime, provider: 'anilist' },
  { query: '스즈메의 문단속', expectedType: WorkType.anime, provider: 'anilist' },
  { query: '센과 치히로의 행방불명', expectedType: WorkType.anime, provider: 'anilist' },
  { query: '에반게리온', expectedType: WorkType.anime, provider: 'anilist' },
  { query: '슈타인즈 게이트', expectedType: WorkType.anime, provider: 'anilist' },
  { query: '진격의 거인 애니메이션', expectedType: WorkType.anime, provider: 'anilist' },
  { query: '너에게 닿기를', expectedType: WorkType.anime, provider: 'anilist' },
  { query: '바이올렛 에버가든', expectedType: WorkType.anime, provider: 'anilist' },
  { query: '소드 아트 온라인', expectedType: WorkType.light_novel, provider: 'aladin' },
  { query: 'Re:제로부터 시작하는 이세계 생활', expectedType: WorkType.light_novel, provider: 'aladin' },
  { query: '어떤 마술의 금서목록', expectedType: WorkType.light_novel, provider: 'aladin' },
  { query: '스즈미야 하루히의 우울', expectedType: WorkType.light_novel, provider: 'aladin' },
  { query: '전지적 독자 시점', expectedType: WorkType.web_novel, provider: 'kakao_book' },
  { query: '나 혼자만 레벨업', expectedType: WorkType.web_novel, provider: 'kakao_book' },
  { query: '화산귀환', expectedType: WorkType.web_novel, provider: 'kakao_book' },
  { query: '재벌집 막내아들', expectedType: WorkType.web_novel, provider: 'kakao_book' },
  { query: '상수리나무 아래', expectedType: WorkType.web_novel, provider: 'kakao_book' },
  { query: '외모지상주의', expectedType: WorkType.webtoon, provider: 'naver_book' },
  { query: '신의 탑', expectedType: WorkType.webtoon, provider: 'naver_book' },
  { query: '유미의 세포들', expectedType: WorkType.webtoon, provider: 'naver_book' },
  { query: '이태원 클라쓰', expectedType: WorkType.webtoon, provider: 'naver_book' },
  { query: '연의 편지', expectedType: WorkType.webtoon, provider: 'naver_book' },
  { query: '기생충', expectedType: WorkType.movie, provider: 'tmdb' },
  { query: '헤어질 결심', expectedType: WorkType.movie, provider: 'tmdb' },
  { query: '올드보이', expectedType: WorkType.movie, provider: 'kobis' },
  { query: '부산행', expectedType: WorkType.movie, provider: 'kobis' },
  { query: '오징어 게임', expectedType: WorkType.drama, provider: 'tmdb' },
  { query: '이상한 변호사 우영우', expectedType: WorkType.drama, provider: 'tmdb' },
  { query: '미스터 션샤인', expectedType: WorkType.drama, provider: 'tmdb' },
  { query: '슬기로운 의사생활', expectedType: WorkType.drama, provider: 'tmdb' },
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
