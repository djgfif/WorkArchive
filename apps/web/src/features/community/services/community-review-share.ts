import type { UpsertCommunityReviewRequest, WorkRecord } from '@work-archive/shared-types';

export interface CommunityReviewDraft {
  body: string;
  rating: number;
  spoiler: boolean;
}

export function createCommunityReviewDraft(work: WorkRecord): CommunityReviewDraft {
  return {
    body: work.shortReview || work.review || '',
    rating: work.rating ?? 0,
    spoiler: false,
  };
}

export function buildCommunityReviewRequest(
  draft: CommunityReviewDraft,
): UpsertCommunityReviewRequest {
  return {
    body: draft.body.trim(),
    rating: draft.rating || null,
    spoiler: draft.spoiler,
  };
}
