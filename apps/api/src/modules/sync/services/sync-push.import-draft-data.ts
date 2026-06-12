import type { WorkType } from '@prisma/client';

import type { CreateCatalogTitleInput } from '../../catalog/catalog-ingestion.service';
import { normalizeString } from '../../works/work-aggregate';
import type { SyncWorkPayloadDto } from '../payloads/sync-work-payload.dto';

export function buildImportTitleCreateData(
  payload: SyncWorkPayloadDto,
  catalogTitle: string,
): CreateCatalogTitleInput {
  const importDraft = payload.importDraft!;

  return {
    canonicalTitle: catalogTitle,
    ...(importDraft.contributors && importDraft.contributors.length > 0
      ? {
          contributorNames: importDraft.contributors.map((contributor) =>
            contributor.name.trim(),
          ),
        }
      : {}),
    displayTitle: catalogTitle,
    ...(importDraft.externalRefs && importDraft.externalRefs.length > 0
      ? {
          externalRefs: importDraft.externalRefs.map((ref) =>
            buildCatalogExternalRefInput(ref),
          ),
        }
      : {}),
    franchiseName: importDraft.franchiseName?.trim() ?? null,
    mediumType: importDraft.mediumType as WorkType,
    ...(importDraft.releaseCandidates &&
    importDraft.releaseCandidates.length > 0
      ? {
          releaseCandidates: importDraft.releaseCandidates.map((release) =>
            buildCatalogReleaseCandidateInput(release),
          ),
        }
      : {}),
    releaseYear: importDraft.releaseYear ?? null,
    subType: importDraft.subType?.trim() ?? null,
    summary: normalizeString(payload.description),
    thumbnailUrl: normalizeString(payload.thumbnailUrl),
  };
}

export function resolveImportDraftCatalogTitle(payload: SyncWorkPayloadDto) {
  const catalogTitle = payload.importDraft?.catalogTitle?.trim();

  if (catalogTitle) {
    return catalogTitle;
  }

  const fallbackTitle = payload.title.trim();

  return fallbackTitle || null;
}

export function buildCatalogExternalRefInput(ref: {
  externalId: string;
  provider: string;
  rawType?: string | null;
  url?: string | null;
}) {
  return {
    externalId: ref.externalId.trim(),
    provider: ref.provider.trim(),
    ...(ref.rawType?.trim() ? { rawType: ref.rawType.trim() } : {}),
    ...(ref.url?.trim() ? { url: ref.url.trim() } : {}),
  };
}

export function buildCatalogReleaseCandidateInput(release: {
  displayLabel?: string | null;
  externalRefs?: Array<{
    externalId: string;
    provider: string;
    rawType?: string | null;
    url?: string | null;
  }> | null;
  isbn?: string | null;
  releaseDate?: string | Date | null;
  releaseType?: string | null;
  sequence?: number | null;
  thumbnailUrl?: string | null;
  title?: string | null;
}) {
  return {
    ...(release.displayLabel?.trim()
      ? { displayLabel: release.displayLabel.trim() }
      : {}),
    ...(release.externalRefs && release.externalRefs.length > 0
      ? {
          externalRefs: release.externalRefs.map((ref) =>
            buildCatalogExternalRefInput(ref),
          ),
        }
      : {}),
    isbn: release.isbn?.trim() ?? null,
    releaseDate: release.releaseDate ?? null,
    ...(release.releaseType?.trim()
      ? { releaseType: release.releaseType.trim() }
      : {}),
    sequence: release.sequence ?? null,
    ...(release.thumbnailUrl?.trim()
      ? { thumbnailUrl: release.thumbnailUrl.trim() }
      : {}),
    ...(release.title?.trim() ? { title: release.title.trim() } : {}),
  };
}
