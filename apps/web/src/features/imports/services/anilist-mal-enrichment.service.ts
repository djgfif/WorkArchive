import type { ExternalImportEntry } from './anilist-user-list.service';

/**
 * MAL 내보내기에는 표지가 없으므로, MAL id 를 AniList 의 idMal 매칭으로
 * 일괄 조회해 표지·작가·한글 제목을 보강한다. 50개씩 배치 조회하므로
 * 수백 건도 요청 몇 번이면 끝난다. 실패한 배치는 건너뛰고 계속 진행한다.
 */

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const REQUEST_TIMEOUT_MS = 10_000;
const CHUNK_SIZE = 50;
const CHUNK_DELAY_MS = 350;

const ENRICHMENT_DOCUMENT = `
query ($idsMal: [Int!], $type: MediaType!) {
  Page(perPage: ${CHUNK_SIZE}) {
    media(idMal_in: $idsMal, type: $type) {
      idMal
      description(asHtml: false)
      coverImage { extraLarge large }
      title { romaji english native }
      synonyms
      staff(perPage: 2, sort: RELEVANCE) {
        edges { role node { name { full } } }
      }
    }
  }
}
`;

interface AniListEnrichmentMedia {
  idMal?: number | null;
  description?: string | null;
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

export interface MalEnrichmentResult {
  enrichedCoverCount: number;
  entries: ExternalImportEntry[];
}

const MAL_KEY_PATTERN = /^mal:(anime|manga):(\d+)$/;

function hasHangul(value: string) {
  return /[가-힣]/.test(value);
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function fetchEnrichmentChunk(
  idsMal: number[],
  type: 'ANIME' | 'MANGA',
): Promise<Map<number, AniListEnrichmentMedia>> {
  const response = await fetch(ANILIST_GRAPHQL_URL, {
    body: JSON.stringify({
      query: ENRICHMENT_DOCUMENT,
      variables: { idsMal, type },
    }),
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`AniList 매칭 요청이 실패했습니다 (HTTP ${response.status})`);
  }

  const payload = (await response.json()) as {
    data?: { Page?: { media?: Array<AniListEnrichmentMedia | null> | null } | null };
  };
  const result = new Map<number, AniListEnrichmentMedia>();

  for (const media of payload.data?.Page?.media ?? []) {
    if (media?.idMal) {
      result.set(media.idMal, media);
    }
  }

  return result;
}

function applyEnrichment(
  entry: ExternalImportEntry,
  media: AniListEnrichmentMedia,
): { entry: ExternalImportEntry; coverFilled: boolean } {
  const synonyms = (media.synonyms ?? []).filter(
    (synonym): synonym is string => Boolean(synonym?.trim()),
  );
  const hangulTitle = synonyms.find((synonym) => hasHangul(synonym))?.trim();
  const author =
    media.staff?.edges
      ?.map((edge) => edge?.node?.name?.full?.trim() ?? '')
      .find((name) => name.length > 0) ?? '';
  const coverUrl =
    media.coverImage?.extraLarge ?? media.coverImage?.large ?? '';
  const coverFilled = !entry.thumbnailUrl && Boolean(coverUrl);

  return {
    coverFilled,
    entry: {
      ...entry,
      author: entry.author || author,
      description: entry.description || stripDescription(media.description),
      thumbnailUrl: entry.thumbnailUrl || coverUrl,
      title: hangulTitle && !hasHangul(entry.title) ? hangulTitle : entry.title,
    },
  };
}

export async function enrichMalEntriesWithAniList(
  entries: ExternalImportEntry[],
): Promise<MalEnrichmentResult> {
  const malIdsByKind: Record<'ANIME' | 'MANGA', number[]> = {
    ANIME: [],
    MANGA: [],
  };

  for (const entry of entries) {
    const match = entry.externalKey.match(MAL_KEY_PATTERN);

    if (match && !entry.thumbnailUrl) {
      malIdsByKind[match[1] === 'anime' ? 'ANIME' : 'MANGA'].push(
        Number.parseInt(match[2]!, 10),
      );
    }
  }

  const mediaByKey = new Map<string, AniListEnrichmentMedia>();
  let isFirstChunk = true;

  for (const kind of ['ANIME', 'MANGA'] as const) {
    for (const ids of chunk(malIdsByKind[kind], CHUNK_SIZE)) {
      if (!isFirstChunk) {
        await sleep(CHUNK_DELAY_MS);
      }

      isFirstChunk = false;

      try {
        const chunkResult = await fetchEnrichmentChunk(ids, kind);

        for (const [idMal, media] of chunkResult) {
          mediaByKey.set(`${kind}:${idMal}`, media);
        }
      } catch {
        // 일부 배치 실패는 무시하고 매칭된 것만 보강한다.
      }
    }
  }

  if (mediaByKey.size === 0) {
    return { enrichedCoverCount: 0, entries };
  }

  let enrichedCoverCount = 0;
  const enrichedEntries = entries.map((entry) => {
    const match = entry.externalKey.match(MAL_KEY_PATTERN);

    if (!match) {
      return entry;
    }

    const media = mediaByKey.get(
      `${match[1] === 'anime' ? 'ANIME' : 'MANGA'}:${match[2]}`,
    );

    if (!media) {
      return entry;
    }

    const { coverFilled, entry: enriched } = applyEnrichment(entry, media);

    if (coverFilled) {
      enrichedCoverCount += 1;
    }

    return enriched;
  });

  return { enrichedCoverCount, entries: enrichedEntries };
}
