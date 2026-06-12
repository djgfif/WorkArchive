import type { Prisma, WorkType } from '@prisma/client';

import type { CatalogReleaseCandidateInput } from '../catalog/catalog-ingestion.service';
import { searchCatalogTitleIds } from '../catalog/catalog-title-search';
import type { PrismaService } from '../../prisma/prisma.service';
import { normalizeImportCandidate } from './candidates/import-candidate-normalization';
import type { ImportCandidateResponseDto } from './dto/import-candidate-response.dto';
import { getFormatLabel } from './providers/import-candidate-builder';

const INTERNAL_CATALOG_SOURCE_ID = 'catalog';

export const IMPORT_CATALOG_TITLE_INCLUDE = {
  contributors: {
    include: {
      contributor: true,
    },
    orderBy: {
      displayOrder: 'asc',
    },
  },
  externalRefs: true,
  franchise: true,
  releases: {
    include: {
      externalRefs: true,
    },
    orderBy: {
      sequence: 'asc',
    },
    take: 5,
  },
} satisfies Prisma.CatalogTitleInclude;

export type ImportCatalogTitleCandidate = Prisma.CatalogTitleGetPayload<{
  include: typeof IMPORT_CATALOG_TITLE_INCLUDE;
}>;

export async function searchInternalCatalogImportCandidates(input: {
  limit: number;
  mediumType: WorkType | undefined;
  prisma: PrismaService;
  query: string;
}) {
  const catalogTitle = getCatalogTitleSearchDelegate(input.prisma);

  if (!catalogTitle) {
    return [];
  }

  const rankedIds = await searchCatalogTitleIds(input.prisma, {
    limit: Math.min(input.limit, 10),
    query: input.query,
    ...(input.mediumType ? { mediumType: input.mediumType } : {}),
  });

  if (rankedIds) {
    if (rankedIds.length === 0) {
      return [];
    }

    const catalogTitles = await catalogTitle.findMany({
      where: {
        id: {
          in: rankedIds,
        },
      },
      include: IMPORT_CATALOG_TITLE_INCLUDE,
    });
    const titleById = new Map(catalogTitles.map((title) => [title.id, title]));

    return rankedIds
      .flatMap((id) => {
        const title = titleById.get(id);

        return title ? [title] : [];
      })
      .map((title) => toInternalCatalogImportCandidate(title));
  }

  const catalogTitles = await catalogTitle.findMany({
    where: {
      ...(input.mediumType
        ? {
            mediumType: input.mediumType,
          }
        : {}),
      OR: [
        {
          canonicalTitle: {
            contains: input.query,
            mode: 'insensitive',
          },
        },
        {
          displayTitle: {
            contains: input.query,
            mode: 'insensitive',
          },
        },
        {
          originalTitle: {
            contains: input.query,
            mode: 'insensitive',
          },
        },
        {
          aliases: {
            has: input.query,
          },
        },
        {
          contributors: {
            some: {
              contributor: {
                displayName: {
                  contains: input.query,
                  mode: 'insensitive',
                },
              },
            },
          },
        },
      ],
    },
    include: IMPORT_CATALOG_TITLE_INCLUDE,
    orderBy: [{ verificationStatus: 'desc' }, { updatedAt: 'desc' }],
    take: Math.min(input.limit, 10),
  });

  return catalogTitles.map((title) => toInternalCatalogImportCandidate(title));
}

function getCatalogTitleSearchDelegate(prisma: PrismaService) {
  const prismaWithOptionalCatalogTitle = prisma as PrismaService & {
    catalogTitle?: {
      findMany?: PrismaService['catalogTitle']['findMany'];
    };
  };

  return typeof prismaWithOptionalCatalogTitle.catalogTitle?.findMany ===
    'function'
    ? {
        findMany:
          prismaWithOptionalCatalogTitle.catalogTitle.findMany.bind(
            prismaWithOptionalCatalogTitle.catalogTitle,
          ),
      }
    : null;
}

export function toInternalCatalogImportCandidate(
  title: ImportCatalogTitleCandidate,
): ImportCandidateResponseDto {
  const contributors = title.contributors.map((entry) => ({
    name: entry.contributor.displayName,
    role: entry.role,
  }));
  const releaseCandidates: CatalogReleaseCandidateInput[] = title.releases.map(
    (release) => ({
      displayLabel: release.displayLabel,
      externalRefs: release.externalRefs.map((ref) => ({
        externalId: ref.externalId,
        provider: ref.provider,
        rawType: ref.rawType,
        url: ref.url,
      })),
      isbn: release.isbn,
      releaseDate: release.releaseDate,
      releaseType: release.releaseType,
      sequence: release.sequence,
      summary: release.summary,
      thumbnailUrl: release.thumbnailUrl,
      title: release.title,
    }),
  );

  return normalizeImportCandidate({
    author: contributors.map((contributor) => contributor.name).join(', '),
    catalogMatch: {
      id: title.id,
      title: title.displayTitle,
      verificationStatus: title.verificationStatus,
    },
    confidence: 0.95,
    confidenceLabel: '카탈로그 일치',
    contributors,
    countLabel: title.releaseYear
      ? `${title.releaseYear}년 카탈로그`
      : '카탈로그 등록',
    description: title.summary,
    existingRecord: null,
    externalId: title.id,
    externalRefs: title.externalRefs.map((ref) => ({
      externalId: ref.externalId,
      provider: ref.provider,
      rawType: ref.rawType,
      url: ref.url,
    })),
    formatLabel: getFormatLabel(title.mediumType),
    franchiseName: title.franchise?.displayName ?? null,
    genresText: '',
    id: `${INTERNAL_CATALOG_SOURCE_ID}:${title.id}`,
    mediumType: title.mediumType,
    note: '이미 정규화된 내부 카탈로그 후보입니다.',
    reason: '내부 카탈로그 일치',
    relationsHint: [],
    releaseCandidates,
    releaseYear: title.releaseYear,
    scoreBreakdown: [],
    sourceCoverage: {
      externalIdentityCount: 0,
      providerCount: 0,
      providers: [],
      releaseCandidateCount: 0,
    },
    sourceId: INTERNAL_CATALOG_SOURCE_ID,
    sourceLabel: '내부 카탈로그',
    sourceUrl: '',
    subType: title.subType,
    thumbnailUrl: title.thumbnailUrl,
    title: title.displayTitle,
    titleAliases: [
      title.canonicalTitle,
      title.originalTitle ?? '',
      ...title.aliases,
    ],
    type: title.mediumType,
  });
}
