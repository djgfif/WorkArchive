import type {
  CatalogSearchMediumType,
  ImportCandidate,
  ImportProviderStatus,
  ImportSearchResponse,
  WorkType,
} from '@work-archive/shared-types';

import {
  ApiRequestError,
  requestApiJson,
  requestAuthenticatedApi,
  requestAuthenticatedApiJson,
} from '../../../shared/services/api-client';
import { readStoredAuthTokens } from '../../auth/services/auth-storage';

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
  notice: string | null;
  source: 'external' | 'preview-manual';
}

const ALADIN_PROVIDER_STATUS_PATH = '/imports/providers/aladin/status';
const ALADIN_PROVIDER_KEY_PATH = '/imports/providers/aladin/key';
const IMPORT_PROVIDERS_PATH = '/imports/providers';
const EXTERNAL_SEARCH_UNAVAILABLE_NOTICE =
  '외부 검색 provider가 사용자 키 설정, 서버 설정, 또는 일시 오류로 사용할 수 없습니다. Aladin처럼 사용자 키가 필요한 provider는 로그인 후 TTBKey를 등록해주세요. 지금은 로컬 preview 후보를 표시합니다.';

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
    confidenceLabel: overrides.confidenceLabel ?? 'Preview 후보',
    contributors: overrides.author
      ? [
          {
            name: overrides.author,
            role: 'author',
          },
        ]
      : [],
    countLabel: overrides.countLabel ?? '사용자 검토 필요',
    description: overrides.description ?? '',
    externalId: overrides.externalId ?? overrides.id,
    existingRecord: null,
    externalRefs: [],
    formatLabel: overrides.formatLabel ?? '수동 후보',
    franchiseName: overrides.franchiseName ?? null,
    genresText: overrides.genresText ?? '',
    id: overrides.id,
    mediumType: overrides.type,
    note: overrides.note ?? '외부 검색 아님',
    reason: overrides.reason ?? 'preview fallback',
    releaseCandidates: overrides.releaseCandidates ?? [],
    relationsHint: overrides.relationsHint ?? [],
    releaseYear: overrides.releaseYear ?? null,
    sourceId: overrides.sourceId ?? 'preview-manual',
    sourceLabel: overrides.sourceLabel ?? 'Preview/manual',
    sourceUrl: overrides.sourceUrl ?? '',
    subType: overrides.subType ?? null,
    thumbnailUrl: overrides.thumbnailUrl ?? '',
    title: overrides.title,
    type: overrides.type,
  });

  return [
    buildCandidate({
      author: '작가 정보 검토 필요',
      confidenceLabel: '가장 유력',
      countLabel: '완결권수 확인 필요',
      description:
        '현재 공개 버전에서는 외부 API를 붙이지 않고 import-ready 경계만 유지합니다. 이후 source adapter가 연결되면 이 카드에 실제 메타데이터가 채워집니다.',
      formatLabel: '원작 후보',
      genresText: '드라마, 감상 기록',
      id: `${normalizedSearchTerm}-core`,
      note: '외부 검색 아님',
      sourceId: 'preview-manual',
      sourceLabel: 'Preview/manual',
      sourceUrl: '',
      thumbnailUrl: '',
      title: normalizedSearchTerm,
      type: 'novel',
    }),
    buildCandidate({
      author: '스튜디오 정보 검토 필요',
      confidenceLabel: '미디어믹스',
      countLabel: 'TV 시리즈 추정',
      description:
        '같은 제목의 영상화 후보를 구분하는 자리입니다. 실제 adapter 연결 전까지는 타입, 제작 정보, 메모 구조만 검증합니다.',
      formatLabel: '영상 후보',
      genresText: '애니, 어댑테이션',
      id: `${normalizedSearchTerm}-screen`,
      note: '외부 검색 아님',
      sourceId: 'preview-manual',
      sourceLabel: 'Preview/manual',
      sourceUrl: '',
      thumbnailUrl: '',
      title: `${normalizedSearchTerm} (애니)`,
      type: 'anime',
    }),
    buildCandidate({
      author: '연재 정보 검토 필요',
      confidenceLabel: '연재형',
      countLabel: '연재 상태 확인 필요',
      description:
        '연재형 작품 adapter를 붙일 자리를 미리 확보합니다. 권수, 연재 상태, 플랫폼 식별값은 이후 provider가 들어오면 같은 흐름으로 확장됩니다.',
      formatLabel: '연재 후보',
      genresText: '웹소설, 연재',
      id: `${normalizedSearchTerm}-serial`,
      note: '외부 검색 아님',
      sourceId: 'preview-manual',
      sourceLabel: 'Preview/manual',
      sourceUrl: '',
      thumbnailUrl: '',
      title: `${normalizedSearchTerm} (연재판)`,
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
    private readonly adapters: ImportSourceAdapter[] = [new PreviewImportsAdapter()],
  ) {}

  async getAladinProviderStatus() {
    return requestAuthenticatedApiJson<ImportProviderStatus>(
      ALADIN_PROVIDER_STATUS_PATH,
      {
        method: 'GET',
      },
      {
        missingTokenMessage: 'Aladin 검색 설정은 로그인 후 이용해주세요.',
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
            missingTokenMessage: '외부 검색 설정은 로그인 없이도 확인할 수 있습니다.',
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
        missingTokenMessage: 'Aladin 검색 설정은 로그인 후 이용해주세요.',
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
        missingTokenMessage: 'Aladin 검색 설정은 로그인 후 이용해주세요.',
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
                missingTokenMessage: '외부 검색은 로그인 없이도 사용할 수 있습니다.',
              },
            )
          : await requestApiJson<ImportSearchResponse>(path, {
              method: 'GET',
            });

        return {
          candidates: response.candidates,
          notice:
            response.providers.length > 0
              ? `검색 provider: ${response.providers.join(', ')}`
              : null,
          source: 'external',
        };
      } catch (error) {
        if (!this.shouldFallbackToPreview(error)) {
          throw error;
        }

        return this.searchPreviewCandidates(
          normalizedQuery,
          EXTERNAL_SEARCH_UNAVAILABLE_NOTICE,
          options.mediumType,
        );
      }
    }

    return this.searchPreviewCandidates(
      normalizedQuery,
      '외부 검색을 건너뛰고 로컬 preview 후보를 표시합니다.',
      options.mediumType,
    );
  }

  private searchPreviewCandidates(
    normalizedQuery: string,
    notice: string | null,
    mediumType: CatalogSearchMediumType = 'all',
  ): SearchCandidatesResult {
    const candidates = this.adapters.flatMap((adapter) => adapter.search(normalizedQuery));

    return {
      candidates:
        mediumType === 'all'
          ? candidates
          : candidates.filter((candidate) => candidate.mediumType === mediumType),
      notice,
      source: 'preview-manual',
    };
  }

  private shouldFallbackToPreview(error: unknown) {
    return (
      error instanceof ApiRequestError &&
      (error.status === 401 || error.status === 403 || error.status === 502)
    );
  }
}

export const importsService = new ImportsService();
