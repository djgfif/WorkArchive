import { describe, expect, it } from '@jest/globals';

import { searchCatalogTitleIds } from '../src/modules/catalog/catalog-title-search';

interface CapturedSql {
  values: unknown[];
}

describe('searchCatalogTitleIds', () => {
  it('escapes LIKE wildcard characters in catalog search patterns', async () => {
    const calls: unknown[] = [];
    const client: Parameters<typeof searchCatalogTitleIds>[0] = {
      $queryRaw: async <T = unknown>(query: unknown) => {
        calls.push(query);

        return [] as T;
      },
    };

    await searchCatalogTitleIds(client, {
      limit: 5,
      query: 'Dune%_\\',
    });

    const query = calls[0] as CapturedSql;

    expect(query.values).toEqual(
      expect.arrayContaining([
        'dune\\%\\_\\\\%',
        '%dune\\%\\_\\\\%',
        '\\',
      ]),
    );
  });
});
