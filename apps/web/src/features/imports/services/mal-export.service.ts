import type { WorkStatus, WorkType } from '@work-archive/shared-types';

import type { ExternalImportEntry } from './anilist-user-list.service';

/**
 * MyAnimeList 내보내기 XML(animelist_*.xml / mangalist_*.xml)을 파싱한다.
 * MAL 내보내기에는 표지 이미지가 없으므로 thumbnailUrl 은 비워 둔다.
 */

const animeStatusMap: Record<string, WorkStatus> = {
  Completed: 'completed',
  Dropped: 'dropped',
  'On-Hold': 'on_hold',
  'Plan to Read': 'planned',
  'Plan to Watch': 'planned',
  Reading: 'in_progress',
  Watching: 'in_progress',
};

function readText(element: Element, tagName: string) {
  return element.querySelector(tagName)?.textContent?.trim() ?? '';
}

function readNumber(element: Element, tagName: string) {
  const value = Number.parseInt(readText(element, tagName), 10);

  return Number.isFinite(value) && value > 0 ? value : null;
}

function readDate(element: Element, tagName: string) {
  const value = readText(element, tagName);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    return null;
  }

  return `${value}T00:00:00.000Z`;
}

function readRating(element: Element, tagName: string) {
  const score = readNumber(element, tagName);

  if (!score) {
    return null;
  }

  return Math.min(5, Math.max(0.5, Math.round(score) / 2));
}

function resolveMangaType(element: Element): WorkType {
  // 일부 내보내기에는 manga_media_type 또는 series_type 이 포함된다.
  const mediaType = (
    readText(element, 'manga_media_type') || readText(element, 'series_type')
  ).toLowerCase();

  if (mediaType.includes('novel')) {
    return 'light_novel';
  }

  if (mediaType.includes('manhwa') || mediaType.includes('webtoon')) {
    return 'webtoon';
  }

  return 'manga';
}

function parseAnimeElement(element: Element): ExternalImportEntry | null {
  const title = readText(element, 'series_title');

  if (!title) {
    return null;
  }

  const malId = readNumber(element, 'series_animedb_id');

  return {
    author: '',
    completedAt: readDate(element, 'my_finish_date'),
    description: '',
    externalKey: `mal:anime:${malId ?? title}`,
    progressCurrent: readNumber(element, 'my_watched_episodes'),
    progressTotal: readNumber(element, 'series_episodes'),
    progressUnit: 'episode',
    rating: readRating(element, 'my_score'),
    review: readText(element, 'my_comments'),
    sourceLabel: 'MyAnimeList',
    sourceUrl: malId ? `https://myanimelist.net/anime/${malId}` : '',
    startedAt: readDate(element, 'my_start_date'),
    status: animeStatusMap[readText(element, 'my_status')] ?? 'planned',
    thumbnailUrl: '',
    title,
    type: 'anime',
  };
}

function parseMangaElement(element: Element): ExternalImportEntry | null {
  const title = readText(element, 'manga_title');

  if (!title) {
    return null;
  }

  const malId = readNumber(element, 'manga_mangadb_id');
  const type = resolveMangaType(element);
  const progressUnit = type === 'light_novel' ? 'volume' : 'chapter';

  return {
    author: '',
    completedAt: readDate(element, 'my_finish_date'),
    description: '',
    externalKey: `mal:manga:${malId ?? title}`,
    progressCurrent:
      type === 'light_novel'
        ? (readNumber(element, 'my_read_volumes') ??
          readNumber(element, 'my_read_chapters'))
        : readNumber(element, 'my_read_chapters'),
    progressTotal:
      type === 'light_novel'
        ? (readNumber(element, 'manga_volumes') ??
          readNumber(element, 'manga_chapters'))
        : readNumber(element, 'manga_chapters'),
    progressUnit,
    rating: readRating(element, 'my_score'),
    review: readText(element, 'my_comments'),
    sourceLabel: 'MyAnimeList',
    sourceUrl: malId ? `https://myanimelist.net/manga/${malId}` : '',
    startedAt: readDate(element, 'my_start_date'),
    status: animeStatusMap[readText(element, 'my_status')] ?? 'planned',
    thumbnailUrl: '',
    title,
    type,
  };
}

export function parseMyAnimeListExportXml(
  xmlText: string,
): ExternalImportEntry[] {
  const parsed = new DOMParser().parseFromString(xmlText, 'text/xml');

  if (
    parsed.querySelector('parsererror') ||
    !parsed.querySelector('myanimelist')
  ) {
    throw new Error(
      'MyAnimeList 내보내기 XML 형식이 아닙니다. MAL의 목록 내보내기(.xml) 파일을 선택해 주세요.',
    );
  }

  const entries: ExternalImportEntry[] = [];
  const seenKeys = new Set<string>();
  const push = (entry: ExternalImportEntry | null) => {
    if (entry && !seenKeys.has(entry.externalKey)) {
      seenKeys.add(entry.externalKey);
      entries.push(entry);
    }
  };

  parsed
    .querySelectorAll('myanimelist > anime')
    .forEach((element) => push(parseAnimeElement(element)));
  parsed
    .querySelectorAll('myanimelist > manga')
    .forEach((element) => push(parseMangaElement(element)));

  return entries;
}
