import type {
  CommunityBoardCategory,
  CommunityBoardPostView,
  CommunityCommentView,
  CommunityFeedResponse,
  CommunityFeedScope,
  CommunityMutationResponse,
  CommunityPostListResponse,
  CommunityPostSort,
  CommunityPostView,
  CommunityProfileView,
  CommunityReportReason,
  CommunityReviewView,
  CommunityTasteCandidate,
  CommunityTargetType,
  CommunityTrendingWorkView,
  CreateCommunityCommentRequest,
  CreateCommunityPostRequest,
  UpdateCommunityProfileRequest,
  UpsertCommunityReviewRequest,
} from '@work-archive/shared-types';

import { readStoredAuthTokens } from '@features/auth';
import {
  requestApiJson,
  requestAuthenticatedApiJson,
} from '@shared/services/api-client';

const COMMUNITY_REQUEST_TIMEOUT_MS = 12_000;

function publicOrAuthenticated<T>(path: string) {
  const init = { method: 'GET', timeoutMs: COMMUNITY_REQUEST_TIMEOUT_MS };
  return readStoredAuthTokens()
    ? requestAuthenticatedApiJson<T>(path, init)
    : requestApiJson<T>(path, init);
}

export function fetchCommunityFeed(
  sort: CommunityPostSort,
  scope: CommunityFeedScope,
  cursor?: string,
) {
  const search = new URLSearchParams({ limit: '20', scope, sort });
  if (cursor) search.set('cursor', cursor);
  return publicOrAuthenticated<CommunityFeedResponse>(
    `/community/feed?${search.toString()}`,
  );
}

export function fetchTrendingCommunityWorks() {
  return publicOrAuthenticated<CommunityTrendingWorkView[]>(
    '/community/works/trending',
  );
}

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

export function fetchCommunityBoardPosts(
  sort: CommunityPostSort,
  category?: CommunityBoardCategory,
) {
  const search = new URLSearchParams({ limit: '30', sort });
  if (category) search.set('category', category);
  return publicOrAuthenticated<CommunityPostListResponse>(
    `/community/posts?${search.toString()}`,
  );
}

export function fetchCommunityPost(postId: string) {
  return publicOrAuthenticated<CommunityBoardPostView>(
    `/community/posts/${encodeURIComponent(postId)}`,
  );
}

export function fetchCommunityReview(reviewId: string) {
  return publicOrAuthenticated<CommunityReviewView>(
    `/community/reviews/${encodeURIComponent(reviewId)}`,
  );
}

export function upsertCommunityReview(
  catalogTitleId: string,
  input: UpsertCommunityReviewRequest,
) {
  return requestAuthenticatedApiJson<CommunityReviewView>(
    `/community/reviews/${encodeURIComponent(catalogTitleId)}`,
    {
      body: JSON.stringify(input),
      method: 'PUT',
      timeoutMs: COMMUNITY_REQUEST_TIMEOUT_MS,
    },
  );
}

export function fetchCommunityComments(
  targetType: 'post' | 'review',
  targetId: string,
) {
  const search = new URLSearchParams({ targetId, targetType });
  return publicOrAuthenticated<CommunityCommentView[]>(
    `/community/comments?${search.toString()}`,
  );
}

export function publishCommunityComment(input: CreateCommunityCommentRequest) {
  return requestAuthenticatedApiJson<CommunityCommentView>(
    '/community/comments',
    {
      body: JSON.stringify(input),
      method: 'POST',
      timeoutMs: COMMUNITY_REQUEST_TIMEOUT_MS,
    },
  );
}

export function setCommunityTargetReaction(
  targetType: Exclude<CommunityTargetType, 'post'>,
  targetId: string,
  reacted: boolean,
) {
  return requestAuthenticatedApiJson<CommunityMutationResponse>(
    `/community/reactions/${targetType}/${encodeURIComponent(targetId)}`,
    {
      method: reacted ? 'DELETE' : 'PUT',
      timeoutMs: COMMUNITY_REQUEST_TIMEOUT_MS,
    },
  );
}

export function fetchCommunityProfile(handle: string) {
  return publicOrAuthenticated<CommunityProfileView>(
    `/community/profiles/${encodeURIComponent(handle)}`,
  );
}

export function updateCommunityProfile(input: UpdateCommunityProfileRequest) {
  return requestAuthenticatedApiJson<CommunityProfileView>(
    '/community/profile',
    {
      body: JSON.stringify(input),
      method: 'PATCH',
      timeoutMs: COMMUNITY_REQUEST_TIMEOUT_MS,
    },
  );
}

export function setCommunityFollow(handle: string, following: boolean) {
  return requestAuthenticatedApiJson<CommunityMutationResponse>(
    `/community/profiles/${encodeURIComponent(handle)}/follow`,
    {
      method: following ? 'DELETE' : 'PUT',
      timeoutMs: COMMUNITY_REQUEST_TIMEOUT_MS,
    },
  );
}

export function fetchCommunityTasteCandidates() {
  return requestAuthenticatedApiJson<CommunityTasteCandidate[]>(
    '/community/taste/candidates',
    { method: 'GET', timeoutMs: COMMUNITY_REQUEST_TIMEOUT_MS },
  );
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
  return reportCommunityTarget('post', postId, reason);
}

export function reportCommunityTarget(
  targetType: 'post' | 'review' | 'comment',
  targetId: string,
  reason: CommunityReportReason = 'other',
) {
  return requestAuthenticatedApiJson<CommunityMutationResponse>(
    `/community/${targetType}s/${encodeURIComponent(targetId)}/reports`,
    {
      body: JSON.stringify({ reason }),
      method: 'POST',
      timeoutMs: COMMUNITY_REQUEST_TIMEOUT_MS,
    },
  );
}
