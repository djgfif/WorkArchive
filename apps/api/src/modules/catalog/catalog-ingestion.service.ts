import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogVerificationStatus,
  type CatalogRelease,
  type Prisma,
  type WorkType,
} from '@prisma/client';

import { canCreateReleaseRecord } from '../recording/recording-policy';
import {
  hasCatalogReleaseIdentity,
  normalizeCatalogExternalRef,
  normalizeCatalogReleaseCandidate,
  type CatalogExternalRefInput,
  type CatalogReleaseCandidateInput,
  type NormalizedExternalRef,
  type NormalizedReleaseCandidate,
} from './catalog-ingestion-normalization';
import {
  normalizeForCatalogMatch,
  pickBestCatalogTitleMatch,
} from './catalog-title-matching';
import {
  buildCatalogReleaseCreateData,
  buildCatalogReleaseUpdateData,
  buildCatalogTitleUpdateData,
  toCatalogMatchView,
  type CatalogMatchView,
} from './catalog-ingestion-payloads';
import { PrismaService } from '../../prisma/prisma.service';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

const TITLE_MATCH_INCLUDE = {
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
} satisfies Prisma.CatalogTitleInclude;

const EXTERNAL_REF_MATCH_INCLUDE = {
  catalogRelease: {
    include: {
      catalogTitle: {
        include: TITLE_MATCH_INCLUDE,
      },
    },
  },
  catalogTitle: {
    include: TITLE_MATCH_INCLUDE,
  },
} satisfies Prisma.CatalogExternalRefInclude;

export type {
  CatalogExternalRefInput,
  CatalogReleaseCandidateInput,
} from './catalog-ingestion-normalization';
export type { CatalogMatchView } from './catalog-ingestion-payloads';

export interface CreateCatalogTitleInput {
  canonicalTitle: string;
  contributorNames?: string[];
  country?: string | null;
  displayTitle?: string;
  externalRefs?: CatalogExternalRefInput[];
  franchiseName?: string | null;
  mediumType: WorkType;
  releaseCandidates?: CatalogReleaseCandidateInput[];
  releaseYear?: number | null;
  subType?: string | null;
  summary?: string;
  thumbnailUrl?: string;
}

@Injectable()
export class CatalogIngestionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createOrReuseTitleFromImportCandidate(
    input: CreateCatalogTitleInput,
    client: PrismaClientLike = this.prisma,
  ) {
    const displayTitle = input.displayTitle?.trim() || input.canonicalTitle.trim();
    const canonicalTitle = input.canonicalTitle.trim() || displayTitle;

    if (!displayTitle) {
      throw new BadRequestException('catalog title must not be empty');
    }

    const franchiseId = input.franchiseName
      ? await this.findOrCreateFranchise(input.franchiseName, client)
      : null;
    const existing = await this.findMatchingTitle(
      {
        contributorNames: input.contributorNames ?? [],
        displayTitle,
        externalRefs: input.externalRefs ?? [],
        franchiseId,
        mediumType: input.mediumType,
        releaseCandidates: input.releaseCandidates ?? [],
        releaseYear: input.releaseYear ?? null,
      },
      client,
    );

    const title = existing
      ? await client.catalogTitle.update({
          where: {
            id: existing.id,
          },
          data: buildCatalogTitleUpdateData(existing, {
            country: input.country ?? null,
            franchiseId,
            releaseYear: input.releaseYear ?? null,
            subType: input.subType ?? null,
            summary: input.summary?.trim() ?? '',
            thumbnailUrl: input.thumbnailUrl?.trim() ?? '',
          }),
        })
      : await client.catalogTitle.create({
          data: {
            canonicalTitle,
            country: input.country ?? null,
            displayTitle,
            franchiseId,
            mediumType: input.mediumType,
            releaseYear: input.releaseYear ?? null,
            subType: input.subType ?? null,
            summary: input.summary?.trim() ?? '',
            thumbnailUrl: input.thumbnailUrl?.trim() ?? '',
            verificationStatus: CatalogVerificationStatus.draft,
          },
        });

    for (const [index, contributorName] of (input.contributorNames ?? []).entries()) {
      await this.attachContributor(title.id, contributorName, index, client);
    }

    for (const ref of input.externalRefs ?? []) {
      const normalizedRef = normalizeCatalogExternalRef(ref);

      if (!normalizedRef) {
        continue;
      }

      await client.catalogExternalRef.upsert({
        where: {
          provider_rawType_externalId: {
            externalId: normalizedRef.externalId,
            provider: normalizedRef.provider,
            rawType: normalizedRef.rawType,
          },
        },
        create: {
          catalogTitleId: title.id,
          externalId: normalizedRef.externalId,
          provider: normalizedRef.provider,
          rawType: normalizedRef.rawType,
          url: normalizedRef.url,
        },
        update: {
          catalogTitleId: title.id,
          url: normalizedRef.url,
        },
      });
    }

    await this.backfillCatalogTitleReleases(
      title.id,
      input.releaseCandidates ?? [],
      client,
    );

    return title;
  }

  async backfillCatalogTitleReleases(
    catalogTitleId: string,
    releaseCandidates: CatalogReleaseCandidateInput[],
    client: PrismaClientLike = this.prisma,
  ) {
    const title = await client.catalogTitle.findUnique({
      where: {
        id: catalogTitleId,
      },
      select: {
        id: true,
        mediumType: true,
      },
    });

    if (!title) {
      throw new NotFoundException(
        `Catalog title with id "${catalogTitleId}" was not found.`,
      );
    }

    if (!canCreateReleaseRecord(title.mediumType)) {
      return [];
    }

    const releases: CatalogRelease[] = [];

    for (const candidate of releaseCandidates) {
      const release = await this.upsertCatalogRelease(title.id, candidate, client);

      if (release) {
        releases.push(release);
      }
    }

    return releases;
  }

  async findCatalogMatchForImportCandidate(input: {
    contributorNames?: string[];
    externalRefs?: CatalogExternalRefInput[];
    franchiseName?: string | null;
    mediumType: WorkType;
    releaseCandidates?: CatalogReleaseCandidateInput[];
    releaseYear?: number | null;
    title: string;
  }): Promise<CatalogMatchView | null> {
    const franchiseId = input.franchiseName
      ? await this.findExistingFranchiseId(input.franchiseName)
      : null;
    const match = await this.findMatchingTitle({
      contributorNames: input.contributorNames ?? [],
      displayTitle: input.title,
      externalRefs: input.externalRefs ?? [],
      franchiseId,
      mediumType: input.mediumType,
      releaseCandidates: input.releaseCandidates ?? [],
      releaseYear: input.releaseYear ?? null,
    });

    return match ? toCatalogMatchView(match) : null;
  }

  private async upsertCatalogRelease(
    catalogTitleId: string,
    candidate: CatalogReleaseCandidateInput,
    client: PrismaClientLike,
  ) {
    const normalizedCandidate = normalizeCatalogReleaseCandidate(candidate);

    if (!hasCatalogReleaseIdentity(normalizedCandidate)) {
      return null;
    }

    const existing = await this.findExistingCatalogRelease(
      catalogTitleId,
      normalizedCandidate,
      client,
    );
    const release = existing
      ? await client.catalogRelease.update({
          where: {
            id: existing.id,
          },
          data: buildCatalogReleaseUpdateData(existing, normalizedCandidate),
        })
      : await client.catalogRelease.create({
          data: {
            catalogTitleId,
            ...buildCatalogReleaseCreateData(normalizedCandidate),
          },
        });

    for (const ref of normalizedCandidate.externalRefs) {
      await client.catalogExternalRef.upsert({
        where: {
          provider_rawType_externalId: {
            externalId: ref.externalId,
            provider: ref.provider,
            rawType: ref.rawType,
          },
        },
        create: {
          catalogReleaseId: release.id,
          catalogTitleId,
          externalId: ref.externalId,
          provider: ref.provider,
          rawType: ref.rawType,
          url: ref.url,
        },
        update: {
          catalogReleaseId: release.id,
          catalogTitleId,
          url: ref.url,
        },
      });
    }

    return release;
  }

  private async findExistingCatalogRelease(
    catalogTitleId: string,
    candidate: Pick<
      NormalizedReleaseCandidate,
      'displayLabel' | 'externalRefs' | 'isbn' | 'sequence'
    >,
    client: PrismaClientLike,
  ) {
    for (const ref of candidate.externalRefs) {
      const existingRef = await client.catalogExternalRef.findUnique({
        where: {
          provider_rawType_externalId: {
            externalId: ref.externalId,
            provider: ref.provider,
            rawType: ref.rawType,
          },
        },
        include: {
          catalogRelease: true,
        },
      });

      if (
        existingRef?.catalogRelease &&
        existingRef.catalogRelease.catalogTitleId === catalogTitleId
      ) {
        return existingRef.catalogRelease;
      }
    }

    if (candidate.isbn) {
      const byIsbn = await client.catalogRelease.findFirst({
        where: {
          catalogTitleId,
          isbn: candidate.isbn,
        },
      });

      if (byIsbn) {
        return byIsbn;
      }
    }

    if (candidate.sequence !== null && candidate.displayLabel) {
      const bySequence = await client.catalogRelease.findFirst({
        where: {
          catalogTitleId,
          displayLabel: {
            equals: candidate.displayLabel,
            mode: 'insensitive',
          },
          sequence: candidate.sequence,
        },
      });

      if (bySequence) {
        return bySequence;
      }
    }

    return null;
  }

  private async findMatchingTitle(
    input: {
      contributorNames: string[];
      displayTitle: string;
      externalRefs: CatalogExternalRefInput[];
      franchiseId: string | null;
      mediumType: WorkType;
      releaseCandidates: CatalogReleaseCandidateInput[];
      releaseYear: number | null;
    },
    client: PrismaClientLike = this.prisma,
  ) {
    const externalRefs = [
      ...input.externalRefs,
      ...input.releaseCandidates.flatMap((candidate) => candidate.externalRefs ?? []),
    ];

    for (const ref of externalRefs) {
      const normalizedRef = normalizeCatalogExternalRef(ref);

      if (!normalizedRef) {
        continue;
      }

      const title = await this.findTitleByExternalRef(normalizedRef, client);

      if (title) {
        return title;
      }
    }

    if (input.franchiseId) {
      const franchiseMatches = await client.catalogTitle.findMany({
        where: {
          franchiseId: input.franchiseId,
          mediumType: input.mediumType,
          verificationStatus: {
            not: CatalogVerificationStatus.merged,
          },
        },
        include: TITLE_MATCH_INCLUDE,
        orderBy: [{ updatedAt: 'desc' }],
        take: 25,
      });
      const bestFranchiseMatch = pickBestCatalogTitleMatch(
        franchiseMatches,
        input.displayTitle,
        input.releaseYear,
        [],
      );

      if (bestFranchiseMatch) {
        return bestFranchiseMatch;
      }
    }

    if (input.contributorNames.length > 0) {
      const contributorMatches = await client.catalogTitle.findMany({
        where: {
          mediumType: input.mediumType,
          verificationStatus: {
            not: CatalogVerificationStatus.merged,
          },
        },
        include: TITLE_MATCH_INCLUDE,
        orderBy: [{ updatedAt: 'desc' }],
        take: 50,
      });
      const bestContributorMatch = pickBestCatalogTitleMatch(
        contributorMatches,
        input.displayTitle,
        input.releaseYear,
        input.contributorNames.map((name) => ({
          name,
        })),
      );

      if (bestContributorMatch) {
        return bestContributorMatch;
      }
    }

    return null;
  }

  private async findTitleByExternalRef(
    ref: NormalizedExternalRef,
    client: PrismaClientLike = this.prisma,
  ) {
    const match = await client.catalogExternalRef.findUnique({
      where: {
        provider_rawType_externalId: {
          externalId: ref.externalId,
          provider: ref.provider,
          rawType: ref.rawType,
        },
      },
      include: EXTERNAL_REF_MATCH_INCLUDE,
    });

    if (match?.catalogTitle) {
      return match.catalogTitle;
    }

    return match?.catalogRelease?.catalogTitle ?? null;
  }

  private async findExistingFranchiseId(
    name: string,
    client: PrismaClientLike = this.prisma,
  ) {
    const displayName = name.trim();
    const normalizedName = normalizeForCatalogMatch(displayName);

    if (!normalizedName) {
      return null;
    }

    const candidates = await client.franchise.findMany({
      where: {
        OR: [
          {
            canonicalName: {
              contains: displayName,
              mode: 'insensitive',
            },
          },
          {
            displayName: {
              contains: displayName,
              mode: 'insensitive',
            },
          },
          {
            originalName: {
              contains: displayName,
              mode: 'insensitive',
            },
          },
          {
            aliases: {
              has: displayName,
            },
          },
        ],
      },
      select: {
        aliases: true,
        canonicalName: true,
        displayName: true,
        id: true,
        originalName: true,
      },
      take: 25,
    });

    const match = candidates.find((candidate) => {
      return [
        candidate.canonicalName,
        candidate.displayName,
        candidate.originalName ?? '',
        ...candidate.aliases,
      ].some((entry) => normalizeForCatalogMatch(entry) === normalizedName);
    });

    return match?.id ?? null;
  }

  private async findOrCreateFranchise(
    name: string,
    client: PrismaClientLike = this.prisma,
  ) {
    const displayName = name.trim();

    if (!displayName) {
      return null;
    }

    const existingId = await this.findExistingFranchiseId(displayName, client);

    if (existingId) {
      return existingId;
    }

    const created = await client.franchise.create({
      data: {
        canonicalName: displayName,
        displayName,
      },
      select: {
        id: true,
      },
    });

    return created.id;
  }

  private async attachContributor(
    catalogTitleId: string,
    rawName: string,
    displayOrder: number,
    client: PrismaClientLike = this.prisma,
  ) {
    const displayName = rawName.trim();

    if (!displayName) {
      return;
    }

    const existing = await client.contributor.findFirst({
      where: {
        displayName: {
          equals: displayName,
          mode: 'insensitive',
        },
      },
    });
    const contributor =
      existing ??
      (await client.contributor.create({
        data: {
          canonicalName: displayName,
          displayName,
        },
      }));

    await client.catalogTitleContributor.upsert({
      where: {
        catalogTitleId_contributorId_role: {
          catalogTitleId,
          contributorId: contributor.id,
          role: 'author',
        },
      },
      create: {
        catalogTitleId,
        contributorId: contributor.id,
        displayOrder,
        role: 'author',
      },
      update: {
        displayOrder,
      },
    });
  }

}
