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

interface ContributorMatchInput {
  name: string;
}

export interface CatalogExternalRefInput {
  externalId: string;
  provider: string;
  rawType?: string;
  url?: string;
}

export interface CatalogReleaseCandidateInput {
  displayLabel?: string;
  externalRefs?: CatalogExternalRefInput[];
  isbn?: string | null;
  releaseDate?: Date | string | null;
  releaseType?: string;
  sequence?: number | null;
  summary?: string;
  thumbnailUrl?: string;
  title?: string;
}

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

export interface CatalogMatchView {
  id: string;
  title: string;
  verificationStatus: CatalogVerificationStatus;
}

type CatalogTitleMatch = Prisma.CatalogTitleGetPayload<{
  include: typeof TITLE_MATCH_INCLUDE;
}>;

type NormalizedExternalRef = Required<CatalogExternalRefInput>;

type NormalizedReleaseCandidate = {
  displayLabel: string;
  externalRefs: NormalizedExternalRef[];
  isbn: string | null;
  releaseDate: Date | null;
  releaseType: string;
  sequence: number | null;
  summary: string;
  thumbnailUrl: string;
  title: string;
};

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
          data: this.buildCatalogTitleUpdateData(existing, {
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
      const normalizedRef = this.normalizeExternalRef(ref);

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

    return match ? this.toCatalogMatchView(match) : null;
  }

  private buildCatalogTitleUpdateData(
    existing: Pick<
      CatalogTitleMatch,
      'country' | 'franchiseId' | 'releaseYear' | 'subType' | 'summary' | 'thumbnailUrl'
    >,
    input: {
      country: string | null;
      franchiseId: string | null;
      releaseYear: number | null;
      subType: string | null;
      summary: string;
      thumbnailUrl: string;
    },
  ): Prisma.CatalogTitleUncheckedUpdateInput {
    const data: Prisma.CatalogTitleUncheckedUpdateInput = {};

    if (!existing.franchiseId && input.franchiseId) {
      data.franchiseId = input.franchiseId;
    }

    if (!existing.country && input.country) {
      data.country = input.country;
    }

    if (existing.releaseYear === null && input.releaseYear !== null) {
      data.releaseYear = input.releaseYear;
    }

    if (!existing.subType && input.subType) {
      data.subType = input.subType;
    }

    if (!existing.summary.trim() && input.summary) {
      data.summary = input.summary;
    }

    if (!existing.thumbnailUrl.trim() && input.thumbnailUrl) {
      data.thumbnailUrl = input.thumbnailUrl;
    }

    return data;
  }

  private async upsertCatalogRelease(
    catalogTitleId: string,
    candidate: CatalogReleaseCandidateInput,
    client: PrismaClientLike,
  ) {
    const normalizedCandidate = this.normalizeReleaseCandidate(candidate);

    if (!this.hasReleaseIdentity(normalizedCandidate)) {
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
          data: this.buildCatalogReleaseUpdateData(existing, normalizedCandidate),
        })
      : await client.catalogRelease.create({
          data: {
            catalogTitleId,
            ...this.buildCatalogReleaseCreateData(normalizedCandidate),
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

  private buildCatalogReleaseCreateData(
    candidate: Omit<NormalizedReleaseCandidate, 'externalRefs'>,
  ) {
    return {
      displayLabel: candidate.displayLabel,
      isbn: candidate.isbn,
      releaseDate: candidate.releaseDate,
      releaseType: candidate.releaseType,
      sequence: candidate.sequence,
      summary: candidate.summary,
      thumbnailUrl: candidate.thumbnailUrl,
      title: candidate.title,
    };
  }

  private buildCatalogReleaseUpdateData(
    existing: CatalogRelease,
    candidate: Omit<NormalizedReleaseCandidate, 'externalRefs'>,
  ) {
    return {
      displayLabel: candidate.displayLabel || existing.displayLabel,
      isbn: candidate.isbn ?? existing.isbn,
      releaseDate: candidate.releaseDate ?? existing.releaseDate,
      releaseType: candidate.releaseType || existing.releaseType,
      sequence: candidate.sequence ?? existing.sequence,
      summary: candidate.summary || existing.summary,
      thumbnailUrl: candidate.thumbnailUrl || existing.thumbnailUrl,
      title: candidate.title || existing.title,
    };
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
      const normalizedRef = this.normalizeExternalRef(ref);

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
      const bestFranchiseMatch = this.pickBestTitleMatch(
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
      const bestContributorMatch = this.pickBestTitleMatch(
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

  private pickBestTitleMatch(
    titles: CatalogTitleMatch[],
    displayTitle: string,
    releaseYear: number | null,
    contributorHints: ContributorMatchInput[],
  ) {
    const normalizedTitle = this.normalizeForMatch(displayTitle);
    const normalizedContributorHints = contributorHints
      .map((entry) => this.normalizeForMatch(entry.name))
      .filter(Boolean);
    let bestMatch: CatalogTitleMatch | null = null;
    let bestScore = -1;

    for (const title of titles) {
      if (!this.hasMatchingTitleName(title, normalizedTitle)) {
        continue;
      }

      if (
        releaseYear !== null &&
        title.releaseYear !== null &&
        Math.abs(title.releaseYear - releaseYear) > 1
      ) {
        continue;
      }

      let score = 10 + this.getVerificationScore(title.verificationStatus);

      if (releaseYear !== null && title.releaseYear === releaseYear) {
        score += 4;
      }

      if (normalizedContributorHints.length > 0) {
        const contributorNames = title.contributors
          .map((entry) => this.normalizeForMatch(entry.contributor.displayName))
          .filter(Boolean);
        const overlapCount = normalizedContributorHints.filter((hint) =>
          contributorNames.includes(hint),
        ).length;

        if (overlapCount === 0) {
          continue;
        }

        score += overlapCount * 3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = title;
      }
    }

    return bestMatch;
  }

  private hasMatchingTitleName(title: CatalogTitleMatch, normalizedTitle: string) {
    if (!normalizedTitle) {
      return false;
    }

    const candidates = [
      title.canonicalTitle,
      title.displayTitle,
      title.originalTitle ?? '',
      ...title.aliases,
    ];

    return candidates.some(
      (candidate) => this.normalizeForMatch(candidate) === normalizedTitle,
    );
  }

  private getVerificationScore(status: CatalogVerificationStatus) {
    switch (status) {
      case CatalogVerificationStatus.verified:
        return 4;
      case CatalogVerificationStatus.pending:
        return 2;
      case CatalogVerificationStatus.draft:
        return 1;
      default:
        return 0;
    }
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
    const normalizedName = this.normalizeForMatch(displayName);

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
      ].some((entry) => this.normalizeForMatch(entry) === normalizedName);
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

  private normalizeReleaseCandidate(
    candidate: CatalogReleaseCandidateInput,
  ): NormalizedReleaseCandidate {
    const sequence =
      candidate.sequence !== undefined &&
      candidate.sequence !== null &&
      Number.isFinite(candidate.sequence)
        ? candidate.sequence
        : null;
    const title = candidate.title?.trim() ?? '';
    const displayLabel =
      candidate.displayLabel?.trim() || (sequence !== null ? `Vol. ${sequence}` : title);

    return {
      displayLabel,
      externalRefs: (candidate.externalRefs ?? [])
        .map((ref) => this.normalizeExternalRef(ref))
        .filter((ref): ref is NormalizedExternalRef => ref !== null),
      isbn: this.normalizeIsbn(candidate.isbn ?? null),
      releaseDate: this.normalizeDate(candidate.releaseDate ?? null),
      releaseType: candidate.releaseType?.trim() || 'volume',
      sequence,
      summary: candidate.summary?.trim() ?? '',
      thumbnailUrl: candidate.thumbnailUrl?.trim() ?? '',
      title,
    };
  }

  private hasReleaseIdentity(
    candidate: Pick<
      NormalizedReleaseCandidate,
      'displayLabel' | 'externalRefs' | 'isbn' | 'sequence'
    >,
  ) {
    return (
      candidate.externalRefs.length > 0 ||
      candidate.isbn !== null ||
      (candidate.sequence !== null && candidate.displayLabel.length > 0)
    );
  }

  private normalizeExternalRef(input: CatalogExternalRefInput) {
    const provider = input.provider.trim();
    const externalId = input.externalId.trim();

    if (!provider || !externalId) {
      return null;
    }

    return {
      externalId,
      provider,
      rawType: input.rawType?.trim() ?? '',
      url: input.url?.trim() ?? '',
    };
  }

  private normalizeDate(value: Date | string | null) {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    if (/^\d{4}$/.test(trimmedValue)) {
      return new Date(`${trimmedValue}-01-01T00:00:00.000Z`);
    }

    if (/^\d{4}-\d{2}$/.test(trimmedValue)) {
      return new Date(`${trimmedValue}-01T00:00:00.000Z`);
    }

    const parsed = new Date(trimmedValue);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private normalizeIsbn(value: string | null) {
    if (!value) {
      return null;
    }

    const normalized = value.replace(/[^0-9Xx]/g, '').toUpperCase();

    return normalized.length >= 10 ? normalized : null;
  }

  private normalizeForMatch(value: string) {
    return value
      .toLowerCase()
      .normalize('NFKC')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private toCatalogMatchView(
    title: Pick<CatalogTitleMatch, 'displayTitle' | 'id' | 'verificationStatus'>,
  ): CatalogMatchView {
    return {
      id: title.id,
      title: title.displayTitle,
      verificationStatus: title.verificationStatus,
    };
  }
}
