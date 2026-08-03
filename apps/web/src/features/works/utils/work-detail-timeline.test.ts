import { describe, expect, it } from 'vitest';

import { getWorkRepeatCopy } from './work-detail-timeline';

describe('getWorkRepeatCopy', () => {
  it('uses one reread vocabulary for every reading medium', () => {
    const rereadCopy = getWorkRepeatCopy('novel');

    for (const type of [
      'manga',
      'light_novel',
      'web_novel',
      'webtoon',
    ] as const) {
      expect(getWorkRepeatCopy(type)).toEqual(rereadCopy);
    }
  });

  it('uses one rewatch vocabulary for every screen medium', () => {
    const rewatchCopy = getWorkRepeatCopy('anime');

    expect(getWorkRepeatCopy('movie')).toEqual(rewatchCopy);
    expect(getWorkRepeatCopy('drama')).toEqual(rewatchCopy);
  });

  it('keeps reread, rewatch, and neutral repeat copy distinct', () => {
    const rereadCopy = getWorkRepeatCopy('novel');
    const rewatchCopy = getWorkRepeatCopy('anime');
    const genericCopy = getWorkRepeatCopy('other');

    expect(rereadCopy).not.toEqual(rewatchCopy);
    expect(genericCopy).not.toEqual(rereadCopy);
    expect(genericCopy).not.toEqual(rewatchCopy);
  });
});
