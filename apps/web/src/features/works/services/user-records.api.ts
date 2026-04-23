import type {
  ProgressUnit,
  RecordingUnit,
  UserReleaseRecord,
  WorkType,
} from '@work-archive/shared-types';

import { requestAuthenticatedApiJson } from '../../auth/services/auth.api';

export interface CatalogReleaseWithUserRecord {
  id: string;
  releaseType: string;
  displayLabel: string;
  title: string;
  sequence: number | null;
  isbn: string | null;
  releaseDate: string | null;
  summary: string;
  thumbnailUrl: string;
  userReleaseRecord: UserReleaseRecord | null;
}

export interface UserRecordReleasePolicy {
  recordingUnit: RecordingUnit;
  mediumType: WorkType;
  releaseRecordsSupported: boolean;
  progressOnly: boolean;
  defaultProgressUnit: ProgressUnit | null;
  webPartSplitEnabled: boolean;
}

export interface UserRecordReleasesResponse {
  policy: UserRecordReleasePolicy;
  releases: CatalogReleaseWithUserRecord[];
}

export interface RelatedCatalogTitle {
  id: string;
  title: string;
  mediumType: WorkType;
  subType: string | null;
  releaseYear: number | null;
  thumbnailUrl: string;
  franchise: {
    id: string;
    name: string;
  } | null;
  relationDirection?: 'incoming' | 'outgoing' | null;
  relationType?: string | null;
}

export interface RelatedCatalogRelation {
  relationDirection: 'incoming' | 'outgoing';
  relationType: string;
  targetTitle: RelatedCatalogTitle;
}

export interface RelatedCatalogTitlesResponse {
  catalogTitleId: string;
  currentTitle: {
    id: string;
    displayTitle: string;
    mediumType: WorkType;
    subType: string | null;
    releaseYear: number | null;
    thumbnailUrl: string;
    franchise: {
      id: string;
      name: string;
      canonicalName: string;
    } | null;
  };
  sameFranchiseTitles: RelatedCatalogTitle[];
  relations: RelatedCatalogRelation[];
}

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
