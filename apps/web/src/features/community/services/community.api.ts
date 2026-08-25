import type {
  CommunityMutationResponse,
  CommunityPostListResponse,
  CommunityPostSort,
  CommunityPostView,
  CommunityReportReason,
  CreateCommunityPostRequest,
} from '@work-archive/shared-types';

import { readStoredAuthTokens } from '@features/auth';
import {
  requestApiJson,
  requestAuthenticatedApiJson,
} from '@shared/services/api-client';

const COMMUNITY_REQUEST_TIMEOUT_MS = 12_000;

export async function fetchCommunityPosts(
  sort: CommunityPostSort,
  cursor?: string,
) {
  const search = new URLSearchParams({ limit: '20', sort });

  if (cursor) {
    search.set('cursor', cursor);
  }

  const path = `/community/posts?${search.toString()}`;
  const init = { method: 'GET', timeoutMs: COMMUNITY_REQUEST_TIMEOUT_MS };

  return readStoredAuthTokens()
    ? requestAuthenticatedApiJson<CommunityPostListResponse>(path, init)
    : requestApiJson<CommunityPostListResponse>(path, init);
}

export function publishCommunityPost(input: CreateCommunityPostRequest) {
  return requestAuthenticatedApiJson<CommunityPostView>('/community/posts', {
    body: JSON.stringify(input),
    method: 'POST',
    timeoutMs: COMMUNITY_REQUEST_TIMEOUT_MS,
  });
}

export function deleteCommunityPost(postId: string) {
  return requestAuthenticatedApiJson<CommunityMutationResponse>(
    `/community/posts/${encodeURIComponent(postId)}`,
    { method: 'DELETE', timeoutMs: COMMUNITY_REQUEST_TIMEOUT_MS },
  );
}

export function setCommunityReaction(postId: string, reacted: boolean) {
  return requestAuthenticatedApiJson<CommunityMutationResponse>(
    `/community/posts/${encodeURIComponent(postId)}/reactions`,
    {
      method: reacted ? 'DELETE' : 'POST',
      timeoutMs: COMMUNITY_REQUEST_TIMEOUT_MS,
    },
  );
}

export function reportCommunityPost(
  postId: string,
  reason: CommunityReportReason,
) {
  return requestAuthenticatedApiJson<CommunityMutationResponse>(
    `/community/posts/${encodeURIComponent(postId)}/reports`,
    {
      body: JSON.stringify({ reason }),
      method: 'POST',
      timeoutMs: COMMUNITY_REQUEST_TIMEOUT_MS,
    },
  );
}
