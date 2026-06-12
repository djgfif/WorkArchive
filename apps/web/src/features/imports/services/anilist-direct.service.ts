import type {
  CatalogSearchMediumType,
  ImportCandidate,
  WorkType,
} from '@work-archive/shared-types';

/**
 * AniList 공개 GraphQL API를 브라우저에서 직접 호출하는 폴백 검색.
 *
 * 서버의 /imports/search 를 사용할 수 없을 때(게스트 로컬 전용, 서버 중단 등)도
 * 애니·만화·라이트노벨·웹툰 후보에 실제 표지와 메타데이터를 채우기 위해 사용한다.
 * AniList GraphQL은 키 없이 CORS 가 열려 있는 공개 엔드포인트다.
 */

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const REQUEST_TIMEOUT_MS = 6000;

const SEARCH_DOCUMENT = `
query ($search: String!, $perPage: Int!, $withAnime: Boolean!, $withManga: Boolean!) {
  anime: Page(perPage: $perPage) @include(if: $withAnime) {
    media(search: $search, type: ANIME) {
      ...mediaFields
    }
  }
  manga: Page(perPage: $perPage) @include(if: $withManga) {
    media(search: $search, type: MANGA) {
      ...mediaFields
    }
  }
}

fragment mediaFields on Media {
  id
  format
  countryOfOrigin
  description(asHtml: false)
  episodes
  chapters
  volumes
  genres
  siteUrl
  startDate {
    year
  }
  coverImage {
    extraLarge
    large
  }
  title {
    romaji
    english
    native
  }
  synonyms
  staff(perPage: 3, sort: RELEVANCE) {
    edges {
      role
      node {
        name {
          full
        }
      }
    }
  }
}
`;

interface AniListStaffEdge {
  role?: string | null;
  node?: { name?: { full?: string | null } | null } | null;
}

interface AniListMedia {
  id: number;
  format?: string | null;
  countryOfOrigin?: string | null;
  description?: string | null;
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  genres?: Array<string | null> | null;
  siteUrl?: string | null;
  startDate?: { year?: number | null } | null;
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;
  synonyms?: Array<string | null> | null;
  staff?: { edges?: Array<AniListStaffEdge | null> | null } | null;
}

interface AniListSearchData {
  anime?: { media?: Array<AniListMedia | null> | null } | null;
  manga?: { media?: Array<AniListMedia | null> | null } | null;
}

const ANIME_MEDIUM_TYPES = new Set<CatalogSearchMediumType | WorkType>([
  'anime',
]);
const MANGA_MEDIUM_TYPES = new Set<CatalogSearchMediumType | WorkType>([
  'manga',
  'webtoon',
  'light_novel',
]);

export function isAniListSearchableMediumType(
  mediumType: CatalogSearchMediumType | WorkType | undefined,
) {
  return (
    !mediumType ||
    mediumType === 'all' ||
    ANIME_MEDIUM_TYPES.has(mediumType) ||
    MANGA_MEDIUM_TYPES.has(mediumType)
  );
}

function hasHangul(value: string) {
  return /[가-힣]/.test(value);
}

function pickDisplayTitle(media: AniListMedia, query: string) {
  const synonyms = (media.synonyms ?? []).filter(
    (synonym): synonym is string => Boolean(synonym?.trim()),
  );

  // 한글로 검색했으면 한글 표기를 우선해 보여준다.
  if (hasHangul(query)) {
    const hangulSynonym = synonyms.find((synonym) => hasHangul(synonym));

    if (hangulSynonym) {
      return hangulSynonym.trim();
    }
  }

  return (
    media.title?.english?.trim() ||
    media.title?.romaji?.trim() ||
    media.title?.native?.trim() ||
    synonyms[0]?.trim() ||
    ''
  );
}

function resolveWorkType(media: AniListMedia, isAnimePage: boolean): WorkType {
  if (isAnimePage) {
    return 'anime';
  }

  if (media.format === 'NOVEL') {
    return 'light_novel';
  }

  if (media.countryOfOrigin === 'KR') {
    return 'webtoon';
  }

  return 'manga';
}

const formatLabels: Record<string, string> = {
  MANGA: '단행본',
  MOVIE: '극장판',
  MUSIC: '뮤직 비디오',
  NOVEL: '라이트노벨',
  ONA: 'ONA',
  ONE_SHOT: '단편',
  OVA: 'OVA',
  SPECIAL: '스페셜',
  TV: 'TV 애니',
  TV_SHORT: 'TV 단편',
};

function resolveFormatLabel(media: AniListMedia) {
  if (!media.format) {
    return 'AniList 후보';
  }

  return formatLabels[media.format] ?? media.format;
}

function resolveCountLabel(media: AniListMedia, isAnimePage: boolean) {
  if (isAnimePage) {
    return media.episodes ? `${media.episodes}화` : '화수 확인 필요';
  }

  if (media.volumes) {
    return `${media.volumes}권`;
  }

  return media.chapters ? `${media.chapters}화` : '권수 확인 필요';
}

function stripDescription(description: string | null | undefined) {
  if (!description) {
    return '';
  }

  const text = description
    .replaceAll(/<br\s*\/?>/gi, ' ')
    .replaceAll(/<[^>]+>/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();

  return text.length > 280 ? `${text.slice(0, 280)}…` : text;
}

function buildContributors(media: AniListMedia) {
  const edges = media.staff?.edges ?? [];

  return edges
    .map((edge) => ({
      name: edge?.node?.name?.full?.trim() ?? '',
      role: edge?.role?.trim() || 'staff',
    }))
    .filter((contributor) => contributor.name.length > 0);
}

function buildTitleAliases(media: AniListMedia, displayTitle: string) {
  const aliases = [
    media.title?.native,
    media.title?.romaji,
    media.title?.english,
    ...(media.synonyms ?? []),
  ]
    .map((alias) => alias?.trim() ?? '')
    .filter((alias) => alias.length > 0 && alias !== displayTitle);

  return Array.from(new Set(aliases)).slice(0, 8);
}

function toImportCandidate(
  media: AniListMedia,
  query: string,
  isAnimePage: boolean,
  rankIndex: number,
): ImportCandidate | null {
  const title = pickDisplayTitle(media, query);

  if (!title || !media.id) {
    return null;
  }

  const workType = resolveWorkType(media, isAnimePage);
  const contributors = buildContributors(media);
  const confidence = Math.max(0.4, 0.9 - rankIndex * 0.08);

  return {
    author: contributors[0]?.name ?? '',
    catalogMatch: null,
    confidence,
    confidenceLabel: rankIndex === 0 ? '가장 유력' : 'AniList 후보',
    contributors,
    countLabel: resolveCountLabel(media, isAnimePage),
    description: stripDescription(media.description),
    existingRecord: null,
    externalId: `anilist:${media.id}`,
    externalRefs: [],
    formatLabel: resolveFormatLabel(media),
    franchiseName: null,
    genresText: (media.genres ?? [])
      .filter((genre): genre is string => Boolean(genre))
      .join(', '),
    id: `anilist-${isAnimePage ? 'anime' : 'manga'}-${media.id}`,
    mediumType: workType,
    note: 'AniList 공개 검색',
    reason: 'anilist-direct',
    relationsHint: [],
    releaseCandidates: [],
    releaseYear: media.startDate?.year ?? null,
    sourceId: 'anilist',
    sourceLabel: 'AniList',
    sourceUrl: media.siteUrl ?? `https://anilist.co/${isAnimePage ? 'anime' : 'manga'}/${media.id}`,
    subType: media.format ?? null,
    thumbnailUrl:
      media.coverImage?.extraLarge ?? media.coverImage?.large ?? '',
    title,
    titleAliases: buildTitleAliases(media, title),
    type: workType,
  };
}

export interface AniListDirectSearchOptions {
  limit?: number;
  mediumType?: CatalogSearchMediumType;
}

export async function searchAniListDirectCandidates(
  query: string,
  options: AniListDirectSearchOptions = {},
): Promise<ImportCandidate[]> {
  const normalizedQuery = query.trim();
  const mediumType = options.mediumType ?? 'all';

  if (!normalizedQuery || !isAniListSearchableMediumType(mediumType)) {
    return [];
  }

  const withAnime = mediumType === 'all' || ANIME_MEDIUM_TYPES.has(mediumType);
  const withManga = mediumType === 'all' || MANGA_MEDIUM_TYPES.has(mediumType);
  const perPage = Math.min(Math.max(options.limit ?? 8, 1), 10);

  const response = await fetch(ANILIST_GRAPHQL_URL, {
    body: JSON.stringify({
      query: SEARCH_DOCUMENT,
      variables: {
        perPage,
        search: normalizedQuery,
        withAnime,
        withManga,
      },
    }),
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`AniList 검색 요청이 실패했습니다 (HTTP ${response.status})`);
  }

  const payload = (await response.json()) as { data?: AniListSearchData };
  const animeMedia = payload.data?.anime?.media ?? [];
  const mangaMedia = payload.data?.manga?.media ?? [];
  const candidates: ImportCandidate[] = [];

  animeMedia.forEach((media, index) => {
    if (!media) return;
    const candidate = toImportCandidate(media, normalizedQuery, true, index);
    if (candidate) candidates.push(candidate);
  });
  mangaMedia.forEach((media, index) => {
    if (!media) return;
    const candidate = toImportCandidate(media, normalizedQuery, false, index);
    if (candidate) candidates.push(candidate);
  });

  // 만화 페이지에서 라이트노벨/웹툰 필터를 요청한 경우 결과를 좁힌다.
  if (mediumType === 'light_novel' || mediumType === 'webtoon' || mediumType === 'manga') {
    return candidates.filter((candidate) => candidate.type === mediumType);
  }

  return candidates;
}
