import type { WorkType } from '@prisma/client';

import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
import {
  normalizeDisplayText,
  normalizeImportTitleSignal,
  stripHtml,
} from './import-candidate-normalization';

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

const VARIANT_TITLE_PATTERNS = [
  /\b(collector'?s|deluxe|director'?s|extended|limited|omnibus|special|theatrical)\s+edition\b/i,
  /\b(box\s*set|complete\s+collection|director'?s\s+cut|special\s+edition)\b/i,
  /\b(vol\.?|volume|book)\s*\d+\b/i,
  /(감독판|개정판|극장판|번외편|스핀오프|시즌|외전|완전판|특별판|합본|한정판)/u,
];

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
  const queryTokens = tokenizeTitleForSearch(query);
  const titleTokens = tokenizeTitleForSearch(candidate.title);
  const normalizedAliases = (candidate.titleAliases ?? [])
    .map(normalizeImportTitle)
    .filter(Boolean);
  const aliasTokenSets = (candidate.titleAliases ?? []).map(
    tokenizeTitleForSearch,
  );
  const queryYear = parseQueryYear(query);
  const contributorMatched = hasContributorMatch(candidate, query);
  const variantTitlePenalty = getVariantTitlePenalty(candidate, query);
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
    const titleSimilarityWeight = normalizedTitle.startsWith(normalizedQuery)
      ? 18
      : 12;

    totalScore += titleSimilarityWeight;
    breakdown.push({ label: '제목 유사', weight: titleSimilarityWeight });
  } else if (
    normalizedQuery &&
    normalizedAliases.some(
      (alias) =>
        alias.includes(normalizedQuery) || normalizedQuery.includes(alias),
    )
  ) {
    totalScore += 16;
    breakdown.push({ label: '별칭 제목 유사', weight: 16 });
  } else {
    const tokenMatchWeight = getTokenMatchWeight(
      queryTokens,
      titleTokens,
      aliasTokenSets,
    );

    if (tokenMatchWeight > 0) {
      totalScore += tokenMatchWeight;
      breakdown.push({ label: '제목 토큰 일치', weight: tokenMatchWeight });
    }
  }

  if (variantTitlePenalty < 0) {
    totalScore += variantTitlePenalty;
    breakdown.push({ label: '변형판 제목 신호', weight: variantTitlePenalty });
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
    const externalIdentityWeight = Math.min(
      14,
      8 + Math.max(0, candidate.sourceCoverage.externalIdentityCount - 1) * 2,
    );

    totalScore += externalIdentityWeight;
    breakdown.push({
      label:
        candidate.sourceCoverage.externalIdentityCount > 1
          ? `외부 식별자 ${candidate.sourceCoverage.externalIdentityCount}개`
          : '외부 식별자 있음',
      weight: externalIdentityWeight,
    });
  }

  if (candidate.catalogMatch) {
    totalScore += 25;
    breakdown.push({ label: '카탈로그 매칭됨', weight: 25 });
  }

  if (candidate.sourceCoverage.providerCount > 1) {
    const sourceCoverageWeight = Math.min(
      14,
      6 + (candidate.sourceCoverage.providerCount - 2) * 4,
    );

    totalScore += sourceCoverageWeight;
    breakdown.push({
      label: `출처 ${candidate.sourceCoverage.providerCount}개 확인`,
      weight: sourceCoverageWeight,
    });
  }

  if (candidate.sourceCoverage.releaseCandidateCount > 1) {
    const releaseCoverageWeight = Math.min(
      6,
      candidate.sourceCoverage.releaseCandidateCount * 2,
    );

    totalScore += releaseCoverageWeight;
    breakdown.push({
      label: `릴리스 후보 ${candidate.sourceCoverage.releaseCandidateCount}개`,
      weight: releaseCoverageWeight,
    });
  }

  if (isWeakTitleOnlyCandidate(candidate)) {
    totalScore -= 10;
    breakdown.push({ label: '제목만 있는 약한 후보', weight: -10 });
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

function getTokenMatchWeight(
  queryTokens: string[],
  titleTokens: string[],
  aliasTokenSets: string[][],
) {
  if (queryTokens.length === 0) {
    return 0;
  }

  const titleTokenSet = new Set(titleTokens);
  const titleMatches = queryTokens.filter((token) => titleTokenSet.has(token));
  const titleMatchRatio = titleMatches.length / queryTokens.length;

  if (titleMatches.length === queryTokens.length) {
    return 14;
  }

  if (titleMatchRatio >= 0.6) {
    return 8;
  }

  const aliasMatchRatio = Math.max(
    0,
    ...aliasTokenSets.map((tokens) => {
      const tokenSet = new Set(tokens);

      return (
        queryTokens.filter((token) => tokenSet.has(token)).length /
        queryTokens.length
      );
    }),
  );

  if (aliasMatchRatio >= 1) {
    return 12;
  }

  return aliasMatchRatio >= 0.6 ? 6 : 0;
}

function tokenizeTitleForSearch(value: string) {
  return normalizeDisplayText(stripHtml(value))
    .toLowerCase()
    .replace(/\b(18|19|20)\d{2}\b/g, ' ')
    .split(/[^\p{Letter}\p{Number}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function getVariantTitlePenalty(
  candidate: ImportCandidateResponseDto,
  query: string,
) {
  const queryText = decodeBasicHtmlEntities(query).normalize('NFKC');
  const candidateSignals = [
    candidate.title,
    candidate.subType ?? '',
    candidate.formatLabel,
    candidate.countLabel,
    ...candidate.titleAliases,
  ]
    .map((value) => decodeBasicHtmlEntities(value).normalize('NFKC'))
    .join(' ');

  const queryHasVariantSignal = VARIANT_TITLE_PATTERNS.some((pattern) =>
    pattern.test(queryText),
  );
  const candidateHasVariantSignal = VARIANT_TITLE_PATTERNS.some((pattern) =>
    pattern.test(candidateSignals),
  );

  return candidateHasVariantSignal && !queryHasVariantSignal ? -24 : 0;
}

function isWeakTitleOnlyCandidate(candidate: ImportCandidateResponseDto) {
  return (
    !candidate.catalogMatch &&
    !hasExternalIdentity(candidate) &&
    candidate.releaseYear === null &&
    !candidate.author.trim() &&
    candidate.contributors.every((contributor) => !contributor.name.trim())
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
