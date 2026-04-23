import { ProgressUnit, WorkType } from '@prisma/client';

export const RECORDING_UNIT = 'catalog_title' as const;

export const VOLUME_RECORDABLE_TYPES = [
  WorkType.novel,
  WorkType.light_novel,
  WorkType.manga,
] as const;

export const PROGRESS_ONLY_TYPES = [
  WorkType.anime,
  WorkType.drama,
  WorkType.web_novel,
  WorkType.webtoon,
] as const;

export const TITLE_SEPARATE_TYPES = [
  WorkType.anime,
  WorkType.drama,
  WorkType.web_novel,
  WorkType.webtoon,
  WorkType.movie,
] as const;

export function canCreateReleaseRecord(type: WorkType) {
  return VOLUME_RECORDABLE_TYPES.includes(type as (typeof VOLUME_RECORDABLE_TYPES)[number]);
}

export function getDefaultProgressUnit(type: WorkType): ProgressUnit | null {
  if (type === WorkType.anime || type === WorkType.drama) {
    return ProgressUnit.episode;
  }

  if (type === WorkType.web_novel || type === WorkType.webtoon) {
    return ProgressUnit.chapter;
  }

  if (canCreateReleaseRecord(type)) {
    return ProgressUnit.volume;
  }

  return null;
}

export function canUseProgressUnit(type: WorkType, unit: ProgressUnit) {
  if (type === WorkType.anime || type === WorkType.drama) {
    return unit === ProgressUnit.episode;
  }

  if (type === WorkType.web_novel || type === WorkType.webtoon) {
    return unit === ProgressUnit.chapter;
  }

  if (canCreateReleaseRecord(type)) {
    return unit === ProgressUnit.volume || unit === ProgressUnit.chapter;
  }

  return false;
}

export function isWebPartSplitEnabled(type: WorkType) {
  return type !== WorkType.web_novel && type !== WorkType.webtoon;
}
