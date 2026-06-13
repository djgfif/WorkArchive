import type { WorkStatus, WorkType } from '@work-archive/shared-types';

/**
 * AniList 공개 사용자 리스트를 키 없이 가져온다.
 * 비공개 리스트는 AniList 쪽에서 거부하며, 그 경우 사용자에게 안내한다.
 */

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const REQUEST_TIMEOUT_MS = 12_000;

const USER_LIST_DOCUMENT = `
query ($userName: String!, $type: MediaType!) {
  MediaListCollection(userName: $userName, type: $type) {
    lists {
      isCustomList
      entries {
        status
        score(format: POINT_10_DECIMAL)
        progress
        progressVolumes
        notes
        startedAt { year month day }
        completedAt { year month day }
        media {
          id
          format
          countryOfOrigin
          episodes
          chapters
          volumes
          description(asHtml: false)
          siteUrl
          startDate { year }
          coverImage { extraLarge large }
          title { romaji english native }
          synonyms
          staff(perPage: 2, sort: RELEVANCE) {
            edges { role node { name { full } } }
          }
        }
      }
    }
  }
}
`;

interface AniListFuzzyDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

interface AniListUserListMedia {
  id: number;
  format?: string | null;
  countryOfOrigin?: string | null;
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  description?: string | null;
  siteUrl?: string | null;
  startDate?: { year?: number | null } | null;
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;
  synonyms?: Array<string | null> | null;
  staff?: {
    edges?: Array<{
      role?: string | null;
      node?: { name?: { full?: string | null } | null } | null;
    } | null> | null;
  } | null;
}

interface AniListUserListEntry {
  status?: string | null;
  score?: number | null;
  progress?: number | null;
  progressVolumes?: number | null;
  notes?: string | null;
  startedAt?: AniListFuzzyDate | null;
  completedAt?: AniListFuzzyDate | null;
  media?: AniListUserListMedia | null;
}

/** 외부 서비스에서 가져온 기록 한 건 — 아카이브 변환 전의 중립 형태. */
export interface ExternalImportEntry {
  author: string;
  completedAt: string | null;
  description: string;
  externalKey: string;
  favorite?: boolean;
  personalTags?: string[];
  progressCurrent: number | null;
  progressTotal: number | null;
  progressUnit: 'chapter' | 'episode' | 'volume' | null;
  rating: number | null;
  review: string;
  shortReview?: string;
  sourceLabel: string;
  sourceUrl: string;
  startedAt: string | null;
  status: WorkStatus;
  thumbnailUrl: string;
  title: string;
  type: WorkType;
}

const statusMap: Record<string, WorkStatus> = {
  COMPLETED: 'completed',
  CURRENT: 'in_progress',
  DROPPED: 'dropped',
  PAUSED: 'on_hold',
  PLANNING: 'planned',
  REPEATING: 'in_progress',
};

function hasHangul(value: string) {
  return /[가-힣]/.test(value);
}

function pickKoreanPreferredTitle(media: AniListUserListMedia) {
  const synonyms = (media.synonyms ?? []).filter(
    (synonym): synonym is string => Boolean(synonym?.trim()),
  );
  const hangulSynonym = synonyms.find((synonym) => hasHangul(synonym));

  return (
    hangulSynonym?.trim() ||
    media.title?.english?.trim() ||
    media.title?.romaji?.trim() ||
    media.title?.native?.trim() ||
    ''
  );
}

function resolveWorkType(
  media: AniListUserListMedia,
  isAnime: boolean,
): WorkType {
  if (isAnime) {
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

function toIsoDate(date: AniListFuzzyDate | null | undefined) {
  if (!date?.year || !date.month || !date.day) {
    return null;
  }

  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.year}-${pad(date.month)}-${pad(date.day)}T00:00:00.000Z`;
}

function toRating(score: number | null | undefined) {
  if (!score || score <= 0) {
    return null;
  }

  const halfSteps = Math.round((score / 2) * 2) / 2;

  return Math.min(5, Math.max(0.5, halfSteps));
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

  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
}

function toExternalImportEntry(
  entry: AniListUserListEntry,
  isAnime: boolean,
): ExternalImportEntry | null {
  const media = entry.media;

  if (!media?.id) {
    return null;
  }

  const title = pickKoreanPreferredTitle(media);

  if (!title) {
    return null;
  }

  const type = resolveWorkType(media, isAnime);
  const author =
    media.staff?.edges
      ?.map((edge) => edge?.node?.name?.full?.trim() ?? '')
      .find((name) => name.length > 0) ?? '';
  const progressUnit = isAnime
    ? ('episode' as const)
    : type === 'light_novel'
      ? ('volume' as const)
      : ('chapter' as const);
  const progressCurrent =
    (type === 'light_novel' ? entry.progressVolumes : entry.progress) ??
    entry.progress ??
    null;
  const progressTotal = isAnime
    ? (media.episodes ?? null)
    : type === 'light_novel'
      ? (media.volumes ?? null)
      : (media.chapters ?? null);

  return {
    author,
    completedAt: toIsoDate(entry.completedAt),
    description: stripDescription(media.description),
    externalKey: `anilist:${isAnime ? 'anime' : 'manga'}:${media.id}`,
    progressCurrent: progressCurrent && progressCurrent > 0 ? progressCurrent : null,
    progressTotal: progressTotal && progressTotal > 0 ? progressTotal : null,
    progressUnit,
    rating: toRating(entry.score),
    review: entry.notes?.trim() ?? '',
    sourceLabel: 'AniList',
    sourceUrl: media.siteUrl ?? `https://anilist.co/${isAnime ? 'anime' : 'manga'}/${media.id}`,
    startedAt: toIsoDate(entry.startedAt),
    status: statusMap[entry.status ?? ''] ?? 'planned',
    thumbnailUrl: media.coverImage?.extraLarge ?? media.coverImage?.large ?? '',
    title,
    type,
  };
}

async function fetchUserListPage(userName: string, type: 'ANIME' | 'MANGA') {
  const response = await fetch(ANILIST_GRAPHQL_URL, {
    body: JSON.stringify({
      query: USER_LIST_DOCUMENT,
      variables: { type, userName },
    }),
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: {
      MediaListCollection?: {
        lists?: Array<{
          isCustomList?: boolean | null;
          entries?: Array<AniListUserListEntry | null> | null;
        } | null> | null;
      } | null;
    };
    errors?: Array<{ message?: string; status?: number }>;
  } | null;

  if (!response.ok || payload?.errors?.length) {
    const firstError = payload?.errors?.[0];

    if (response.status === 404 || firstError?.status === 404) {
      throw new Error(
        'AniList에서 해당 사용자명을 찾지 못했습니다. 철자를 확인해 주세요.',
      );
    }

    if (firstError?.message?.toLowerCase().includes('private')) {
      throw new Error(
        '해당 AniList 리스트가 비공개입니다. AniList 설정에서 리스트를 공개로 바꾼 뒤 다시 시도해 주세요.',
      );
    }

    throw new Error(
      `AniList 리스트를 가져오지 못했습니다 (HTTP ${response.status}).`,
    );
  }

  return payload?.data?.MediaListCollection?.lists ?? [];
}

export async function fetchAniListUserEntries(
  userName: string,
): Promise<ExternalImportEntry[]> {
  const normalizedUserName = userName.trim();

  if (!normalizedUserName) {
    return [];
  }

  const [animeLists, mangaLists] = await Promise.all([
    fetchUserListPage(normalizedUserName, 'ANIME'),
    fetchUserListPage(normalizedUserName, 'MANGA'),
  ]);
  const entries: ExternalImportEntry[] = [];
  const seenKeys = new Set<string>();
  const collect = (
    lists: Awaited<ReturnType<typeof fetchUserListPage>>,
    isAnime: boolean,
  ) => {
    for (const list of lists) {
      // 커스텀 리스트는 표준 상태 리스트와 항목이 중복된다.
      if (!list || list.isCustomList) {
        continue;
      }

      for (const rawEntry of list.entries ?? []) {
        if (!rawEntry) {
          continue;
        }

        const entry = toExternalImportEntry(rawEntry, isAnime);

        if (entry && !seenKeys.has(entry.externalKey)) {
          seenKeys.add(entry.externalKey);
          entries.push(entry);
        }
      }
    }
  };

  collect(animeLists, true);
  collect(mangaLists, false);

  return entries;
}
