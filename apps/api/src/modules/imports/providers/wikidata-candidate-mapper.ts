import { WorkType } from '@prisma/client';

import type { CatalogExternalRefInput } from '../../catalog/catalog-ingestion.service';
import {
  normalizeImportTitleSignal,
  normalizeIsbn,
} from '../candidates/import-candidate-normalization';
import type { ImportCandidateResponseDto } from '../dto/import-candidate-response.dto';
import { WIKIDATA_PROVIDER } from '../imports.constants';
import {
  WIKIDATA_CLAIM_MAPPINGS,
  WIKIDATA_USER_AGENT,
  WIKIDATA_WORK_TYPE_QIDS,
} from './import-provider-config';
import {
  buildExternalRefUrl,
  buildImportCandidate,
  dedupeRawExternalRefs,
  getFormatLabel,
  parseYear,
  uniqueNonEmpty,
} from './import-candidate-builder';
import {
  isRecord,
  readNumber,
  readPath,
  readString,
  type UnknownRecord,
} from './import-candidate-readers';

export function getWikidataHeaders() {
  return {
    'User-Agent': WIKIDATA_USER_AGENT,
  };
}

export function getWikidataSearchLanguage(query: string) {
  if (/[가-힣]/u.test(query)) {
    return 'ko';
  }

  if (/[\u3040-\u30ff]/u.test(query)) {
    return 'ja';
  }

  return 'en';
}

export function readWikidataRelatedEntityIds(entity: UnknownRecord) {
  return [
    ...Object.keys(WIKIDATA_CLAIM_MAPPINGS.contributor),
    ...WIKIDATA_CLAIM_MAPPINGS.franchise,
    ...WIKIDATA_CLAIM_MAPPINGS.partOf,
  ].flatMap((property) =>
    readWikidataClaims(entity, property).flatMap((claim) => {
      const entityId = readWikidataClaimEntityId(claim);

      return entityId ? [entityId] : [];
    }),
  );
}

export function mapWikidataEntity({
  entity,
  index,
  mediumType,
  query,
  relatedEntityMap,
}: {
  entity: UnknownRecord | undefined;
  index: number;
  mediumType: WorkType | undefined;
  query: string;
  relatedEntityMap: Map<string, UnknownRecord>;
}): ImportCandidateResponseDto | null {
  if (!entity) {
    return null;
  }

  const qid = readString(entity.id);

  if (!/^Q\d+$/u.test(qid)) {
    return null;
  }

  const labels = readWikidataMultilingualValues(entity.labels);
  const aliases = readWikidataAliases(entity.aliases);
  const title = labels[0] ?? aliases[0] ?? qid;

  if (!title) {
    return null;
  }

  const type = mediumType ?? inferWikidataWorkType(entity);
  const sourceUrl = `https://www.wikidata.org/wiki/${qid}`;
  const wikipediaUrl = readWikidataSitelinkUrl(entity.sitelinks);
  const externalRefs = dedupeRawExternalRefs([
    {
      externalId: qid,
      provider: WIKIDATA_PROVIDER,
      rawType: 'entity',
      url: sourceUrl,
    },
    ...(wikipediaUrl
      ? [
          {
            externalId: wikipediaUrl,
            provider: 'wikipedia',
            rawType: 'article',
            url: wikipediaUrl,
          },
        ]
      : []),
    ...readWikidataExternalRefs(entity),
  ]);
  const franchiseName = readWikidataRelatedLabel(
    entity,
    WIKIDATA_CLAIM_MAPPINGS.franchise,
    relatedEntityMap,
  );
  const relationsHint = readWikidataRelations(entity, relatedEntityMap);
  const releaseYear = readWikidataReleaseYear(entity);
  const confidence = calculateWikidataConfidence({
    aliases: [...labels, ...aliases],
    index,
    query,
    title,
  });
  const isbns = readWikidataIsbns(entity);

  return buildImportCandidate({
    confidence,
    confidenceLabel:
      confidence >= 0.72
        ? 'Wikidata 상위'
        : confidence >= 0.58
          ? 'Wikidata 후보'
          : 'Wikidata 검토 필요',
    contributors: readWikidataContributors(entity, relatedEntityMap),
    countLabel: releaseYear ? `${releaseYear}` : 'Wikidata entity',
    description: readWikidataMultilingualValues(entity.descriptions)[0] ?? '',
    externalId: qid,
    externalRefs,
    formatLabel: getFormatLabel(type),
    franchiseName,
    id: `${WIKIDATA_PROVIDER}:${qid}`,
    note: 'Wikidata/Wikimedia public data',
    provider: WIKIDATA_PROVIDER,
    relationsHint,
    releaseCandidates: isbns.map((isbn) => ({
      displayLabel: title,
      externalRefs: [
        {
          externalId: qid,
          provider: WIKIDATA_PROVIDER,
          rawType: 'entity',
          url: sourceUrl,
        },
      ],
      isbn,
      releaseDate: null,
      releaseType: 'edition',
      sequence: null,
      thumbnailUrl: readWikidataThumbnailUrl(entity),
      title,
    })),
    reason: getWikidataReason(query, title, [...labels, ...aliases]),
    releaseYear,
    sourceLabel: 'Wikidata',
    sourceUrl,
    thumbnailUrl: readWikidataThumbnailUrl(entity),
    title,
    titleAliases: [...labels, ...aliases],
    type,
  });
}

function readWikidataMultilingualValues(value: unknown) {
  if (!isRecord(value)) {
    return [];
  }

  const values = ['ko', 'en', 'ja', 'mul'].map((language) => {
    const entry = value[language];

    return isRecord(entry) ? readString(entry.value) : '';
  });

  return uniqueNonEmpty(values);
}

function readWikidataAliases(value: unknown) {
  if (!isRecord(value)) {
    return [];
  }

  return uniqueNonEmpty(
    ['ko', 'en', 'ja', 'mul'].flatMap((language) => {
      const entries = value[language];

      return Array.isArray(entries)
        ? entries.map((entry) =>
            isRecord(entry) ? readString(entry.value) : '',
          )
        : [];
    }),
  );
}

function readWikidataClaims(entity: UnknownRecord, property: string) {
  const claims = readPath(entity, ['claims', property]);

  return Array.isArray(claims)
    ? claims.filter((claim): claim is UnknownRecord => isRecord(claim))
    : [];
}

function readWikidataClaimValue(claim: UnknownRecord) {
  return readPath(claim, ['mainsnak', 'datavalue', 'value']);
}

function readWikidataClaimString(claim: UnknownRecord) {
  const value = readWikidataClaimValue(claim);

  return readString(value);
}

function readWikidataClaimEntityId(claim: UnknownRecord) {
  const value = readWikidataClaimValue(claim);

  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);

  if (/^Q\d+$/u.test(id)) {
    return id;
  }

  const numericId = readNumber(value['numeric-id']);

  return numericId ? `Q${numericId}` : null;
}

function readWikidataRelatedLabel(
  entity: UnknownRecord,
  properties: readonly string[],
  relatedEntityMap: Map<string, UnknownRecord>,
) {
  for (const property of properties) {
    for (const claim of readWikidataClaims(entity, property)) {
      const entityId = readWikidataClaimEntityId(claim);
      const relatedEntity = entityId ? relatedEntityMap.get(entityId) : null;
      const label = relatedEntity
        ? readWikidataMultilingualValues(relatedEntity.labels)[0]
        : '';

      if (label) {
        return label;
      }
    }
  }

  return null;
}

function readWikidataContributors(
  entity: UnknownRecord,
  relatedEntityMap: Map<string, UnknownRecord>,
) {
  return Object.entries(WIKIDATA_CLAIM_MAPPINGS.contributor)
    .flatMap(([property, role]) =>
      readWikidataClaims(entity, property).flatMap((claim) => {
        const entityId = readWikidataClaimEntityId(claim);
        const relatedEntity = entityId ? relatedEntityMap.get(entityId) : null;
        const name = relatedEntity
          ? readWikidataMultilingualValues(relatedEntity.labels)[0]
          : '';

        return name ? [{ name, role }] : [];
      }),
    )
    .slice(0, 8);
}

function readWikidataRelations(
  entity: UnknownRecord,
  relatedEntityMap: Map<string, UnknownRecord>,
) {
  const relationInputs: Array<{
    properties: readonly string[];
    relationType: string;
  }> = [
    {
      properties: WIKIDATA_CLAIM_MAPPINGS.franchise,
      relationType: 'series',
    },
    {
      properties: WIKIDATA_CLAIM_MAPPINGS.partOf,
      relationType: 'part_of',
    },
  ];

  return relationInputs.flatMap(({ properties, relationType }) =>
    properties.flatMap((property) =>
      readWikidataClaims(entity, property).flatMap((claim) => {
        const entityId = readWikidataClaimEntityId(claim);
        const relatedEntity = entityId ? relatedEntityMap.get(entityId) : null;
        const targetTitle = relatedEntity
          ? readWikidataMultilingualValues(relatedEntity.labels)[0]
          : '';

        return targetTitle ? [{ relationType, targetTitle }] : [];
      }),
    ),
  );
}

function readWikidataExternalRefs(entity: UnknownRecord) {
  const refs: CatalogExternalRefInput[] = [];

  for (const [property, metadata] of Object.entries(
    WIKIDATA_CLAIM_MAPPINGS.externalRef,
  )) {
    for (const claim of readWikidataClaims(entity, property)) {
      const externalId = readWikidataClaimString(claim).trim();

      if (!externalId) {
        continue;
      }

      refs.push({
        externalId,
        provider: metadata.provider,
        rawType: metadata.rawType,
        url: buildExternalRefUrl({
          externalId,
          provider: metadata.provider,
          rawType: metadata.rawType,
        }),
      });
    }
  }

  return refs;
}

function readWikidataIsbns(entity: UnknownRecord) {
  return uniqueNonEmpty([
    ...readWikidataClaims(entity, 'P212').map((claim) =>
      normalizeIsbn(readWikidataClaimString(claim)) ?? '',
    ),
    ...readWikidataClaims(entity, 'P957').map((claim) =>
      normalizeIsbn(readWikidataClaimString(claim)) ?? '',
    ),
  ]);
}

function readWikidataSitelinkUrl(value: unknown) {
  if (!isRecord(value)) {
    return '';
  }

  const preferredSites = ['kowiki', 'enwiki', 'jawiki'];

  for (const site of preferredSites) {
    const sitelink = value[site];

    if (!isRecord(sitelink)) {
      continue;
    }

    const url = readString(sitelink.url);

    if (url) {
      return url;
    }

    const title = readString(sitelink.title);

    if (title) {
      const language = site.replace(/wiki$/u, '');

      return `https://${language}.wikipedia.org/wiki/${encodeURIComponent(
        title.replace(/ /g, '_'),
      )}`;
    }
  }

  return '';
}

function readWikidataThumbnailUrl(entity: UnknownRecord) {
  const imageName = readWikidataClaims(entity, 'P18')
    .map((claim) => readWikidataClaimString(claim))
    .find(Boolean);

  return imageName
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
        imageName,
      )}?width=500`
    : '';
}

function readWikidataReleaseYear(entity: UnknownRecord) {
  for (const property of WIKIDATA_CLAIM_MAPPINGS.releaseDate) {
    for (const claim of readWikidataClaims(entity, property)) {
      const value = readWikidataClaimValue(claim);
      const time = isRecord(value) ? readString(value.time) : '';
      const match = time.match(/[+-](\d{4})-/u);

      if (match?.[1]) {
        return parseYear(match[1]);
      }
    }
  }

  return null;
}

function inferWikidataWorkType(entity: UnknownRecord) {
  const instanceQids = new Set(
    WIKIDATA_CLAIM_MAPPINGS.instanceOf.flatMap((property) =>
      readWikidataClaims(entity, property).flatMap((claim) => {
        const entityId = readWikidataClaimEntityId(claim);

        return entityId ? [entityId] : [];
      }),
    ),
  );

  for (const [type, qids] of Object.entries(WIKIDATA_WORK_TYPE_QIDS)) {
    if (qids?.some((qid) => instanceQids.has(qid))) {
      return type as WorkType;
    }
  }

  return WorkType.other;
}

function calculateWikidataConfidence(input: {
  aliases: string[];
  index: number;
  query: string;
  title: string;
}) {
  const normalizedQuery = normalizeImportTitleSignal(input.query);
  const normalizedTitle = normalizeImportTitleSignal(input.title);
  const normalizedAliases = input.aliases
    .map(normalizeImportTitleSignal)
    .filter(Boolean);
  const rankPenalty = Math.min(input.index, 6) * 0.03;

  if (normalizedQuery && normalizedTitle === normalizedQuery) {
    return Math.max(0.58, 0.8 - rankPenalty);
  }

  if (
    normalizedQuery &&
    normalizedAliases.some((alias) => alias === normalizedQuery)
  ) {
    return Math.max(0.55, 0.74 - rankPenalty);
  }

  if (
    normalizedQuery &&
    normalizedTitle &&
    (normalizedTitle.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedTitle))
  ) {
    return Math.max(0.44, 0.6 - rankPenalty);
  }

  if (
    normalizedQuery &&
    normalizedAliases.some(
      (alias) =>
        alias.includes(normalizedQuery) || normalizedQuery.includes(alias),
    )
  ) {
    return Math.max(0.42, 0.56 - rankPenalty);
  }

  return Math.max(0.28, 0.45 - rankPenalty);
}

function getWikidataReason(query: string, title: string, aliases: string[]) {
  const normalizedQuery = normalizeImportTitleSignal(query);
  const normalizedTitle = normalizeImportTitleSignal(title);
  const normalizedAliases = aliases
    .map(normalizeImportTitleSignal)
    .filter(Boolean);

  if (normalizedQuery && normalizedTitle === normalizedQuery) {
    return 'Wikidata 제목 정확히 일치';
  }

  if (
    normalizedQuery &&
    normalizedAliases.some((alias) => alias === normalizedQuery)
  ) {
    return 'Wikidata 별칭 제목 일치';
  }

  return 'Wikidata 제목/별칭 검색 결과';
}
