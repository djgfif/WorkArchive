import type {
  RelatedCatalogTitlesResponse,
  UserRecordReleasesResponse,
} from '@work-archive/shared-types';

import { requestAuthenticatedApiJson } from '../../../shared/services/api-client';

export type { RelatedCatalogTitlesResponse, UserRecordReleasesResponse };

export function fetchUserRecordReleases(recordId: string) {
  return requestAuthenticatedApiJson<UserRecordReleasesResponse>(
    `/user-records/${recordId}/releases`,
    {
      method: 'GET',
    },
    {
      missingTokenMessage: '권별 기록을 불러오려면 로그인해주세요.',
    },
  );
}

export function fetchRelatedCatalogTitles(catalogTitleId: string) {
  return requestAuthenticatedApiJson<RelatedCatalogTitlesResponse>(
    `/catalog/titles/${catalogTitleId}/related`,
    {
      method: 'GET',
    },
    {
      missingTokenMessage: '관련 작품을 불러오려면 로그인해주세요.',
    },
  );
}
