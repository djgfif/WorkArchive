import { WorkType } from '@prisma/client';

import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';
import {
  ANILIST_PROVIDER,
  KOBIS_PROVIDER,
  TMDB_PROVIDER,
  TVMAZE_PROVIDER,
} from '../imports.constants';
import {
  buildImportCandidate,
  getFormatLabel,
  normalizeWhitespace,
  parseYear,
  stripHtml,
} from './import-candidate-builder';
import {
  isRecord,
  readPathArray,
  readPathNumber,
  readString,
  readStringArray,
} from './import-candidate-readers';

export function mapAniListItem(
  item: unknown,
  index: number,
  mediaType: string,
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  const titleObject = isRecord(item.title) ? item.title : {};
  const title =
    readString(titleObject.english) ||
    readString(titleObject.romaji) ||
    readString(titleObject.native);
  const titleAliases = [
    readString(titleObject.english),
    readString(titleObject.romaji),
    readString(titleObject.native),
  ].filter(Boolean);

  if (!title) {
    return null;
  }

  const format = readString(item.format);
  const type =
    mediaType === 'ANIME'
      ? WorkType.anime
      : format === 'NOVEL'
        ? WorkType.light_novel
        : WorkType.manga;
  const studios = readPathArray(item, ['studios', 'nodes'])
    .map((studio) => (isRecord(studio) ? readString(studio.name) : ''))
    .filter(Boolean);
  const staff = readPathArray(item, ['staff', 'nodes'])
    .map((person) =>
      isRecord(person) && isRecord(person.name)
        ? readString(person.name.full)
        : '',
    )
    .filter(Boolean);
  const contributors = [...studios, ...staff].slice(0, 4);

  return buildImportCandidate({
    author: contributors.join(', '),
    confidence: index === 0 ? 0.82 : 0.64,
    confidenceLabel: index === 0 ? 'AniList 상위' : 'AniList 후보',
    countLabel: format || 'AniList media',
    description: normalizeWhitespace(readString(item.description)),
    externalId: readString(item.id),
    formatLabel: getFormatLabel(type),
    id: `${ANILIST_PROVIDER}:${readString(item.id)}`,
    note: 'AniList GraphQL public API',
    provider: ANILIST_PROVIDER,
    reason: 'AniList 제목 검색 결과',
    releaseYear: readPathNumber(item, ['startDate', 'year']),
    sourceLabel: 'AniList',
    sourceUrl: `https://anilist.co/${mediaType === 'ANIME' ? 'anime' : 'manga'}/${readString(item.id)}`,
    subType: format ? format.toLowerCase() : null,
    thumbnailUrl: isRecord(item.coverImage)
      ? readString(item.coverImage.large)
      : '',
    title,
    titleAliases,
    type,
  });
}

export function mapTvMazeItem(
  item: unknown,
  index: number,
): ImportCandidateResponseDto | null {
  if (!isRecord(item) || !isRecord(item.show)) {
    return null;
  }

  const show = item.show;
  const title = readString(show.name);

  if (!title) {
    return null;
  }

  const image = isRecord(show.image) ? show.image : {};

  return buildImportCandidate({
    confidence: index === 0 ? 0.7 : 0.52,
    confidenceLabel: index === 0 ? 'TVmaze 상위' : 'TVmaze 후보',
    countLabel: readString(show.premiered) || 'TV series',
    description: normalizeWhitespace(stripHtml(readString(show.summary))),
    externalId: readString(show.id),
    formatLabel: '드라마/TV',
    genresText: readStringArray(show.genres).join(', '),
    id: `${TVMAZE_PROVIDER}:${readString(show.id)}`,
    note: 'TVmaze public API',
    provider: TVMAZE_PROVIDER,
    reason: 'TVmaze 쇼 검색 결과',
    releaseYear: parseYear(readString(show.premiered)),
    sourceLabel: 'TVmaze',
    sourceUrl: readString(show.url),
    thumbnailUrl: readString(image.medium) || readString(image.original),
    title,
    type: WorkType.drama,
  });
}

export function mapTmdbItem(
  item: unknown,
  index: number,
  rawType: 'movie' | 'tv',
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  const title =
    rawType === 'movie' ? readString(item.title) : readString(item.name);
  const originalTitle =
    rawType === 'movie'
      ? readString(item.original_title)
      : readString(item.original_name);

  if (!title) {
    return null;
  }

  const date =
    rawType === 'movie'
      ? readString(item.release_date)
      : readString(item.first_air_date);
  const posterPath = readString(item.poster_path);
  const type = rawType === 'movie' ? WorkType.movie : WorkType.drama;

  return buildImportCandidate({
    confidence: index === 0 ? 0.78 : 0.58,
    confidenceLabel: index === 0 ? 'TMDB 상위' : 'TMDB 후보',
    countLabel: date || 'TMDB',
    description: normalizeWhitespace(readString(item.overview)),
    externalId: readString(item.id),
    formatLabel: getFormatLabel(type),
    id: `${TMDB_PROVIDER}:${rawType}:${readString(item.id)}`,
    note: 'TMDB API',
    provider: TMDB_PROVIDER,
    reason: 'TMDB 제목 검색 결과',
    rawType,
    releaseYear: parseYear(date),
    sourceLabel: 'TMDB',
    sourceUrl: `https://www.themoviedb.org/${rawType}/${readString(item.id)}`,
    thumbnailUrl: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : '',
    title,
    titleAliases: [title, originalTitle].filter(Boolean),
    type,
  });
}

export function mapKobisMovieItem(
  item: unknown,
  index: number,
): ImportCandidateResponseDto | null {
  if (!isRecord(item)) {
    return null;
  }

  const title = readString(item.movieNm);

  if (!title) {
    return null;
  }

  return buildImportCandidate({
    author: readString(item.directors),
    confidence: index === 0 ? 0.75 : 0.55,
    confidenceLabel: index === 0 ? 'KOBIS 상위' : 'KOBIS 후보',
    countLabel:
      [readString(item.openDt), readString(item.repNationNm)]
        .filter(Boolean)
        .join(' · ') || 'KOBIS movie',
    externalId: readString(item.movieCd) || title,
    formatLabel: '영화',
    id: `${KOBIS_PROVIDER}:${readString(item.movieCd) || title}`,
    note: 'KOBIS Open API',
    provider: KOBIS_PROVIDER,
    reason: 'KOBIS 영화명 검색 결과',
    releaseYear: parseYear(readString(item.prdtYear) || readString(item.openDt)),
    sourceLabel: 'KOBIS',
    title,
    type: WorkType.movie,
  });
}
