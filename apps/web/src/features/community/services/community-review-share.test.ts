import { describe, expect, it } from 'vitest';
import type { WorkRecord } from '@work-archive/shared-types';

import { buildCommunityReviewRequest, createCommunityReviewDraft } from './community-review-share';

describe('explicit community review sharing', () => {
  it('copies only editable public fields and never local ids or private notes', () => {
    const work = {
      id: 'private-local-id',
      catalogTitleId: 'catalog-id',
      rating: 4.5,
      review: '비공개 장문 메모',
      shortReview: '공개 전에 편집할 감상',
      personalTags: ['비공개 태그'],
    } as WorkRecord;
    const draft = createCommunityReviewDraft(work);
    const request = buildCommunityReviewRequest(draft);

    expect(request).toEqual({ body: '공개 전에 편집할 감상', rating: 4.5, spoiler: false });
    expect(JSON.stringify(request)).not.toContain('private-local-id');
    expect(request).not.toHaveProperty('catalogTitleId');
    expect(request).not.toHaveProperty('personalTags');
  });

  it('does not change an existing public draft when the local record changes', () => {
    const work = { rating: 4, review: '', shortReview: '처음 감상' } as WorkRecord;
    const draft = createCommunityReviewDraft(work);
    work.rating = 1;
    work.shortReview = '나중 개인 기록';
    expect(draft).toEqual({ body: '처음 감상', rating: 4, spoiler: false });
  });
});
