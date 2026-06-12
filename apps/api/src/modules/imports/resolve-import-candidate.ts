import { BadRequestException } from '@nestjs/common';
import { WorkType } from '@prisma/client';

import type { CatalogReleaseCandidateInput } from '../catalog/catalog-ingestion.service';
import { normalizeImportCandidate } from './candidates/import-candidate-normalization';
import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
import { MANUAL_PROVIDER } from './imports.constants';
import { PROVIDERS, type ProviderMetadata } from './providers/import-provider-adapter';
import {
  getFormatLabel,
  normalizeWhitespace,
  parseYear,
} from './providers/import-candidate-builder';
import {
  isRecord,
  readNumber,
  readString,
  readStringArray,
} from './providers/import-candidate-readers';

export function buildResolvedImportCandidate(
  candidateInput: unknown,
): ImportCandidateResponseDto {
  if (!isRecord(candidateInput)) {
    throw new BadRequestException('Import candidate payload must be an object.');
  }

  const type = readCandidateWorkType(
    candidateInput.mediumType ?? candidateInput.type,
  );
  const title = normalizeWhitespace(readString(candidateInput.title));

  if (!title) {
    throw new BadRequestException('Import candidate title is required.');
  }

  const sourceId =
    normalizeWhitespace(
      readString(candidateInput.sourceId ?? candidateInput.provider),
    ) || MANUAL_PROVIDER;
  const externalId =
    normalizeWhitespace(readString(candidateInput.externalId)) ||
    `${sourceId}:${title}`;
  const externalRefs = readCandidateExternalRefs(candidateInput.externalRefs);

  return normalizeImportCandidate({
    author: readString(candidateInput.author),
    catalogMatch: null,
    confidence: readNumber(candidateInput.confidence) ?? 0.5,
    confidenceLabel: readString(candidateInput.confidenceLabel),
    contributors: readCandidateContributors(candidateInput.contributors),
    countLabel: readString(candidateInput.countLabel),
    description: readString(candidateInput.description),
    existingRecord: null,
    externalId,
    externalRefs:
      externalRefs.length > 0
        ? externalRefs
        : [
            {
              externalId,
              provider: sourceId,
              rawType: type,
              url: readString(candidateInput.sourceUrl),
            },
          ],
    formatLabel: readString(candidateInput.formatLabel) || getFormatLabel(type),
    franchiseName:
      normalizeWhitespace(readString(candidateInput.franchiseName)) || null,
    genresText: readString(candidateInput.genresText),
    id: readString(candidateInput.id) || `${sourceId}:${externalId}`,
    mediumType: type,
    note: readString(candidateInput.note),
    reason: readString(candidateInput.reason),
    relationsHint: readCandidateRelations(candidateInput.relationsHint),
    releaseCandidates: readCandidateReleases(
      candidateInput.releaseCandidates,
    ),
    releaseYear:
      readNumber(candidateInput.releaseYear) ??
      parseYear(readString(candidateInput.releaseDate)),
    scoreBreakdown: readCandidateScoreBreakdown(
      candidateInput.scoreBreakdown,
    ),
    sourceCoverage: {
      externalIdentityCount: 0,
      providerCount: 0,
      providers: [],
      releaseCandidateCount: 0,
    },
    sourceId,
    sourceLabel:
      readString(candidateInput.sourceLabel) ||
      getCandidateSourceLabel(sourceId),
    sourceUrl: readString(candidateInput.sourceUrl),
    subType: normalizeWhitespace(readString(candidateInput.subType)) || null,
    thumbnailUrl: readString(candidateInput.thumbnailUrl),
    title,
    titleAliases: readStringArray(candidateInput.titleAliases),
    type,
  });
}

function readCandidateWorkType(value: unknown) {
  const normalized = readString(value);

  if ((Object.values(WorkType) as string[]).includes(normalized)) {
    return normalized as WorkType;
  }

  throw new BadRequestException('Import candidate type is required.');
}

function readCandidateContributors(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      return {
        name: readString(entry.name),
        role: readString(entry.role) || 'creator',
      };
    })
    .filter((entry): entry is { name: string; role: string } =>
      Boolean(entry?.name),
    );
}

function readCandidateExternalRefs(
  value: unknown,
): ImportCandidateResponseDto['externalRefs'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const provider = readString(entry.provider);
      const externalId = readString(entry.externalId);

      if (!provider || !externalId) {
        return null;
      }

      const externalRef: ImportCandidateResponseDto['externalRefs'][number] = {
        externalId,
        provider,
        rawType: readString(entry.rawType),
        url: readString(entry.url),
      };

      return externalRef;
    })
    .filter(
      (entry): entry is ImportCandidateResponseDto['externalRefs'][number] =>
        entry !== null,
    );
}

function readCandidateRelations(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      return {
        relationType: readString(entry.relationType),
        targetTitle: readString(entry.targetTitle),
      };
    })
    .filter(
      (entry): entry is { relationType: string; targetTitle: string } =>
        Boolean(entry?.relationType && entry.targetTitle),
    );
}

function readCandidateReleases(value: unknown): CatalogReleaseCandidateInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const externalRefs = readCandidateExternalRefs(entry.externalRefs);

      const release: CatalogReleaseCandidateInput = {
        displayLabel: readString(entry.displayLabel),
        externalRefs,
        isbn: readString(entry.isbn) || null,
        releaseDate: readString(entry.releaseDate) || null,
        releaseType: readString(entry.releaseType),
        sequence: readNumber(entry.sequence),
        thumbnailUrl: readString(entry.thumbnailUrl),
        title: readString(entry.title),
      };

      return release;
    })
    .filter((entry): entry is CatalogReleaseCandidateInput => entry !== null);
}

function readCandidateScoreBreakdown(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      return {
        label: readString(entry.label),
        weight: readNumber(entry.weight) ?? 0,
      };
    })
    .filter((entry): entry is { label: string; weight: number } =>
      Boolean(entry?.label),
    );
}

function getCandidateSourceLabel(sourceId: string) {
  return (PROVIDERS as Partial<Record<string, ProviderMetadata>>)[sourceId]
    ?.label ?? sourceId;
}
