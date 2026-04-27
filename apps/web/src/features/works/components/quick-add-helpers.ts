import type {
  CatalogSearchMediumType,
  WorkImportDraft,
  WorkRecord,
} from '@work-archive/shared-types';

import type { ImportCandidate } from '../../imports/services/imports.service';
import type { UpsertWorkInput, WorkFormValues } from '../utils/work-form';

export interface CandidateSourceCoverage {
  externalIdentityCount: number;
  providerCountLabel: string;
  providerLabels: string[];
  releaseCandidateCount: number;
  summaryLabel: string;
}

export type ProviderGroup =
  | 'all'
  | 'animation_comics'
  | 'books'
  | 'manual'
  | 'screen';

export const quickAddTypeOptions: Array<{
  label: string;
  value: CatalogSearchMediumType;
}> = [
  {
    label: '자동 선택',
    value: 'all',
  },
  {
    label: '라이트노벨',
    value: 'light_novel',
  },
  {
    label: '소설',
    value: 'novel',
  },
  {
    label: '만화',
    value: 'manga',
  },
  {
    label: '애니',
    value: 'anime',
  },
  {
    label: '영화',
    value: 'movie',
  },
  {
    label: '드라마',
    value: 'drama',
  },
  {
    label: '웹소설',
    value: 'web_novel',
  },
  {
    label: '웹툰',
    value: 'webtoon',
  },
];

export const providerGroupOptions: Array<{
  description: string;
  label: string;
  providers: string[] | null;
  value: ProviderGroup;
}> = [
  {
    description: '사용 가능한 검색 출처를 자동으로 조합합니다.',
    label: '자동 선택',
    providers: null,
    value: 'all',
  },
  {
    description:
      'Google Books, Open Library와 국내 도서 출처를 우선 사용합니다.',
    label: '도서',
    providers: [
      'google_books',
      'open_library',
      'aladin',
      'naver_book',
      'kakao_book',
    ],
    value: 'books',
  },
  {
    description: 'AniList와 도서 기반 만화 후보를 함께 확인합니다.',
    label: '애니·만화',
    providers: ['anilist', 'google_books', 'open_library'],
    value: 'animation_comics',
  },
  {
    description: '영상 출처 중심으로 후보를 모읍니다.',
    label: '영상',
    providers: ['tmdb', 'tvmaze', 'kobis'],
    value: 'screen',
  },
  {
    description: '검색 실패 시 수동 초안 후보만 확인합니다.',
    label: '직접 추가',
    providers: ['manual'],
    value: 'manual',
  },
];

export function getProviderGroupProviders(providerGroup: ProviderGroup) {
  return (
    providerGroupOptions.find((option) => option.value === providerGroup)
      ?.providers ?? null
  );
}

export function createQuickAddDefaults(
  createDefaultWorkFormValues: () => WorkFormValues,
): WorkFormValues {
  return {
    ...createDefaultWorkFormValues(),
    type: 'other',
  };
}

export function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/[^0-9a-z가-힣]+/g, '');
}

function createExternalRefKey(ref: {
  externalId: string;
  provider: string;
  rawType?: string;
}) {
  return [ref.provider, ref.rawType ?? '', ref.externalId].join(':');
}

export function isPreviewOrManualCandidate(candidate: ImportCandidate) {
  return (
    candidate.sourceId === 'preview-manual' || candidate.sourceId === 'manual'
  );
}

export function isManualProviderGroup(providerGroup: ProviderGroup) {
  return providerGroup === 'manual';
}

export function getVisibleSearchCandidates(
  candidates: ImportCandidate[],
  providerGroup: ProviderGroup,
) {
  return candidates.filter((candidate) =>
    isManualProviderGroup(providerGroup)
      ? isPreviewOrManualCandidate(candidate)
      : !isPreviewOrManualCandidate(candidate),
  );
}

function buildImportExternalRef(ref: {
  externalId: string;
  provider: string;
  rawType?: string;
  url?: string;
}) {
  return {
    externalId: ref.externalId,
    provider: ref.provider,
    ...(ref.rawType ? { rawType: ref.rawType } : {}),
    ...(ref.url ? { url: ref.url } : {}),
  };
}

export function findLikelyMatches(
  candidate: ImportCandidate,
  existingWorks: WorkRecord[],
) {
  const matchedCatalogTitleId = candidate.catalogMatch?.id ?? null;
  const candidateExternalRefKeys = new Set(
    candidate.externalRefs.map((ref) => createExternalRefKey(ref)),
  );
  const candidateTitleKeys = Array.from(
    new Set(
      [candidate.title, candidate.title.replace(/\s*\([^)]*\)\s*$/, '')]
        .map(normalizeTitle)
        .filter(Boolean),
    ),
  );

  return existingWorks.filter((work) => {
    if (
      matchedCatalogTitleId &&
      work.catalogTitleId === matchedCatalogTitleId
    ) {
      return true;
    }

    if (
      candidateExternalRefKeys.size > 0 &&
      work.importDraft?.externalRefs?.some((ref) =>
        candidateExternalRefKeys.has(createExternalRefKey(ref)),
      )
    ) {
      return true;
    }

    return candidateTitleKeys.some((key) => normalizeTitle(work.title) === key);
  });
}

export function createValuesFromCandidate(
  candidate: ImportCandidate,
  createDefaultWorkFormValues: () => WorkFormValues,
): WorkFormValues {
  return {
    ...createQuickAddDefaults(createDefaultWorkFormValues),
    author: candidate.author,
    description: candidate.description,
    genresText: candidate.genresText,
    thumbnailUrl: candidate.thumbnailUrl,
    title: candidate.title,
    type: candidate.mediumType,
  };
}

export function buildImportIdentity(
  candidate: ImportCandidate,
  input: UpsertWorkInput,
): Pick<UpsertWorkInput, 'catalogTitleId' | 'importDraft'> {
  if (candidate.catalogMatch?.id) {
    return {
      catalogTitleId: candidate.catalogMatch.id,
      importDraft: null,
    };
  }

  if (isPreviewOrManualCandidate(candidate)) {
    return {
      catalogTitleId: null,
      importDraft: null,
    };
  }

  const importDraft: WorkImportDraft = {
    mediumType: input.type,
  };

  if (candidate.franchiseName !== null) {
    importDraft.franchiseName = candidate.franchiseName;
  }

  if (candidate.subType !== null) {
    importDraft.subType = candidate.subType;
  }

  if (candidate.releaseYear !== null) {
    importDraft.releaseYear = candidate.releaseYear;
  }

  if (candidate.contributors.length > 0) {
    importDraft.contributors = candidate.contributors.map((contributor) => ({
      name: contributor.name,
    }));
  }

  if (candidate.externalRefs.length > 0) {
    importDraft.externalRefs = candidate.externalRefs.map((ref) =>
      buildImportExternalRef(ref),
    );
  }

  if (candidate.releaseCandidates.length > 0) {
    importDraft.releaseCandidates = candidate.releaseCandidates.map(
      (release) => ({
        ...(release.displayLabel ? { displayLabel: release.displayLabel } : {}),
        ...(release.externalRefs && release.externalRefs.length > 0
          ? {
              externalRefs: release.externalRefs.map((ref) =>
                buildImportExternalRef(ref),
              ),
            }
          : {}),
        isbn: release.isbn ?? null,
        releaseDate: release.releaseDate ?? null,
        ...(release.releaseType ? { releaseType: release.releaseType } : {}),
        sequence: release.sequence ?? null,
        ...(release.thumbnailUrl ? { thumbnailUrl: release.thumbnailUrl } : {}),
        ...(release.title ? { title: release.title } : {}),
      }),
    );
  }

  return {
    catalogTitleId: null,
    importDraft,
  };
}

export function getCandidateContributorText(candidate: ImportCandidate) {
  if (candidate.contributors.length > 0) {
    return candidate.contributors
      .map((contributor) => `${contributor.name} · ${contributor.role}`)
      .join(', ');
  }

  return candidate.author || '작가·제작자 미입력';
}

function getCandidateExternalIdentityCount(candidate: ImportCandidate) {
  return (
    candidate.externalRefs.length +
    candidate.releaseCandidates.reduce((count, releaseCandidate) => {
      return count + (releaseCandidate.externalRefs?.length ?? 0);
    }, 0)
  );
}

const providerDisplayLabels: Record<string, string> = {
  aladin: 'Aladin Book',
  anilist: 'AniList',
  google_books: 'Google Books',
  kakao_book: 'Kakao Book',
  kobis: 'KOBIS',
  manual: '직접 추가',
  naver_book: 'Naver Book',
  open_library: 'Open Library',
  preview_manual: '직접 추가',
  'preview-manual': '직접 추가',
  tmdb: 'TMDB',
  tvmaze: 'TVmaze',
};

function formatProviderLabel(provider: string, candidate: ImportCandidate) {
  if (provider === candidate.sourceId && candidate.sourceLabel.trim()) {
    return candidate.sourceLabel;
  }

  return (
    providerDisplayLabels[provider] ??
    provider
      .split(/[_-]/g)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ')
  );
}

export function getCandidateSourceCoverage(
  candidate: ImportCandidate,
): CandidateSourceCoverage {
  if (isPreviewOrManualCandidate(candidate)) {
    return {
      externalIdentityCount: 0,
      providerCountLabel: '직접 추가',
      providerLabels: ['직접 추가'],
      releaseCandidateCount: 0,
      summaryLabel: '입력한 제목으로 직접 기록',
    };
  }

  if (candidate.sourceCoverage) {
    const providerLabels = candidate.sourceCoverage.providers.map((provider) =>
      formatProviderLabel(provider, candidate),
    );

    return {
      externalIdentityCount: candidate.sourceCoverage.externalIdentityCount,
      providerCountLabel: `출처 ${candidate.sourceCoverage.providerCount}개`,
      providerLabels,
      releaseCandidateCount: candidate.sourceCoverage.releaseCandidateCount,
      summaryLabel: [
        `출처 ${candidate.sourceCoverage.providerCount}개`,
        `외부 식별자 ${candidate.sourceCoverage.externalIdentityCount}개`,
        `릴리스 후보 ${candidate.sourceCoverage.releaseCandidateCount}개`,
      ].join(' · '),
    };
  }

  const providerLabels = new Map<string, string>();

  if (candidate.sourceId && candidate.sourceLabel.trim()) {
    providerLabels.set(candidate.sourceId, candidate.sourceLabel);
  }

  for (const ref of candidate.externalRefs) {
    providerLabels.set(
      ref.provider,
      formatProviderLabel(ref.provider, candidate),
    );
  }

  for (const releaseCandidate of candidate.releaseCandidates) {
    for (const ref of releaseCandidate.externalRefs ?? []) {
      providerLabels.set(
        ref.provider,
        formatProviderLabel(ref.provider, candidate),
      );
    }
  }

  if (providerLabels.size === 0 && candidate.sourceLabel.trim()) {
    providerLabels.set(candidate.sourceLabel, candidate.sourceLabel);
  }

  const externalIdentityCount = getCandidateExternalIdentityCount(candidate);
  const releaseCandidateCount = candidate.releaseCandidates.length;
  const providerCount = providerLabels.size;

  return {
    externalIdentityCount,
    providerCountLabel: `출처 ${providerCount}개`,
    providerLabels: [...providerLabels.values()],
    releaseCandidateCount,
    summaryLabel: [
      `출처 ${providerCount}개`,
      `외부 식별자 ${externalIdentityCount}개`,
      `릴리스 후보 ${releaseCandidateCount}개`,
    ].join(' · '),
  };
}
