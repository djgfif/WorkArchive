// Work genres are fixed top-level categories. Detailed 소재, 클리셰,
// 분위기, and personal classifications belong in personalTags; media
// distinctions such as 웹소설, 웹툰, 애니, and 만화 belong in WorkType.
export const WORK_GENRES = [
  '로맨스',
  '로판',
  '판타지',
  '현판',
  '무협',
  '액션',
  '드라마',
  '미스터리',
  '공포',
  'SF',
  '코미디',
  '학원',
  '스포츠',
  '일상',
  'BL',
  'GL',
  '기타',
] as const;

export const MAX_WORK_GENRES = 3;

export type WorkGenreValue = (typeof WORK_GENRES)[number];
export type WorkGenreLabel = WorkGenreValue;

const WORK_GENRE_SET = new Set<string>(WORK_GENRES);

export function isWorkGenre(value: string): value is WorkGenreValue {
  return WORK_GENRE_SET.has(value.trim());
}

export function normalizeWorkGenres(values: string[]): WorkGenreValue[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(isWorkGenre),
    ),
  ).slice(0, MAX_WORK_GENRES);
}

export function moveUnknownGenresToPersonalTags(
  genres: string[],
  personalTags: string[] = [],
) {
  const validGenres = Array.from(
    new Set(
      genres
        .map((genre) => genre.trim())
        .filter(isWorkGenre),
    ),
  );
  const normalizedGenres = validGenres.slice(0, MAX_WORK_GENRES);
  const normalizedGenreSet = new Set(normalizedGenres);
  const unknownGenres = genres
    .map((genre) => genre.trim())
    .filter((genre) => genre && !normalizedGenreSet.has(genre as WorkGenreValue));

  return {
    genres: normalizedGenres,
    personalTags: Array.from(
      new Set([
        ...personalTags.map((tag) => tag.trim()).filter(Boolean),
        ...unknownGenres,
      ]),
    ),
  };
}
