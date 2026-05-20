import type { WorkRecord } from '@work-archive/shared-types';

export const GRAPH_TAG_KINDS = [
  'series',
  'universe',
  'creator',
  'studio',
  'publisher',
  'platform',
] as const;

export type GraphTagKind = (typeof GRAPH_TAG_KINDS)[number];

export const SERIES_GRAPH_TAG_KINDS = ['series', 'universe'] as const satisfies
  readonly GraphTagKind[];

export const CONTRIBUTOR_GRAPH_TAG_KINDS = [
  'creator',
  'studio',
  'publisher',
  'platform',
] as const satisfies readonly GraphTagKind[];

export interface ParsedGraphTag {
  kind: GraphTagKind;
  value: string;
}

export interface WorkCollectionSummary {
  averageRating: number | null;
  completedCount: number;
  href: string;
  inProgressCount: number;
  key: string;
  label: string;
  mediaTypes: WorkRecord['type'][];
  totalCount: number;
  updatedAt: string;
  works: WorkRecord[];
}

const GRAPH_TAG_PREFIXES = new Set<string>(GRAPH_TAG_KINDS);

const GRAPH_TAG_KIND_LABELS: Record<GraphTagKind, string> = {
  creator: '제작자',
  platform: '플랫폼',
  publisher: '출판사',
  series: '시리즈',
  studio: '스튜디오',
  universe: '세계관',
};

function normalizeTagValue(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function normalizeComparisonValue(value: string) {
  return normalizeTagValue(value).toLowerCase();
}

function isGraphTagKind(value: string): value is GraphTagKind {
  return GRAPH_TAG_PREFIXES.has(value);
}

export function getGraphTagKindLabel(kind: GraphTagKind) {
  return GRAPH_TAG_KIND_LABELS[kind];
}

export function buildGraphTag(kind: GraphTagKind, value: string) {
  const normalizedValue = normalizeTagValue(value);

  return normalizedValue ? `${kind}:${normalizedValue}` : '';
}

export function parseGraphTag(tag: string): ParsedGraphTag | null {
  const separatorIndex = tag.indexOf(':');

  if (separatorIndex <= 0) {
    return null;
  }

  const kind = tag.slice(0, separatorIndex).trim().toLowerCase();
  const value = normalizeTagValue(tag.slice(separatorIndex + 1));

  if (!isGraphTagKind(kind) || !value) {
    return null;
  }

  return {
    kind,
    value,
  };
}

export function isGraphTag(tag: string) {
  return parseGraphTag(tag) !== null;
}

export function getPersonalTags(tags: string[]) {
  return tags.filter((tag) => !isGraphTag(tag));
}

export function getGraphTags(
  tags: string[],
  kinds: readonly GraphTagKind[] = GRAPH_TAG_KINDS,
) {
  const allowedKinds = new Set<GraphTagKind>(kinds);

  return tags
    .map(parseGraphTag)
    .filter(
      (tag): tag is ParsedGraphTag =>
        tag !== null && allowedKinds.has(tag.kind),
    );
}

export function getGraphTagValues(
  tags: string[],
  kinds: readonly GraphTagKind[] = GRAPH_TAG_KINDS,
) {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const tag of getGraphTags(tags, kinds)) {
    const key = normalizeComparisonValue(tag.value);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    values.push(tag.value);
  }

  return values;
}

export function getSeriesTagValues(tags: string[]) {
  return getGraphTagValues(tags, SERIES_GRAPH_TAG_KINDS);
}

export function getContributorTagValues(tags: string[]) {
  return getGraphTagValues(tags, CONTRIBUTOR_GRAPH_TAG_KINDS);
}

export function getContributorEntries(tags: string[]) {
  return getGraphTags(tags, CONTRIBUTOR_GRAPH_TAG_KINDS);
}

export function mergeGraphTags(
  tags: string[],
  updates: Partial<Record<GraphTagKind, string[]>>,
) {
  const updateKinds = new Set(Object.keys(updates) as GraphTagKind[]);
  const nextTags = tags.filter((tag) => {
    const parsed = parseGraphTag(tag);

    return !parsed || !updateKinds.has(parsed.kind);
  });

  for (const kind of GRAPH_TAG_KINDS) {
    if (!updateKinds.has(kind)) {
      continue;
    }

    for (const value of updates[kind] ?? []) {
      const graphTag = buildGraphTag(kind, value);

      if (graphTag) {
        nextTags.push(graphTag);
      }
    }
  }

  return dedupeTags(nextTags);
}

export function dedupeTags(tags: string[]) {
  const seen = new Set<string>();
  const nextTags: string[] = [];

  for (const tag of tags.map(normalizeTagValue).filter(Boolean)) {
    const parsed = parseGraphTag(tag);
    const key = parsed
      ? `${parsed.kind}:${normalizeComparisonValue(parsed.value)}`
      : normalizeComparisonValue(tag);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    nextTags.push(parsed ? buildGraphTag(parsed.kind, parsed.value) : tag);
  }

  return nextTags;
}

export function matchesGraphTagValue(
  tags: string[],
  kinds: readonly GraphTagKind[],
  value: string | undefined,
) {
  const normalizedValue = normalizeComparisonValue(value ?? '');

  if (!normalizedValue) {
    return true;
  }

  return getGraphTags(tags, kinds).some(
    (tag) => normalizeComparisonValue(tag.value) === normalizedValue,
  );
}

export function matchesPersonalTag(tags: string[], value: string | undefined) {
  const normalizedValue = normalizeComparisonValue(value ?? '');

  if (!normalizedValue) {
    return true;
  }

  return getPersonalTags(tags).some(
    (tag) => normalizeComparisonValue(tag) === normalizedValue,
  );
}

export function workContributorValues(work: WorkRecord) {
  const values = getContributorTagValues(work.personalTags);

  if (values.length > 0) {
    return values;
  }

  const author = normalizeTagValue(work.author);

  return author ? [author] : [];
}

export function getSuggestionValues(
  works: WorkRecord[],
  kinds: readonly GraphTagKind[],
) {
  return Array.from(
    new Set(works.flatMap((work) => getGraphTagValues(work.personalTags, kinds))),
  ).sort((left, right) => left.localeCompare(right));
}

export function getContributorSuggestionValues(works: WorkRecord[]) {
  return Array.from(
    new Set(works.flatMap((work) => workContributorValues(work))),
  ).sort((left, right) => left.localeCompare(right));
}

function createCollectionSummary(
  key: string,
  label: string,
  works: WorkRecord[],
  href: string,
): WorkCollectionSummary {
  const ratedWorks = works.filter((work) => work.rating !== null);
  const totalRating = ratedWorks.reduce(
    (sum, work) => sum + (work.rating ?? 0),
    0,
  );

  return {
    averageRating:
      ratedWorks.length > 0 ? totalRating / ratedWorks.length : null,
    completedCount: works.filter((work) => work.status === 'completed').length,
    href,
    inProgressCount: works.filter((work) => work.status === 'in_progress')
      .length,
    key,
    label,
    mediaTypes: Array.from(new Set(works.map((work) => work.type))),
    totalCount: works.length,
    updatedAt: [...works].sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    )[0]?.updatedAt ?? '',
    works,
  };
}

function sortCollectionSummaries(
  summaries: WorkCollectionSummary[],
  limit: number,
) {
  return summaries
    .sort(
      (left, right) =>
        right.totalCount - left.totalCount ||
        new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime() ||
        left.label.localeCompare(right.label),
    )
    .slice(0, limit);
}

export function buildSeriesCollectionSummaries(
  works: WorkRecord[],
  limit = 8,
) {
  const grouped = new Map<string, { label: string; works: WorkRecord[] }>();

  for (const work of works) {
    for (const value of getSeriesTagValues(work.personalTags)) {
      const key = normalizeComparisonValue(value);
      const group = grouped.get(key);

      if (group) {
        group.works.push(work);
      } else {
        grouped.set(key, {
          label: value,
          works: [work],
        });
      }
    }
  }

  return sortCollectionSummaries(
    Array.from(grouped.entries()).map(([key, group]) =>
      createCollectionSummary(
        key,
        group.label,
        group.works,
        `/works?series=${encodeURIComponent(group.label)}`,
      ),
    ),
    limit,
  );
}

export function buildContributorCollectionSummaries(
  works: WorkRecord[],
  limit = 8,
) {
  const grouped = new Map<string, { label: string; works: WorkRecord[] }>();

  for (const work of works) {
    for (const value of workContributorValues(work)) {
      const key = normalizeComparisonValue(value);
      const group = grouped.get(key);

      if (group) {
        group.works.push(work);
      } else {
        grouped.set(key, {
          label: value,
          works: [work],
        });
      }
    }
  }

  return sortCollectionSummaries(
    Array.from(grouped.entries()).map(([key, group]) =>
      createCollectionSummary(
        key,
        group.label,
        group.works,
        `/works?contributor=${encodeURIComponent(group.label)}`,
      ),
    ),
    limit,
  );
}
