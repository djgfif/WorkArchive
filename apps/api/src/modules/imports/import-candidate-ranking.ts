import type { WorkType } from '@prisma/client';

import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
import { normalizeImportTitleSignal } from './import-candidate-normalization';

interface ScoreImportCandidateInput {
  candidate: ImportCandidateResponseDto;
  mediumType?: WorkType | undefined;
  query: string;
}

interface RankImportCandidatesInput {
  candidates: ImportCandidateResponseDto[];
  mediumType?: WorkType | undefined;
  query: string;
}

interface CandidateScore {
  breakdown: Array<{
    label: string;
    weight: number;
  }>;
  totalScore: number;
}

const PROVIDER_RELIABILITY_WEIGHTS: Record<string, number> = {
  aladin: 8,
  anilist: 8,
  google_books: 5,
  kakao_book: 6,
  kobis: 7,
  manual: -12,
  naver_book: 6,
  open_library: 4,
  preview_manual: -12,
  'preview-manual': -12,
  tmdb: 8,
  tvmaze: 5,
};

export function normalizeImportTitle(value: string) {
  return normalizeImportTitleSignal(value);
}

export function scoreImportCandidate({
  candidate,
  mediumType,
  query,
}: ScoreImportCandidateInput): CandidateScore {
  const breakdown: Array<{
    label: string;
    weight: number;
  }> = [];
  const queryText = decodeBasicHtmlEntities(query).normalize('NFKC').trim();
  const titleText = decodeBasicHtmlEntities(candidate.title)
    .normalize('NFKC')
    .trim();
  const normalizedQuery = normalizeImportTitle(query);
  const normalizedTitle = normalizeImportTitle(candidate.title);
  const normalizedAliases = (candidate.titleAliases ?? [])
    .map(normalizeImportTitle)
    .filter(Boolean);
  const queryYear = parseQueryYear(query);
  const contributorMatched = hasContributorMatch(candidate, query);
  let totalScore = 0;

  if (
    queryText &&
    titleText &&
    queryText.toLowerCase() === titleText.toLowerCase()
  ) {
    totalScore += 40;
    breakdown.push({ label: '제목 정확히 일치', weight: 40 });
  } else if (
    normalizedQuery &&
    normalizedTitle &&
    normalizedQuery === normalizedTitle
  ) {
    totalScore += 34;
    breakdown.push({ label: '정규화 제목 일치', weight: 34 });
  } else if (
    normalizedQuery &&
    normalizedAliases.some((alias) => alias === normalizedQuery)
  ) {
    totalScore += 32;
    breakdown.push({ label: '별칭 제목 일치', weight: 32 });
  } else if (
    normalizedQuery &&
    normalizedTitle &&
    (normalizedTitle.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedTitle))
  ) {
    totalScore += 18;
    breakdown.push({ label: '제목 유사', weight: 18 });
  } else if (
    normalizedQuery &&
    normalizedAliases.some(
      (alias) =>
        alias.includes(normalizedQuery) || normalizedQuery.includes(alias),
    )
  ) {
    totalScore += 16;
    breakdown.push({ label: '별칭 제목 유사', weight: 16 });
  }

  if (mediumType) {
    if (candidate.mediumType === mediumType) {
      totalScore += 15;
      breakdown.push({ label: '매체 유형 일치', weight: 15 });
    } else {
      totalScore -= 20;
      breakdown.push({ label: '매체 유형 다름', weight: -20 });
    }
  }

  if (candidate.releaseYear !== null) {
    const yearWeight =
      queryYear === null
        ? 6
        : candidate.releaseYear === queryYear
          ? 14
          : Math.abs(candidate.releaseYear - queryYear) <= 1
            ? 8
            : -4;

    totalScore += yearWeight;
    breakdown.push({
      label:
        queryYear === null
          ? '발매연도 있음'
          : yearWeight > 0
            ? '발매연도 근접'
            : '발매연도 차이',
      weight: yearWeight,
    });
  }

  if (
    candidate.author.trim() ||
    candidate.contributors.some((contributor) => contributor.name.trim())
  ) {
    const contributorWeight = contributorMatched ? 12 : 6;

    totalScore += contributorWeight;
    breakdown.push({
      label: contributorMatched ? '제작자 일치' : '제작자 정보 있음',
      weight: contributorWeight,
    });
  }

  if (hasExternalIdentity(candidate)) {
    totalScore += 10;
    breakdown.push({ label: '외부 식별자 있음', weight: 10 });
  }

  if (candidate.catalogMatch) {
    totalScore += 25;
    breakdown.push({ label: '카탈로그 매칭됨', weight: 25 });
  }

  const providerWeight = PROVIDER_RELIABILITY_WEIGHTS[candidate.sourceId] ?? 0;

  if (providerWeight !== 0) {
    totalScore += providerWeight;
    breakdown.push({
      label: providerWeight > 0 ? '출처 신뢰도' : '수동 후보',
      weight: providerWeight,
    });
  }

  const providerOrderWeight = Math.max(0, candidate.confidence) * 12;

  totalScore += providerOrderWeight;
  breakdown.push({ label: '출처 내부 순위', weight: providerOrderWeight });

  return {
    breakdown: breakdown.sort((left, right) => right.weight - left.weight),
    totalScore: clampScore(totalScore),
  };
}

export function rankImportCandidates({
  candidates,
  mediumType,
  query,
}: RankImportCandidatesInput) {
  return candidates
    .map((candidate, index) => {
      const score = scoreImportCandidate({
        candidate,
        mediumType,
        query,
      });
      const confidence = Math.max(0.15, score.totalScore / 100);

      return {
        candidate: {
          ...candidate,
          confidence,
          confidenceLabel: toConfidenceLabel(confidence),
          reason:
            score.breakdown
              .filter((entry) => entry.weight > 0)
              .slice(0, 3)
              .map((entry) => entry.label)
              .join(' · ') || candidate.reason,
          scoreBreakdown: score.breakdown,
        },
        originalConfidence: candidate.confidence,
        originalIndex: index,
        score,
      };
    })
    .sort((left, right) => {
      return (
        right.score.totalScore - left.score.totalScore ||
        Number(Boolean(right.candidate.catalogMatch)) -
          Number(Boolean(left.candidate.catalogMatch)) ||
        Number(hasExternalIdentity(right.candidate)) -
          Number(hasExternalIdentity(left.candidate)) ||
        right.originalConfidence - left.originalConfidence ||
        left.originalIndex - right.originalIndex
      );
    })
    .map((entry) => entry.candidate);
}

function hasExternalIdentity(candidate: ImportCandidateResponseDto) {
  return (
    candidate.externalRefs.length > 0 ||
    candidate.releaseCandidates.some((releaseCandidate) => {
      return (releaseCandidate.externalRefs?.length ?? 0) > 0;
    })
  );
}

function parseQueryYear(query: string) {
  const match = query.match(/\b(18|19|20)\d{2}\b/);

  return match ? Number(match[0]) : null;
}

function hasContributorMatch(
  candidate: ImportCandidateResponseDto,
  query: string,
) {
  const normalizedQuery = normalizeImportTitle(query);
  const contributorSignals = [
    candidate.author,
    ...candidate.contributors.map((contributor) => contributor.name),
  ]
    .map(normalizeImportTitle)
    .filter(Boolean);

  return contributorSignals.some(
    (signal) => signal && normalizedQuery.includes(signal),
  );
}

function toConfidenceLabel(confidence: number) {
  if (confidence >= 0.82) {
    return '신뢰도 높음';
  }

  if (confidence >= 0.62) {
    return '검토 추천';
  }

  return '검토 필요';
}

function clampScore(score: number) {
  return Math.min(100, Math.max(0, score));
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
