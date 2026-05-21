import { describe, expect, it } from 'vitest';

import {
  getProviderGroupProviders,
  providerGroupOptions,
} from './quick-add-helpers';

describe('quick-add provider groups', () => {
  it('exposes a web serialization provider group with web search providers first', () => {
    expect(providerGroupOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '웹연재',
          value: 'web_serial',
        }),
      ]),
    );
    expect(getProviderGroupProviders('web_serial')).toEqual([
      'brave_search',
      'naver_web',
      'kakao_web',
      'tavily_search',
      'kakao_book',
      'naver_book',
      'google_books',
      'wikidata',
    ]);
  });
});
