import { WorkType } from '@prisma/client';

import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';
import { MANUAL_PROVIDER } from '../imports.constants';
import type { ProviderSearchContext } from './import-provider-adapter';
import {
  buildImportCandidate,
  getFormatLabel,
} from './import-candidate-builder';

export function searchManual({
  mediumType,
  query,
}: ProviderSearchContext): ImportCandidateResponseDto[] {
  const mediumTypes = mediumType
    ? [mediumType]
    : [
        WorkType.light_novel,
        WorkType.manga,
        WorkType.anime,
        WorkType.movie,
        WorkType.drama,
        WorkType.web_novel,
        WorkType.webtoon,
      ];

  return mediumTypes.map((type, index) =>
    buildImportCandidate({
      confidence: index === 0 ? 0.55 : 0.35,
      confidenceLabel: index === 0 ? '수동 후보' : '매체 후보',
      countLabel: '사용자 검토 필요',
      description:
        '공식 API 후보가 없거나 웹연재처럼 공개 메타데이터 API가 부족한 경우를 위한 수동 후보입니다. 스크래핑 없이 사용자가 직접 확인합니다.',
      externalId: `${query}:${type}`,
      externalRefs: [],
      formatLabel: getFormatLabel(type),
      id: `${MANUAL_PROVIDER}:${query}:${type}`,
      note: '공식 API/수동 입력만 사용하며 스크래핑하지 않습니다.',
      provider: MANUAL_PROVIDER,
      reason: '수동 입력 fallback',
      sourceLabel: 'Manual',
      title: type === mediumType ? query : `${query} (${getFormatLabel(type)})`,
      type,
    }),
  );
}
