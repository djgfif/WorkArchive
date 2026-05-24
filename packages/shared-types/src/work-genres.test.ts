import { describe, expect, it } from 'vitest';

import {
  moveUnknownGenresToPersonalTags,
  normalizeWorkGenres,
} from './index';

describe('work genre taxonomy', () => {
  it('keeps only representative genres while trimming and removing duplicates', () => {
    expect(
      normalizeWorkGenres([' 판타지 ', '판타지', '다크판타지', 'SF']),
    ).toEqual(['판타지', 'SF']);
  });

  it('keeps at most three representative genres', () => {
    expect(
      normalizeWorkGenres(['판타지', '로맨스', '드라마', '액션']),
    ).toEqual(['판타지', '로맨스', '드라마']);
  });

  it('moves unknown and overflow genre values into personal tags', () => {
    expect(
      moveUnknownGenresToPersonalTags(
        [' 회귀 ', '판타지', '빙의', '판타지', '로맨스', '드라마', '액션'],
        ['빙의', '완결까지'],
      ),
    ).toEqual({
      genres: ['판타지', '로맨스', '드라마'],
      personalTags: ['빙의', '완결까지', '회귀', '액션'],
    });
  });
});
