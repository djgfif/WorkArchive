import type { WorkType } from '@prisma/client';

import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';

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
  reasons: string[];
  totalScore: number;
}

const MANUAL_SOURCE_IDS = new Set(['manual', 'preview-manual']);

export function normalizeImportTitle(value: string) {
  return decodeBasicHtmlEntities(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|（[^）]*）|【[^】]*】|「[^」]*」|『[^』]*』/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

export function scoreImportCandidate({
  candidate,
  mediumType,
  query,
}: ScoreImportCandidateInput): CandidateScore {
  const reasons: Array<{
    label: string;
    weight: number;
  }> = [];
  const queryText = decodeBasicHtmlEntities(query).normalize('NFKC').trim();
  const titleText = decodeBasicHtmlEntities(candidate.title).normalize('NFKC').trim();
  const normalizedQuery = normalizeImportTitle(query);
  const normalizedTitle = normalizeImportTitle(candidate.title);
  let totalScore = 0;

  if (queryText && titleText && queryText.toLowerCase() === titleText.toLowerCase()) {
    totalScore += 40;
    reasons.push({ label: '제목 정확히 일치', weight: 40 });
  } else if (
    normalizedQuery &&
    normalizedTitle &&
    normalizedQuery === normalizedTitle
  ) {
    totalScore += 34;
    reasons.push({ label: '정규화 제목 일치', weight: 34 });
  } else if (
    normalizedQuery &&
    normalizedTitle &&
    (normalizedTitle.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedTitle))
  ) {
    totalScore += 18;
    reasons.push({ label: '제목 유사', weight: 18 });
  }

  if (mediumType) {
    if (candidate.mediumType === mediumType) {
      totalScore += 15;
      reasons.push({ label: '매체 유형 일치', weight: 15 });
    } else {
      totalScore -= 20;
      reasons.push({ label: '매체 유형 다름', weight: -20 });
    }
  }

  if (candidate.releaseYear !== null) {
    totalScore += 6;
    reasons.push({ label: '발매연도 있음', weight: 6 });
  }

  if (
    candidate.author.trim() ||
    candidate.contributors.some((contributor) => contributor.name.trim())
  ) {
    totalScore += 6;
    reasons.push({ label: '제작자 정보 있음', weight: 6 });
  }

  if (hasExternalIdentity(candidate)) {
    totalScore += 10;
    reasons.push({ label: '외부 식별자 있음', weight: 10 });
  }

  if (candidate.catalogMatch) {
    totalScore += 25;
    reasons.push({ label: '카탈로그 매칭됨', weight: 25 });
  }

  totalScore += Math.max(0, candidate.confidence) * 20;

  if (MANUAL_SOURCE_IDS.has(candidate.sourceId)) {
    totalScore -= 12;
    reasons.push({ label: '수동 후보', weight: -12 });
  }

  return {
    reasons: reasons
      .sort((left, right) => right.weight - left.weight)
      .map((reason) => reason.label),
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
          reason: score.reasons.slice(0, 3).join(' · ') || candidate.reason,
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
