import type {
  CatalogSearchMediumType,
  WorkImportDraft,
  WorkRecord,
} from '@work-archive/shared-types';

import type { ImportCandidate } from '@features/imports';
import { appI18n } from '@app/i18n';
import {
  parseCommaSeparatedTextList,
  type UpsertWorkInput,
  type WorkFormValues,
} from '../utils/work-form';
import { moveUnknownGenresToPersonalTags } from '../utils/work-genres';

export interface CandidateSourceCoverage {
  externalIdentityLabel: string;
  externalIdentityCount: number;
  providerCount: number;
  providerCountLabel: string;
  providerLabels: string[];
  releaseCandidateLabel: string;
  releaseCandidateCount: number;
  summaryLabel: string;
}

export type ProviderGroup =
  | 'all'
  | 'animation_comics'
  | 'books'
  | 'manual'
  | 'screen'
  | 'web_serial';

export const quickAddTypeOptions: Array<{
  label: string;
  value: CatalogSearchMediumType;
}> = [
  {
    label: appI18n.t('works.add.quickAdd.typeAll'),
    value: 'all',
  },
  {
    label: appI18n.t('works.type.light_novel'),
    value: 'light_novel',
  },
  {
    label: appI18n.t('works.type.novel'),
    value: 'novel',
  },
  {
    label: appI18n.t('works.type.manga'),
    value: 'manga',
  },
  {
    label: appI18n.t('works.type.anime'),
    value: 'anime',
  },
  {
    label: appI18n.t('works.type.movie'),
    value: 'movie',
  },
  {
    label: appI18n.t('works.type.drama'),
    value: 'drama',
  },
  {
    label: appI18n.t('works.type.web_novel'),
    value: 'web_novel',
  },
  {
    label: appI18n.t('works.type.webtoon'),
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
    description: appI18n.t('works.add.quickAdd.providerAllDescription'),
    label: appI18n.t('works.add.quickAdd.providerAllLabel'),
    providers: null,
    value: 'all',
  },
  {
    description: appI18n.t('works.add.quickAdd.providerBooksDescription'),
    label: appI18n.t('works.add.quickAdd.providerBooksLabel'),
    providers: [
      'google_books',
      'open_library',
      'wikidata',
      'aladin',
      'naver_book',
      'kakao_book',
    ],
    value: 'books',
  },
  {
    description: appI18n.t(
      'works.add.quickAdd.providerAnimationComicsDescription',
    ),
    label: appI18n.t('works.add.quickAdd.providerAnimationComicsLabel'),
    providers: ['anilist', 'google_books', 'open_library', 'wikidata'],
    value: 'animation_comics',
  },
  {
    description: appI18n.t('works.add.quickAdd.providerWebSerialDescription'),
    label: appI18n.t('works.add.quickAdd.providerWebSerialLabel'),
    providers: [
      'brave_search',
      'naver_web',
      'kakao_web',
      'tavily_search',
      'kakao_book',
      'naver_book',
      'google_books',
      'wikidata',
    ],
    value: 'web_serial',
  },
  {
    description: appI18n.t('works.add.quickAdd.providerScreenDescription'),
    label: appI18n.t('works.add.quickAdd.providerScreenLabel'),
    providers: ['tmdb', 'tvmaze', 'kobis', 'wikidata'],
    value: 'screen',
  },
  {
    description: appI18n.t('works.add.quickAdd.providerManualDescription'),
    label: appI18n.t('works.add.quickAdd.providerManualLabel'),
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
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*[[（(][^\])）]*[\])）]\s*$/u, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

function createExternalRefKey(ref: {
  externalId: string;
  provider: string;
  rawType?: string;
}) {
  return [ref.provider, ref.rawType ?? '', ref.externalId].join(':');
}

function getCandidateExternalRefKeys(candidate: ImportCandidate) {
  return new Set(
    [
      ...candidate.externalRefs,
      ...candidate.releaseCandidates.flatMap(
        (releaseCandidate) => releaseCandidate.externalRefs ?? [],
      ),
    ].map((ref) => createExternalRefKey(ref)),
  );
}

function getWorkExternalRefKeys(work: WorkRecord) {
  return new Set(
    [
      ...(work.importDraft?.externalRefs ?? []),
      ...(work.importDraft?.releaseCandidates?.flatMap(
        (releaseCandidate) => releaseCandidate.externalRefs ?? [],
      ) ?? []),
    ].map((ref) => createExternalRefKey(ref)),
  );
}

function normalizeIsbn(value: string | null | undefined) {
  const normalized = (value ?? '').replace(/[^0-9Xx]/g, '').toUpperCase();

  return normalized.length >= 10 ? normalized : '';
}

function getCandidateIsbnKeys(candidate: ImportCandidate) {
  return new Set(
    candidate.releaseCandidates
      .map((releaseCandidate) => normalizeIsbn(releaseCandidate.isbn))
      .filter(Boolean),
  );
}

function getWorkIsbnKeys(work: WorkRecord) {
  return new Set(
    (work.importDraft?.releaseCandidates ?? [])
      .map((releaseCandidate) => normalizeIsbn(releaseCandidate.isbn))
      .filter(Boolean),
  );
}

function hasAnyIntersection(left: Set<string>, right: Set<string>) {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }

  return false;
}

export function isPreviewOrManualCandidate(candidate: ImportCandidate) {
  return (
    candidate.sourceId === 'preview-manual' || candidate.sourceId === 'manual'
  );
}

export function isManualProviderGroup(providerGroup: ProviderGroup) {
  return providerGroup === 'manual';
}

export function hasWikidataSource(candidate: ImportCandidate) {
  return (
    candidate.sourceId === 'wikidata' ||
    candidate.sourceCoverage?.providers.includes('wikidata') === true ||
    candidate.externalRefs.some((ref) => ref.provider === 'wikidata') ||
    candidate.releaseCandidates.some((releaseCandidate) =>
      (releaseCandidate.externalRefs ?? []).some(
        (ref) => ref.provider === 'wikidata',
      ),
    )
  );
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

function getContributorRolePriority(
  role: string,
  mediumType: ImportCandidate['mediumType'],
) {
  const normalizedRole = role.trim().toLowerCase();

  if (mediumType === 'movie' || mediumType === 'drama') {
    const screenRolePriorities = [
      /director|연출|감독/u,
      /production company|studio|제작사|스튜디오/u,
      /creator|created by|기획|제작/u,
      /screenwriter|writer|각본|극본/u,
      /author|original|원작|저자/u,
    ];
    const matchedIndex = screenRolePriorities.findIndex((pattern) =>
      pattern.test(normalizedRole),
    );

    return matchedIndex === -1 ? screenRolePriorities.length : matchedIndex;
  }

  return 0;
}

function getCandidateContributorNames(candidate: ImportCandidate) {
  return candidate.contributors
    .map((contributor, index) => ({
      index,
      name: contributor.name.trim(),
      role: contributor.role,
    }))
    .filter((contributor) => contributor.name.length > 0)
    .sort((left, right) => {
      const priorityDelta =
        getContributorRolePriority(left.role, candidate.mediumType) -
        getContributorRolePriority(right.role, candidate.mediumType);

      return priorityDelta === 0 ? left.index - right.index : priorityDelta;
    })
    .map((contributor) => contributor.name);
}

function getOrderedCandidateContributors(candidate: ImportCandidate) {
  return candidate.contributors
    .map((contributor, index) => ({
      contributor,
      index,
    }))
    .filter(({ contributor }) => contributor.name.trim().length > 0)
    .sort((left, right) => {
      const priorityDelta =
        getContributorRolePriority(
          left.contributor.role,
          candidate.mediumType,
        ) -
        getContributorRolePriority(
          right.contributor.role,
          candidate.mediumType,
        );

      return priorityDelta === 0 ? left.index - right.index : priorityDelta;
    })
    .map(({ contributor }) => contributor);
}

export function findLikelyMatches(
  candidate: ImportCandidate,
  existingWorks: WorkRecord[],
) {
  const matchedCatalogTitleId = candidate.catalogMatch?.id ?? null;
  const candidateExternalRefKeys = getCandidateExternalRefKeys(candidate);
  const candidateIsbnKeys = getCandidateIsbnKeys(candidate);
  const candidateTitleKeys = Array.from(
    new Set(
      [
        candidate.title,
        candidate.title.replace(/\s*[[（(][^\])）]*[\])）]\s*$/u, ''),
        ...(candidate.titleAliases ?? []),
      ]
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
      hasAnyIntersection(candidateExternalRefKeys, getWorkExternalRefKeys(work))
    ) {
      return true;
    }

    if (
      candidateIsbnKeys.size > 0 &&
      hasAnyIntersection(candidateIsbnKeys, getWorkIsbnKeys(work))
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
  const defaults = createQuickAddDefaults(createDefaultWorkFormValues);
  const contributorNames = getCandidateContributorNames(candidate);
  const migratedTags = moveUnknownGenresToPersonalTags(
    parseCommaSeparatedTextList(candidate.genresText),
    parseCommaSeparatedTextList(defaults.personalTagsText),
  );

  return {
    ...defaults,
    author: candidate.author,
    creatorText: contributorNames.join(', '),
    description: candidate.description,
    seriesText: candidate.franchiseName ?? '',
    genresText: migratedTags.genres.join(', '),
    personalTagsText: migratedTags.personalTags.join(', '),
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
    return getOrderedCandidateContributors(candidate)
      .map((contributor) => `${contributor.name} · ${contributor.role}`)
      .join(', ');
  }

  return candidate.author || appI18n.t('works.add.quickAdd.authorMissing');
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
  brave_search: 'Brave Search',
  google_books: 'Google Books',
  kakao_book: 'Kakao Book',
  kakao_web: 'Kakao Web',
  kobis: 'KOBIS',
  manual: appI18n.t('works.add.quickAdd.manualProvider'),
  naver_book: 'Naver Book',
  naver_web: 'Naver Web',
  open_library: 'Open Library',
  preview_manual: appI18n.t('works.add.quickAdd.manualProvider'),
  'preview-manual': appI18n.t('works.add.quickAdd.manualProvider'),
  tavily_search: 'Tavily Search',
  tmdb: 'TMDB',
  tvmaze: 'TVmaze',
  wikidata: 'Wikidata',
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
      externalIdentityLabel: appI18n.t(
        'works.add.quickAdd.externalIdentityNone',
      ),
      externalIdentityCount: 0,
      providerCount: 0,
      providerCountLabel: appI18n.t('works.add.quickAdd.manualProvider'),
      providerLabels: [appI18n.t('works.add.quickAdd.manualProvider')],
      releaseCandidateLabel: appI18n.t(
        'works.add.quickAdd.releaseCandidateNone',
      ),
      releaseCandidateCount: 0,
      summaryLabel: appI18n.t('works.add.quickAdd.summaryManual'),
    };
  }

  if (candidate.sourceCoverage) {
    const providerLabels = candidate.sourceCoverage.providers.map((provider) =>
      formatProviderLabel(provider, candidate),
    );

    return {
      externalIdentityLabel: appI18n.t(
        'works.add.quickAdd.externalIdentityCount',
        { count: candidate.sourceCoverage.externalIdentityCount },
      ),
      externalIdentityCount: candidate.sourceCoverage.externalIdentityCount,
      providerCount: candidate.sourceCoverage.providerCount,
      providerCountLabel: appI18n.t('works.add.quickAdd.providerCount', {
        count: candidate.sourceCoverage.providerCount,
      }),
      providerLabels,
      releaseCandidateLabel: appI18n.t(
        'works.add.quickAdd.releaseCandidateCount',
        { count: candidate.sourceCoverage.releaseCandidateCount },
      ),
      releaseCandidateCount: candidate.sourceCoverage.releaseCandidateCount,
      summaryLabel: [
        appI18n.t('works.add.quickAdd.providerCount', {
          count: candidate.sourceCoverage.providerCount,
        }),
        appI18n.t('works.add.quickAdd.externalIdentityCount', {
          count: candidate.sourceCoverage.externalIdentityCount,
        }),
        appI18n.t('works.add.quickAdd.releaseCandidateCount', {
          count: candidate.sourceCoverage.releaseCandidateCount,
        }),
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
    externalIdentityLabel: appI18n.t(
      'works.add.quickAdd.externalIdentityCount',
      { count: externalIdentityCount },
    ),
    externalIdentityCount,
    providerCount,
    providerCountLabel: appI18n.t('works.add.quickAdd.providerCount', {
      count: providerCount,
    }),
    providerLabels: [...providerLabels.values()],
    releaseCandidateLabel: appI18n.t(
      'works.add.quickAdd.releaseCandidateCount',
      { count: releaseCandidateCount },
    ),
    releaseCandidateCount,
    summaryLabel: [
      appI18n.t('works.add.quickAdd.providerCount', { count: providerCount }),
      appI18n.t('works.add.quickAdd.externalIdentityCount', {
        count: externalIdentityCount,
      }),
      appI18n.t('works.add.quickAdd.releaseCandidateCount', {
        count: releaseCandidateCount,
      }),
    ].join(' · '),
  };
}
