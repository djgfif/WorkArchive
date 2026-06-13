import { describe, expect, it } from 'vitest';

import {
  getPopularWebNovelKeywords,
  getWebNovelKeywordGroups,
  getWebNovelKeywords,
} from './web-novel-keywords';

describe('web novel keyword suggestions', () => {
  it('loads built-in suggestion keywords from the active locale resource', () => {
    expect(getPopularWebNovelKeywords()).toEqual([
      '회귀',
      '빙의',
      '환생',
      '먼치킨',
      '사이다',
      '악역영애',
      '헌터',
      '피폐',
      '하렘',
      '육아',
    ]);

    expect(getWebNovelKeywordGroups()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '전개',
          keywords: expect.arrayContaining(['회귀', '빙의', '환생']),
        }),
      ]),
    );
    expect(getWebNovelKeywords()).toEqual(
      expect.arrayContaining(['회귀', '빙의', '악역영애']),
    );
  });
});
