import { describe, expect, it } from 'vitest';

import { normalizeWorkGenres } from './work-genres';

describe('work-genres', () => {
  it('keeps only fixed genres while trimming and removing duplicates', () => {
    expect(
      normalizeWorkGenres([' 판타지 ', '판타지', '다크판타지', 'SF']),
    ).toEqual(['판타지', 'SF']);
  });
});
