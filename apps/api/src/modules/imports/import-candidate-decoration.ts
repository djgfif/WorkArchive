import type { WorkType } from '@prisma/client';

import type {
  CatalogExternalRefInput,
  CatalogMatchView,
  CatalogReleaseCandidateInput,
} from '../catalog/catalog-ingestion.service';
import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';

export interface ImportCandidateCatalogMatcher {
  findCatalogMatchForImportCandidate(input: {
    contributorNames?: string[];
    externalRefs?: CatalogExternalRefInput[];
    franchiseName?: string | null;
    mediumType: WorkType;
    releaseCandidates?: CatalogReleaseCandidateInput[];
    releaseYear?: number | null;
    title: string;
  }): Promise<CatalogMatchView | null>;
}

export interface ImportCandidateExistingRecordReader {
  userWorkRecord: {
    findFirst(input: {
      select: {
        id: true;
        status: true;
      };
      where: {
        catalogTitleId: string;
        deletedAt: null;
        userId: string;
      };
    }): Promise<{ id: string; status: string } | null>;
  };
}

export async function decorateImportCandidates(input: {
  candidates: ImportCandidateResponseDto[];
  catalogMatcher: ImportCandidateCatalogMatcher;
  recordReader: ImportCandidateExistingRecordReader;
  userId: string | null;
}) {
  return Promise.all(
    input.candidates.map(async (candidate) => {
      const catalogMatch =
        candidate.catalogMatch ??
        (await input.catalogMatcher.findCatalogMatchForImportCandidate({
          contributorNames: candidate.contributors.map(
            (contributor) => contributor.name,
          ),
          externalRefs: candidate.externalRefs,
          franchiseName: candidate.franchiseName,
          mediumType: candidate.mediumType,
          releaseCandidates: candidate.releaseCandidates,
          releaseYear: candidate.releaseYear,
          title: candidate.title,
        }));
      const existingRecord =
        catalogMatch && input.userId
          ? await input.recordReader.userWorkRecord.findFirst({
              where: {
                catalogTitleId: catalogMatch.id,
                deletedAt: null,
                userId: input.userId,
              },
              select: {
                id: true,
                status: true,
              },
            })
          : null;

      return {
        ...candidate,
        catalogMatch,
        existingRecord,
      };
    }),
  );
}
