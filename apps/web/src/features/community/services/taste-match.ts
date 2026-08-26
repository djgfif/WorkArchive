import type {
  CommunityTasteCandidate,
  CommunityTasteFingerprint,
  CommunityTasteMatchView,
  WorkRecord,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';

const WEIGHTS = {
  catalogRatings: 0.25,
  genres: 0.35,
  tags: 0.2,
  types: 0.2,
} as const;

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

function increment(target: Record<string, number>, key: string, value = 1) {
  const normalized = normalizeKey(key);
  if (normalized) target[normalized] = (target[normalized] ?? 0) + value;
}

export function buildLocalTasteFingerprint(
  works: readonly WorkRecord[],
): CommunityTasteFingerprint {
  const fingerprint: CommunityTasteFingerprint = {
    catalogRatings: {},
    genres: {},
    tags: {},
    types: {},
  };

  for (const work of works) {
    const preference = work.rating ? Math.max(0.2, work.rating / 5) : 0.5;
    increment(fingerprint.types as Record<string, number>, work.type, preference);
    for (const genre of work.genres) increment(fingerprint.genres, genre, preference);
    for (const tag of work.personalTags) increment(fingerprint.tags, tag, preference);
    if (work.catalogTitleId && work.rating) {
      fingerprint.catalogRatings[work.catalogTitleId] = work.rating;
    }
  }

  return fingerprint;
}

function cosine(left: Record<string, number>, right: Record<string, number>) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let dot = 0;
  let leftSize = 0;
  let rightSize = 0;
  for (const key of keys) {
    const a = left[key] ?? 0;
    const b = right[key] ?? 0;
    dot += a * b;
    leftSize += a * a;
    rightSize += b * b;
  }
  if (!leftSize || !rightSize) return 0;
  return dot / (Math.sqrt(leftSize) * Math.sqrt(rightSize));
}

function sharedKeys(left: Record<string, number>, right: Record<string, number>) {
  return Object.keys(left).filter((key) => key in right);
}

export function rankTasteCandidates(
  local: CommunityTasteFingerprint,
  candidates: readonly CommunityTasteCandidate[],
): CommunityTasteMatchView[] {
  return candidates
    .map((candidate) => {
      const commonWorks = sharedKeys(
        local.catalogRatings,
        candidate.fingerprint.catalogRatings,
      );
      const commonGenres = sharedKeys(local.genres, candidate.fingerprint.genres);
      const commonTags = sharedKeys(local.tags, candidate.fingerprint.tags);
      const score =
        cosine(local.genres, candidate.fingerprint.genres) * WEIGHTS.genres +
        cosine(local.catalogRatings, candidate.fingerprint.catalogRatings) *
          WEIGHTS.catalogRatings +
        cosine(
          local.types as Record<string, number>,
          candidate.fingerprint.types as Record<string, number>,
        ) * WEIGHTS.types +
        cosine(local.tags, candidate.fingerprint.tags) * WEIGHTS.tags;
      const reasons: string[] = [];
      if (commonGenres.length) {
        reasons.push(
          appI18n.t('community.tasteReasonGenre', { genre: commonGenres[0] }),
        );
      }
      if (commonWorks.length) {
        reasons.push(
          appI18n.t('community.tasteReasonWorks', {
            count: commonWorks.length,
          }),
        );
      }
      if (commonTags.length) {
        reasons.push(
          appI18n.t('community.tasteReasonTags', {
            count: commonTags.length,
          }),
        );
      }
      if (!reasons.length) reasons.push(appI18n.t('community.tasteReasonTypes'));
      return {
        author: candidate.author,
        reasons,
        score: Math.round(score * 100),
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.author.handle!.localeCompare(right.author.handle!),
    );
}
