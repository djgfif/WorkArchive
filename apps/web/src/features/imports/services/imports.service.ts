import type {
  CatalogSearchMediumType,
  ImportCandidate,
  ImportProviderKeyTestResponse,
  ImportSearchDiagnostics,
  ImportSearchProviderDiagnostic,
  ImportProviderStatus,
  ImportSearchResponse,
  WorkType,
} from '@work-archive/shared-types';

import { appI18n, formatAppNumber } from '@app/i18n';
import {
  ApiRequestError,
  requestApiJson,
  requestAuthenticatedApi,
  requestAuthenticatedApiJson,
} from '@shared/services/api-client';
import { readStoredAuthTokens } from '@shared/services/auth-token-store';
import {
  isAniListSearchableMediumType,
  searchAniListDirectCandidates,
  type AniListDirectSearchOptions,
} from './anilist-direct.service';

export type { ImportCandidate, ImportProviderStatus };

export interface ImportSourceAdapter {
  readonly sourceId: string;
  search(query: string): ImportCandidate[];
}

interface SearchCandidatesOptions {
  limit?: number;
  mediumType?: CatalogSearchMediumType;
  providers?: string[];
  type?: WorkType;
  useExternal?: boolean;
}

export interface SearchCandidatesResult {
  candidates: ImportCandidate[];
  diagnostics?: ImportSearchDiagnostics;
  notice: string | null;
  source: 'external' | 'preview-manual';
}

const ALADIN_PROVIDER_STATUS_PATH = '/imports/providers/aladin/status';
const ALADIN_PROVIDER_KEY_PATH = '/imports/providers/aladin/key';
const IMPORT_PROVIDERS_PATH = '/imports/providers';

const providerDisplayLabels: Record<string, string> = {
  aladin: 'Aladin Book',
  anilist: 'AniList',
  brave_search: 'Brave Search',
  google_books: 'Google Books',
  kakao_book: 'Kakao Book',
  kakao_web: 'Kakao Web',
  kobis: 'KOBIS',
  manual: appI18n.t('imports.search.manualProvider'),
  naver_book: 'Naver Book',
  naver_web: 'Naver Web',
  open_library: 'Open Library',
  tavily_search: 'Tavily Search',
  tmdb: 'TMDB',
  tvmaze: 'TVmaze',
  wikidata: 'Wikidata',
};

function formatProviderLabel(provider: string) {
  return providerDisplayLabels[provider] ?? provider;
}

function getProviderKeyPath(provider: string) {
  return `/imports/providers/${encodeURIComponent(provider)}/key`;
}

function getProviderKeyTestPath(provider: string) {
  return `/imports/providers/${encodeURIComponent(provider)}/test`;
}

function formatProviderResult(diagnostic: ImportSearchProviderDiagnostic) {
  const label = formatProviderLabel(diagnostic.provider);

  return diagnostic.status === 'searched'
    ? appI18n.t('imports.search.count', {
        count: formatAppNumber(diagnostic.resultCount),
        label,
      })
    : label;
}

function buildSearchNotice(response: ImportSearchResponse) {
  const baseNotice =
    response.providers.length > 0
      ? appI18n.t('imports.search.providerSource', {
          providers: response.providers.map(formatProviderLabel).join(', '),
        })
      : null;
  const diagnostics = response.diagnostics?.providers ?? [];

  if (diagnostics.length === 0) {
    return baseNotice;
  }

  const searched = diagnostics.filter(
    (diagnostic) => diagnostic.status === 'searched',
  );
  const skipped = diagnostics.filter(
    (diagnostic) => diagnostic.status === 'skipped',
  );
  const circuitOpen = skipped.filter(
    (diagnostic) => diagnostic.reasonCode === 'circuit_open',
  );
  const skippedWithoutCircuitOpen = skipped.filter(
    (diagnostic) => diagnostic.reasonCode !== 'circuit_open',
  );
  const hasMissingUserCredential = skippedWithoutCircuitOpen.some(
    (diagnostic) => diagnostic.reasonCode === 'user_credential_missing',
  );
  const failed = diagnostics.filter(
    (diagnostic) => diagnostic.status === 'failed',
  );
  const segments = [
    circuitOpen.length > 0
      ? appI18n.t('imports.search.providerCircuitOpen')
      : null,
    hasMissingUserCredential
      ? appI18n.t('imports.search.missingUserCredential')
      : null,
    searched.length > 0
      ? appI18n.t('imports.search.searched', {
          providers: searched.map(formatProviderResult).join(', '),
        })
      : null,
    skippedWithoutCircuitOpen.length > 0
      ? appI18n.t('imports.search.excluded', {
          providers: skippedWithoutCircuitOpen
            .map(formatProviderResult)
            .join(', '),
        })
      : null,
    failed.length > 0
      ? appI18n.t('imports.search.failed', {
          providers: failed.map(formatProviderResult).join(', '),
        })
      : null,
  ].flatMap((segment) => (segment ? [segment] : []));

  if (segments.length === 0) {
    return baseNotice;
  }

  return [baseNotice, segments.join(' · ')].filter(Boolean).join(' · ');
}

function buildPreviewCandidates(searchTerm: string): ImportCandidate[] {
  const normalizedSearchTerm = searchTerm.trim();
  const buildCandidate = (
    overrides: Partial<ImportCandidate> & {
      id: string;
      title: string;
      type: WorkType;
    },
  ): ImportCandidate => ({
    author: overrides.author ?? '',
    catalogMatch: null,
    confidence: overrides.confidence ?? 0.45,
    confidenceLabel:
      overrides.confidenceLabel ?? appI18n.t('imports.preview.candidate'),
    contributors: overrides.author
      ? [
          {
            name: overrides.author,
            role: 'author',
          },
        ]
      : [],
    countLabel:
      overrides.countLabel ?? appI18n.t('imports.preview.countReviewRequired'),
    description: overrides.description ?? '',
    externalId: overrides.externalId ?? overrides.id,
    existingRecord: null,
    externalRefs: [],
    formatLabel:
      overrides.formatLabel ?? appI18n.t('imports.preview.formatManual'),
    franchiseName: overrides.franchiseName ?? null,
    genresText: overrides.genresText ?? '',
    id: overrides.id,
    mediumType: overrides.type,
    note: overrides.note ?? appI18n.t('imports.preview.noExternalSearch'),
    reason: overrides.reason ?? 'preview fallback',
    releaseCandidates: overrides.releaseCandidates ?? [],
    relationsHint: overrides.relationsHint ?? [],
    releaseYear: overrides.releaseYear ?? null,
    sourceId: overrides.sourceId ?? 'preview-manual',
    sourceLabel: overrides.sourceLabel ?? appI18n.t('imports.preview.sourceLabel'),
    sourceUrl: overrides.sourceUrl ?? '',
    subType: overrides.subType ?? null,
    thumbnailUrl: overrides.thumbnailUrl ?? '',
    title: overrides.title,
    type: overrides.type,
  });

  return [
    buildCandidate({
      author: appI18n.t('imports.preview.authorReviewRequired'),
      confidenceLabel: appI18n.t('imports.preview.mostLikely'),
      countLabel: appI18n.t('imports.preview.volumeCountReviewRequired'),
      description:
        appI18n.t('imports.preview.descriptionCore'),
      formatLabel: appI18n.t('imports.preview.formatCore'),
      genresText: appI18n.t('imports.preview.genresCore'),
      id: `${normalizedSearchTerm}-core`,
      note: appI18n.t('imports.preview.noExternalSearch'),
      sourceId: 'preview-manual',
      sourceLabel: appI18n.t('imports.preview.sourceLabel'),
      sourceUrl: '',
      thumbnailUrl: '',
      title: normalizedSearchTerm,
      type: 'novel',
    }),
    buildCandidate({
      author: appI18n.t('imports.preview.screenAuthorReviewRequired'),
      confidenceLabel: appI18n.t('imports.preview.screenConfidence'),
      countLabel: appI18n.t('imports.preview.screenCountReviewRequired'),
      description:
        appI18n.t('imports.preview.descriptionScreen'),
      formatLabel: appI18n.t('imports.preview.formatScreen'),
      genresText: appI18n.t('imports.preview.genresScreen'),
      id: `${normalizedSearchTerm}-screen`,
      note: appI18n.t('imports.preview.noExternalSearch'),
      sourceId: 'preview-manual',
      sourceLabel: appI18n.t('imports.preview.sourceLabel'),
      sourceUrl: '',
      thumbnailUrl: '',
      title: appI18n.t('imports.preview.animeTitle', {
        title: normalizedSearchTerm,
      }),
      type: 'anime',
    }),
    buildCandidate({
      author: appI18n.t('imports.preview.serialAuthorReviewRequired'),
      confidenceLabel: appI18n.t('imports.preview.serialConfidence'),
      countLabel: appI18n.t('imports.preview.serialCountReviewRequired'),
      description:
        appI18n.t('imports.preview.descriptionSerial'),
      formatLabel: appI18n.t('imports.preview.formatSerial'),
      genresText: appI18n.t('imports.preview.genresSerial'),
      id: `${normalizedSearchTerm}-serial`,
      note: appI18n.t('imports.preview.noExternalSearch'),
      sourceId: 'preview-manual',
      sourceLabel: appI18n.t('imports.preview.sourceLabel'),
      sourceUrl: '',
      thumbnailUrl: '',
      title: appI18n.t('imports.preview.serialTitle', {
        title: normalizedSearchTerm,
      }),
      type: 'web_novel',
    }),
  ];
}

class PreviewImportsAdapter implements ImportSourceAdapter {
  readonly sourceId = 'preview-manual';

  search(query: string) {
    return buildPreviewCandidates(query);
  }
}

export class ImportsService {
  constructor(
    private readonly adapters: ImportSourceAdapter[] = [
      new PreviewImportsAdapter(),
    ],
    private readonly searchPublicDirect: (
      query: string,
      options: AniListDirectSearchOptions,
    ) => Promise<ImportCandidate[]> = searchAniListDirectCandidates,
  ) {}

  async getAladinProviderStatus() {
    return requestAuthenticatedApiJson<ImportProviderStatus>(
      ALADIN_PROVIDER_STATUS_PATH,
      {
        method: 'GET',
      },
      {
        missingTokenMessage: appI18n.t('imports.search.aladinLoginRequired'),
      },
    );
  }

  async listProviders() {
    const storedTokens = readStoredAuthTokens();

    return storedTokens
      ? requestAuthenticatedApiJson<ImportProviderStatus[]>(
          IMPORT_PROVIDERS_PATH,
          {
            method: 'GET',
          },
          {
            missingTokenMessage: appI18n.t(
              'imports.search.externalSettingsGuestReadable',
            ),
          },
        )
      : requestApiJson<ImportProviderStatus[]>(IMPORT_PROVIDERS_PATH, {
          method: 'GET',
        });
  }

  async saveAladinKey(ttbKey: string) {
    return requestAuthenticatedApiJson<ImportProviderStatus>(
      ALADIN_PROVIDER_KEY_PATH,
      {
        method: 'PUT',
        body: JSON.stringify({
          ttbKey,
        }),
      },
      {
        missingTokenMessage: appI18n.t('imports.search.aladinLoginRequired'),
      },
    );
  }

  async deleteAladinKey() {
    await requestAuthenticatedApi(
      ALADIN_PROVIDER_KEY_PATH,
      {
        method: 'DELETE',
      },
      {
        missingTokenMessage: appI18n.t('imports.search.aladinLoginRequired'),
      },
    );
  }

  async saveProviderKey(provider: string, values: Record<string, string>) {
    return requestAuthenticatedApiJson<ImportProviderStatus>(
      getProviderKeyPath(provider),
      {
        method: 'PUT',
        body: JSON.stringify({
          values,
        }),
      },
      {
        missingTokenMessage: appI18n.t(
          'imports.search.externalKeyLoginRequired',
        ),
      },
    );
  }

  async deleteProviderKey(provider: string) {
    await requestAuthenticatedApi(
      getProviderKeyPath(provider),
      {
        method: 'DELETE',
      },
      {
        missingTokenMessage: appI18n.t(
          'imports.search.externalKeyLoginRequired',
        ),
      },
    );
  }

  async testProviderKey(provider: string) {
    return requestAuthenticatedApiJson<ImportProviderKeyTestResponse>(
      getProviderKeyTestPath(provider),
      {
        method: 'POST',
      },
      {
        missingTokenMessage: appI18n.t('imports.search.testLoginRequired'),
      },
    );
  }

  async searchCandidates(
    query: string,
    options: SearchCandidatesOptions = {},
  ): Promise<SearchCandidatesResult> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return {
        candidates: [],
        notice: null,
        source: 'preview-manual',
      };
    }

    if (options.useExternal) {
      try {
        const params = new URLSearchParams({
          query: normalizedQuery,
          limit: (options.limit ?? 10).toString(),
        });

        const mediumType = options.mediumType ?? options.type;

        if (mediumType && mediumType !== 'all') {
          params.set('mediumType', mediumType);
        }

        if (options.providers && options.providers.length > 0) {
          params.set('providers', options.providers.join(','));
        }

        const path = `/imports/search?${params.toString()}`;
        const storedTokens = readStoredAuthTokens();
        const response = storedTokens
          ? await requestAuthenticatedApiJson<ImportSearchResponse>(
              path,
              {
                method: 'GET',
              },
              {
                missingTokenMessage:
                  appI18n.t('imports.search.externalSearchGuestReadable'),
              },
            )
          : await requestApiJson<ImportSearchResponse>(path, {
              method: 'GET',
            });

        return {
          candidates: response.candidates,
          ...(response.diagnostics
            ? { diagnostics: response.diagnostics }
            : {}),
          notice: buildSearchNotice(response),
          source: 'external',
        };
      } catch (error) {
        if (!this.shouldFallbackToPreview(error)) {
          throw error;
        }

        // 서버 검색이 불가능하면 키 없는 공개 출처(AniList)를 브라우저에서
        // 직접 호출해 실제 표지·메타데이터 후보를 우선 시도한다.
        const directCandidates = await this.searchPublicDirectSafely(
          normalizedQuery,
          options,
        );

        if (directCandidates.length > 0) {
          return {
            candidates: directCandidates,
            notice: appI18n.t('imports.search.publicDirectNotice'),
            source: 'external',
          };
        }

        return this.searchPreviewCandidates(
          normalizedQuery,
          appI18n.t('imports.search.externalUnavailable'),
          options.mediumType,
        );
      }
    }

    return this.searchPreviewCandidates(
      normalizedQuery,
      appI18n.t('imports.search.localPreviewNotice'),
      options.mediumType,
    );
  }

  private async searchPublicDirectSafely(
    query: string,
    options: SearchCandidatesOptions,
  ): Promise<ImportCandidate[]> {
    const mediumType = options.mediumType ?? options.type ?? 'all';

    if (!isAniListSearchableMediumType(mediumType)) {
      return [];
    }

    try {
      return await this.searchPublicDirect(query, {
        ...(options.limit !== undefined ? { limit: options.limit } : {}),
        mediumType,
      });
    } catch {
      // 공개 출처 실패는 조용히 무시하고 preview 후보로 이어간다.
      return [];
    }
  }

  private searchPreviewCandidates(
    normalizedQuery: string,
    notice: string | null,
    mediumType: CatalogSearchMediumType = 'all',
  ): SearchCandidatesResult {
    const candidates = this.adapters.flatMap((adapter) =>
      adapter.search(normalizedQuery),
    );

    return {
      candidates:
        mediumType === 'all'
          ? candidates
          : candidates.filter(
              (candidate) => candidate.mediumType === mediumType,
            ),
      notice,
      source: 'preview-manual',
    };
  }

  private shouldFallbackToPreview(error: unknown) {
    return (
      error instanceof ApiRequestError &&
      (error.status === 0 ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 502)
    );
  }
}

export const importsService = new ImportsService();
