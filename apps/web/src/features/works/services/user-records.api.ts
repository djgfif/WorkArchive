import type {
  RelatedCatalogTitlesResponse,
  UserRecordReleasesResponse,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';
import { requestAuthenticatedApiJson } from '@shared/services/api-client';

export type { RelatedCatalogTitlesResponse, UserRecordReleasesResponse };

export function fetchUserRecordReleases(recordId: string) {
  return requestAuthenticatedApiJson<UserRecordReleasesResponse>(
    `/user-records/${recordId}/releases`,
    {
      method: 'GET',
    },
    {
      missingTokenMessage: appI18n.t('works.errors.releasesLoginRequired'),
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
      missingTokenMessage: appI18n.t('works.errors.relatedLoginRequired'),
    },
  );
}
