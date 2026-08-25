import { describe, expect, it } from 'vitest';

import { buildLocalTasteFingerprint, rankTasteCandidates } from './taste-match';
import type { CommunityTasteCandidate, WorkRecord } from '@work-archive/shared-types';

const work = {
  catalogTitleId: 'catalog-a',
  genres: ['SF'],
  id: 'local-only-id',
  personalTags: ['우주'],
  rating: 5,
  type: 'novel',
} as WorkRecord;

describe('taste matching privacy boundary', () => {
  it('builds the same deterministic result without exposing local work ids', () => {
    const local = buildLocalTasteFingerprint([work]);
    expect(JSON.stringify(local)).not.toContain('local-only-id');

    const candidates: CommunityTasteCandidate[] = [
      {
        author: { avatarUrl: '', displayName: '아카이버', handle: 'archiver' },
        fingerprint: {
          catalogRatings: { 'catalog-a': 5 },
          genres: { sf: 1 },
          tags: { 우주: 1 },
          types: { novel: 1 },
        },
      },
    ];

    expect(rankTasteCandidates(local, candidates)).toEqual(
      rankTasteCandidates(local, candidates),
    );
    expect(rankTasteCandidates(local, candidates)[0]?.score).toBe(100);
  });
});
