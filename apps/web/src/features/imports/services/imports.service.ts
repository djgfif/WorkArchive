import type { WorkType } from '@work-archive/shared-types';

export interface ImportCandidate {
  author: string;
  confidenceLabel: string;
  countLabel: string;
  description: string;
  formatLabel: string;
  genresText: string;
  id: string;
  note: string;
  sourceLabel: string;
  title: string;
  type: WorkType;
}

export interface ImportSourceAdapter {
  readonly sourceId: string;
  search(query: string): ImportCandidate[];
}

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
      note: '우선 검토',
      sourceLabel: 'Imports preview seam',
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
      note: '파생 후보',
      sourceLabel: 'Imports preview seam',
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
      note: '확장 후보',
      sourceLabel: 'Imports preview seam',
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

  searchCandidates(query: string) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [];
    }

    return this.adapters.flatMap((adapter) => adapter.search(normalizedQuery));
  }
}

export const importsService = new ImportsService();
