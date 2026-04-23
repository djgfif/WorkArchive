import type { WorkType } from '@work-archive/shared-types';

import {
  ApiRequestError,
  requestAuthenticatedApi,
  requestAuthenticatedApiJson,
} from '../../auth/services/auth.api';

export interface ImportCandidate {
  author: string;
  confidenceLabel: string;
  countLabel: string;
  description: string;
  formatLabel: string;
  genresText: string;
  id: string;
  note: string;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
  thumbnailUrl: string;
  title: string;
  type: WorkType;
}

export interface ImportSourceAdapter {
  readonly sourceId: string;
  search(query: string): ImportCandidate[];
}

export interface ImportProviderStatus {
  configured: boolean;
  provider: 'aladin';
}

interface ImportSearchResponse {
  candidates: ImportCandidate[];
  provider: 'aladin';
  query: string;
}

interface SearchCandidatesOptions {
  limit?: number;
  type?: WorkType;
  useExternal?: boolean;
}

export interface SearchCandidatesResult {
  candidates: ImportCandidate[];
  notice: string | null;
  source: 'aladin' | 'preview-manual';
}

const ALADIN_PROVIDER_STATUS_PATH = '/imports/providers/aladin/status';
const ALADIN_PROVIDER_KEY_PATH = '/imports/providers/aladin/key';
const EXTERNAL_SEARCH_UNAVAILABLE_NOTICE =
  'Aladin 외부 검색을 사용하려면 로그인한 계정의 설정에서 TTBKey를 등록해주세요. 지금은 외부 검색이 아닌 로컬 preview 후보를 표시합니다.';

function buildPreviewCandidates(searchTerm: string): ImportCandidate[] {
  const normalizedSearchTerm = searchTerm.trim();

  return [
    {
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
    },
    {
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
    },
    {
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
    },
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
          provider: 'aladin',
          query: normalizedQuery,
          type: options.type ?? 'novel',
          limit: (options.limit ?? 10).toString(),
        });
        const response = await requestAuthenticatedApiJson<ImportSearchResponse>(
          `/imports/search?${params.toString()}`,
          {
            method: 'GET',
          },
          {
            missingTokenMessage: 'Aladin 외부 검색은 로그인 후 이용해주세요.',
          },
        );

        return {
          candidates: response.candidates,
          notice: '도서 DB 제공: 알라딘 인터넷서점(www.aladin.co.kr)',
          source: 'aladin',
        };
      } catch (error) {
        if (!this.shouldFallbackToPreview(error)) {
          throw error;
        }

        return this.searchPreviewCandidates(
          normalizedQuery,
          EXTERNAL_SEARCH_UNAVAILABLE_NOTICE,
        );
      }
    }

    return this.searchPreviewCandidates(
      normalizedQuery,
      '로그인하지 않은 상태에서는 외부 검색이 아닌 로컬 preview 후보를 표시합니다.',
    );
  }

  private searchPreviewCandidates(
    normalizedQuery: string,
    notice: string | null,
  ): SearchCandidatesResult {
    return {
      candidates: this.adapters.flatMap((adapter) => adapter.search(normalizedQuery)),
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
