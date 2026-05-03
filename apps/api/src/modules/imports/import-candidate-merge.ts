import type {
  CatalogExternalRefInput,
  CatalogReleaseCandidateInput,
} from '../catalog/catalog-ingestion.service';
import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
import {
  calculateSourceCoverage,
  getNormalizedExternalRefKey,
  normalizeIsbn,
  normalizeImportTitleSignal,
} from './import-candidate-normalization';

type Contributor = ImportCandidateResponseDto['contributors'][number];
type ExternalRef = ImportCandidateResponseDto['externalRefs'][number];
type RelationHint = ImportCandidateResponseDto['relationsHint'][number];

interface CandidateGroupMember {
  candidate: ImportCandidateResponseDto;
  index: number;
}

export function mergeImportCandidates(
  candidates: ImportCandidateResponseDto[],
): ImportCandidateResponseDto[] {
  const keyOwners = new Map<string, number>();
  const parent = candidates.map((_, index) => index);

  candidates.forEach((candidate, index) => {
    for (const key of getCandidateMergeKeys(candidate)) {
      const owner = keyOwners.get(key);

      if (owner === undefined) {
        keyOwners.set(key, index);
      } else {
        union(parent, owner, index);
      }
    }
  });

  const groups = new Map<number, CandidateGroupMember[]>();

  candidates.forEach((candidate, index) => {
    const root = find(parent, index);
    const members = groups.get(root) ?? [];

    members.push({
      candidate,
      index,
    });
    groups.set(root, members);
  });

  return [...groups.values()]
    .map(mergeCandidateGroup)
    .sort((left, right) => left.firstIndex - right.firstIndex)
    .map((entry) => entry.candidate);
}

function mergeCandidateGroup(members: CandidateGroupMember[]) {
  const representative = [...members].sort((left, right) => {
    return (
      getCandidateCompletenessScore(right.candidate) -
        getCandidateCompletenessScore(left.candidate) ||
      right.candidate.confidence - left.candidate.confidence ||
      left.index - right.index
    );
  })[0]!;
  const candidates = [
    representative.candidate,
    ...members
      .filter((member) => member !== representative)
      .map((member) => member.candidate),
  ];
  const mergedReleaseCandidates = mergeReleaseCandidates(
    candidates.flatMap((candidate) => candidate.releaseCandidates),
  );
  const mergedExternalRefs = dedupeExternalRefs(
    candidates.flatMap((candidate) => candidate.externalRefs),
  );

  return {
    candidate: {
      ...representative.candidate,
      author: firstFilled(candidates.map((candidate) => candidate.author)),
      confidence: Math.max(
        ...candidates.map((candidate) => candidate.confidence),
      ),
      contributors: dedupeContributors(
        candidates.flatMap((candidate) => candidate.contributors),
      ),
      countLabel: firstFilled(
        candidates.map((candidate) => candidate.countLabel),
      ),
      description: firstFilled(
        candidates.map((candidate) => candidate.description),
      ),
      externalRefs: mergedExternalRefs,
      genresText: firstFilled(
        candidates.map((candidate) => candidate.genresText),
      ),
      note: firstFilled(candidates.map((candidate) => candidate.note)),
      relationsHint: dedupeRelationsHints(
        candidates.flatMap((candidate) => candidate.relationsHint),
      ),
      releaseCandidates: mergedReleaseCandidates,
      sourceCoverage: calculateSourceCoverage({
        externalRefs: mergedExternalRefs,
        releaseCandidates: mergedReleaseCandidates,
        sourceId: representative.candidate.sourceId,
      }),
      sourceLabel: firstFilled(
        candidates.map((candidate) => candidate.sourceLabel),
      ),
      sourceUrl: firstFilled(
        candidates.map((candidate) => candidate.sourceUrl),
      ),
      thumbnailUrl: firstFilled(
        candidates.map((candidate) => candidate.thumbnailUrl),
      ),
      title: firstFilled(candidates.map((candidate) => candidate.title)),
      titleAliases: dedupeTitleAliases(
        candidates.flatMap((candidate) => candidate.titleAliases ?? []),
      ),
    },
    firstIndex: Math.min(...members.map((member) => member.index)),
  };
}

function getCandidateMergeKeys(candidate: ImportCandidateResponseDto) {
  return [
    `candidate:${candidate.id}`,
    ...getCandidateCatalogMatchKeys(candidate),
    ...getCandidateIsbnKeys(candidate),
    ...getCandidateExternalRefKeys(candidate),
    ...getCandidateWeakMergeKeys(candidate),
  ];
}

function getCandidateCatalogMatchKeys(candidate: ImportCandidateResponseDto) {
  return candidate.catalogMatch ? [`catalog:${candidate.catalogMatch.id}`] : [];
}

function getCandidateIsbnKeys(candidate: ImportCandidateResponseDto) {
  return candidate.releaseCandidates.flatMap((releaseCandidate) => {
    const isbn = normalizeIsbn(releaseCandidate.isbn ?? null);

    return isbn ? [`isbn:${isbn}`] : [];
  });
}

function getCandidateExternalRefKeys(candidate: ImportCandidateResponseDto) {
  return [
    ...candidate.externalRefs,
    ...candidate.releaseCandidates.flatMap(
      (releaseCandidate) => releaseCandidate.externalRefs ?? [],
    ),
  ].flatMap((externalRef) => {
    const key = getExternalRefKey(externalRef);

    return key ? [`external-ref:${key}`] : [];
  });
}

function getCandidateWeakMergeKeys(candidate: ImportCandidateResponseDto) {
  if (candidate.releaseYear === null) {
    return [];
  }

  if (hasWeakMergeVariantSignal(candidate)) {
    return [];
  }

  const titleKey = normalizeImportTitleSignal(candidate.title);
  const contributorKeys = candidate.contributors
    .map((contributor) => normalizeImportTitleSignal(contributor.name))
    .filter(Boolean);

  if (!titleKey || contributorKeys.length === 0) {
    return [];
  }

  return contributorKeys.map((contributorKey) => {
    return `weak:${candidate.mediumType}:${titleKey}:${candidate.releaseYear}:${contributorKey}`;
  });
}

function hasWeakMergeVariantSignal(candidate: ImportCandidateResponseDto) {
  const searchable = [
    candidate.title,
    candidate.subType ?? '',
    candidate.formatLabel,
    candidate.countLabel,
    ...(candidate.titleAliases ?? []),
  ]
    .join(' ')
    .normalize('NFKC')
    .toLowerCase();

  return /감독판|개정판|극장판|번외편|스핀오프|시즌|영화판|외전|완전판|특별판|합본|한정판|ova|oav|special|스페셜|season|\bpart\s*\d+\b|파트\s*\d+|\b\d+\s*기\b|\b\d+(?:st|nd|rd|th)\s+season\b/u.test(
    searchable,
  );
}

function mergeReleaseCandidates(
  releaseCandidates: CatalogReleaseCandidateInput[],
) {
  const releaseMap = new Map<string, CatalogReleaseCandidateInput>();
  const anonymousReleases: CatalogReleaseCandidateInput[] = [];

  for (const releaseCandidate of releaseCandidates) {
    const key = getReleaseCandidateKey(releaseCandidate);

    if (!key) {
      anonymousReleases.push(releaseCandidate);
      continue;
    }

    const existing = releaseMap.get(key);

    releaseMap.set(
      key,
      existing
        ? mergeReleaseCandidate(existing, releaseCandidate)
        : releaseCandidate,
    );
  }

  return [...releaseMap.values(), ...anonymousReleases];
}

function mergeReleaseCandidate(
  left: CatalogReleaseCandidateInput,
  right: CatalogReleaseCandidateInput,
): CatalogReleaseCandidateInput {
  return {
    displayLabel: firstFilled([
      left.displayLabel ?? '',
      right.displayLabel ?? '',
    ]),
    externalRefs: dedupeExternalRefs([
      ...(left.externalRefs ?? []),
      ...(right.externalRefs ?? []),
    ]),
    isbn: normalizeIsbn(left.isbn ?? null) || normalizeIsbn(right.isbn ?? null),
    releaseDate: left.releaseDate ?? right.releaseDate ?? null,
    releaseType: firstFilled([left.releaseType ?? '', right.releaseType ?? '']),
    sequence: left.sequence ?? right.sequence ?? null,
    summary: firstFilled([left.summary ?? '', right.summary ?? '']),
    thumbnailUrl: firstFilled([
      left.thumbnailUrl ?? '',
      right.thumbnailUrl ?? '',
    ]),
    title: firstFilled([left.title ?? '', right.title ?? '']),
  };
}

function getReleaseCandidateKey(
  releaseCandidate: CatalogReleaseCandidateInput,
) {
  const isbn = normalizeIsbn(releaseCandidate.isbn ?? null);

  if (isbn) {
    return `isbn:${isbn}`;
  }

  const externalRefKeys = (releaseCandidate.externalRefs ?? [])
    .map(getExternalRefKey)
    .filter((key): key is string => Boolean(key))
    .sort();

  if (externalRefKeys.length > 0) {
    return `external-ref:${externalRefKeys.join('|')}`;
  }

  return null;
}

function dedupeExternalRefs(externalRefs: CatalogExternalRefInput[]) {
  const externalRefMap = new Map<string, ExternalRef>();

  for (const externalRef of externalRefs) {
    const key = getExternalRefKey(externalRef);

    if (!key || externalRefMap.has(key)) {
      continue;
    }

    externalRefMap.set(key, {
      externalId: externalRef.externalId,
      provider: externalRef.provider,
      rawType: externalRef.rawType ?? '',
      url: externalRef.url ?? '',
    });
  }

  return [...externalRefMap.values()];
}

function dedupeContributors(contributors: Contributor[]) {
  const contributorMap = new Map<string, Contributor>();

  for (const contributor of contributors) {
    const key = `${contributor.role.trim().toLowerCase()}:${contributor.name.trim().toLowerCase()}`;

    if (!contributor.name.trim() || contributorMap.has(key)) {
      continue;
    }

    contributorMap.set(key, contributor);
  }

  return [...contributorMap.values()];
}

function dedupeRelationsHints(relationsHints: RelationHint[]) {
  const relationMap = new Map<string, RelationHint>();

  for (const relationsHint of relationsHints) {
    const key = `${relationsHint.relationType.trim().toLowerCase()}:${relationsHint.targetTitle.trim().toLowerCase()}`;

    if (!relationsHint.targetTitle.trim() || relationMap.has(key)) {
      continue;
    }

    relationMap.set(key, relationsHint);
  }

  return [...relationMap.values()];
}

function dedupeTitleAliases(titleAliases: string[]) {
  const aliasMap = new Map<string, string>();

  for (const titleAlias of titleAliases) {
    const key = normalizeImportTitleSignal(titleAlias);

    if (!key || aliasMap.has(key)) {
      continue;
    }

    aliasMap.set(key, titleAlias);
  }

  return [...aliasMap.values()];
}

function getExternalRefKey(externalRef: CatalogExternalRefInput) {
  return getNormalizedExternalRefKey(externalRef);
}

function getCandidateCompletenessScore(candidate: ImportCandidateResponseDto) {
  return (
    [
      candidate.title,
      candidate.author,
      candidate.description,
      candidate.thumbnailUrl,
      candidate.genresText,
      candidate.sourceUrl,
      candidate.countLabel,
    ].filter((value) => value.trim()).length +
    candidate.contributors.length +
    candidate.externalRefs.length +
    candidate.releaseCandidates.length +
    (candidate.releaseYear === null ? 0 : 1)
  );
}

function firstFilled(values: string[]) {
  return values.find((value) => value.trim()) ?? '';
}

function find(parent: number[], index: number): number {
  if (parent[index] !== index) {
    parent[index] = find(parent, parent[index]!);
  }

  return parent[index]!;
}

function union(parent: number[], left: number, right: number) {
  const leftRoot = find(parent, left);
  const rightRoot = find(parent, right);

  if (leftRoot !== rightRoot) {
    parent[rightRoot] = leftRoot;
  }
}
