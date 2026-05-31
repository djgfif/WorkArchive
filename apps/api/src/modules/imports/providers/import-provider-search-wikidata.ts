import type { WorkType } from '@prisma/client';

import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';
import { WIKIDATA_PROVIDER } from '../imports.constants';
import type { ProviderSearchContext } from './import-provider-adapter';
import {
  isRecord,
  readPath,
  readPathArray,
  readString,
  type UnknownRecord,
} from './import-candidate-builder';
import {
  PROVIDER_CACHE_TTL_MS,
  WIKIDATA_API_URL,
} from './import-provider-config';
import { getImportProviderCacheKey } from './import-provider-http';
import type { ImportProviderSearchRuntime } from './import-provider-search-runtime';
import {
  getWikidataHeaders,
  getWikidataSearchLanguage,
  mapWikidataEntity,
  readWikidataRelatedEntityIds,
} from './wikidata-candidate-mapper';

export async function searchWikidata(
  { limit, mediumType, query }: ProviderSearchContext,
  runtime: ImportProviderSearchRuntime,
): Promise<ImportCandidateResponseDto[]> {
  const searchUrl = new URL(WIKIDATA_API_URL);
  const language = getWikidataSearchLanguage(query);

  searchUrl.searchParams.set('action', 'wbsearchentities');
  searchUrl.searchParams.set('format', 'json');
  searchUrl.searchParams.set('language', language);
  searchUrl.searchParams.set('uselang', language);
  searchUrl.searchParams.set('type', 'item');
  searchUrl.searchParams.set('search', query);
  searchUrl.searchParams.set('limit', Math.min(limit, 10).toString());

  const responseBody = await runtime.fetchJson(searchUrl, {
    accept: 'application/json',
    cacheKey: getImportProviderCacheKey({
      limit,
      mediumType,
      provider: WIKIDATA_PROVIDER,
      query,
      variant: `search:${language}`,
    }),
    cacheTtlMs: PROVIDER_CACHE_TTL_MS,
    headers: getWikidataHeaders(),
    retryAfterMaxMs: 1_000,
  });
  const qids = Array.from(
    new Set(
      readPathArray(responseBody, ['search'])
        .map((item) =>
          isRecord(item) ? readString(item.id) || readString(item.title) : '',
        )
        .filter((id) => /^Q\d+$/u.test(id)),
    ),
  ).slice(0, Math.min(limit, 10));

  if (qids.length === 0) {
    return [];
  }

  const entityMap = await fetchWikidataEntities(
    {
      ids: qids,
      limit,
      mediumType,
      query,
      variant: 'primary',
    },
    runtime,
  );
  const relatedIds = Array.from(
    new Set(
      [...entityMap.values()].flatMap((entity) =>
        readWikidataRelatedEntityIds(entity),
      ),
    ),
  ).slice(0, 50);
  const relatedEntityMap =
    relatedIds.length > 0
      ? await fetchWikidataEntities(
          {
            ids: relatedIds,
            limit,
            mediumType,
            query,
            variant: 'related',
          },
          runtime,
        )
      : new Map<string, UnknownRecord>();

  return qids
    .map((qid, index) =>
      mapWikidataEntity({
        entity: entityMap.get(qid),
        index,
        mediumType,
        query,
        relatedEntityMap,
      }),
    )
    .filter((candidate): candidate is ImportCandidateResponseDto => {
      return candidate !== null && (!mediumType || candidate.mediumType === mediumType);
    });
}

async function fetchWikidataEntities(
  input: {
    ids: string[];
    limit: number;
    mediumType: WorkType | undefined;
    query: string;
    variant: string;
  },
  runtime: ImportProviderSearchRuntime,
) {
  const ids = Array.from(new Set(input.ids.filter((id) => /^Q\d+$/u.test(id))));
  const entityMap = new Map<string, UnknownRecord>();

  if (ids.length === 0) {
    return entityMap;
  }

  const entityUrl = new URL(WIKIDATA_API_URL);

  entityUrl.searchParams.set('action', 'wbgetentities');
  entityUrl.searchParams.set('format', 'json');
  entityUrl.searchParams.set('ids', ids.slice(0, 50).join('|'));
  entityUrl.searchParams.set(
    'props',
    'labels|descriptions|aliases|claims|sitelinks/urls',
  );
  entityUrl.searchParams.set('languages', 'ko|en|ja|mul');
  entityUrl.searchParams.set('sitefilter', 'kowiki|enwiki|jawiki');

  const responseBody = await runtime.fetchJson(entityUrl, {
    accept: 'application/json',
    cacheKey: getImportProviderCacheKey({
      limit: input.limit,
      mediumType: input.mediumType,
      provider: WIKIDATA_PROVIDER,
      query: input.query,
      variant: `entities:${input.variant}:${ids.join(',')}`,
    }),
    cacheTtlMs: PROVIDER_CACHE_TTL_MS,
    headers: getWikidataHeaders(),
    retryAfterMaxMs: 1_000,
  });
  const entities = readPath(responseBody, ['entities']);

  if (!isRecord(entities)) {
    return entityMap;
  }

  for (const id of ids) {
    const entity = entities[id];

    if (isRecord(entity) && !entity.missing) {
      entityMap.set(id, entity);
    }
  }

  return entityMap;
}
