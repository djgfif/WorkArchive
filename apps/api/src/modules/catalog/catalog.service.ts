import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogSubmissionStatus,
  CatalogVerificationStatus,
  type Prisma,
  type UserRole,
  type WorkType,
} from '@prisma/client';
import { normalizeWorkGenres } from '@work-archive/shared-types';

import {
  CatalogIngestionService,
  type CreateCatalogTitleInput,
  type CatalogReleaseCandidateInput,
} from './catalog-ingestion.service';
import { PrismaService } from '../../prisma/prisma.service';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

const CATALOG_TITLE_INCLUDE = {
  franchise: true,
  contributors: {
    include: {
      contributor: true,
    },
    orderBy: {
      displayOrder: 'asc',
    },
  },
  externalRefs: true,
} satisfies Prisma.CatalogTitleInclude;

const RELATED_TITLE_INCLUDE = {
  sourceTitle: {
    include: {
      franchise: true,
    },
  },
  targetTitle: {
    include: {
      franchise: true,
    },
  },
} satisfies Prisma.CatalogRelationInclude;

export type CatalogTitleView = Prisma.CatalogTitleGetPayload<{
  include: typeof CATALOG_TITLE_INCLUDE;
}>;

export type CatalogRelatedRelationView = Prisma.CatalogRelationGetPayload<{
  include: typeof RELATED_TITLE_INCLUDE;
}>;

interface SearchCatalogOptions {
  mediumType?: WorkType;
  query: string;
}

interface CreateTitleFromLegacyWorkInput {
  id: string;
  type?: WorkType;
  title: string;
  author?: string;
  genres?: string[];
  description?: string;
  thumbnailUrl?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

function normalizeCatalogWorkGenres<T extends { genres?: unknown }>(
  data: T,
): T {
  if (!Array.isArray(data.genres)) {
    return data;
  }

  return {
    ...data,
    genres: normalizeWorkGenres(
      data.genres.filter((value): value is string => typeof value === 'string'),
    ),
  };
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogIngestionService)
    private readonly catalogIngestionService: CatalogIngestionService,
  ) {}

  async create(
    data: Prisma.CatalogWorkUncheckedCreateInput,
    client: PrismaClientLike = this.prisma,
  ) {
    const catalogWork = await client.catalogWork.create({
      data: normalizeCatalogWorkGenres(data),
    });

    await this.ensureTitleForLegacyWork(catalogWork, client);

    return catalogWork;
  }

  async update(
    id: string,
    data: Prisma.CatalogWorkUpdateInput,
    client: PrismaClientLike = this.prisma,
  ) {
    const catalogWork = await client.catalogWork.update({
      where: {
        id,
      },
      data: normalizeCatalogWorkGenres(data),
    });

    await this.ensureTitleForLegacyWork(catalogWork, client);

    return catalogWork;
  }

  async search({ mediumType, query }: SearchCatalogOptions) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      throw new BadRequestException('query must not be empty');
    }

    return this.prisma.catalogTitle.findMany({
      where: {
        ...(mediumType
          ? {
              mediumType,
            }
          : {}),
        OR: [
          {
            canonicalTitle: {
              contains: normalizedQuery,
              mode: 'insensitive',
            },
          },
          {
            displayTitle: {
              contains: normalizedQuery,
              mode: 'insensitive',
            },
          },
          {
            originalTitle: {
              contains: normalizedQuery,
              mode: 'insensitive',
            },
          },
          {
            aliases: {
              has: normalizedQuery,
            },
          },
        ],
      },
      include: CATALOG_TITLE_INCLUDE,
      orderBy: [{ verificationStatus: 'desc' }, { updatedAt: 'desc' }],
      take: 25,
    });
  }

  async findTitleOrThrow(id: string) {
    const title = await this.prisma.catalogTitle.findUnique({
      where: {
        id,
      },
      include: CATALOG_TITLE_INCLUDE,
    });

    if (!title) {
      throw new NotFoundException(
        `Catalog title with id "${id}" was not found.`,
      );
    }

    return title;
  }

  async findRelatedTitleReadModel(id: string) {
    const currentTitle = await this.findTitleOrThrow(id);
    const [relations, sameFranchiseTitles] = await Promise.all([
      this.findRelatedTitles(id),
      currentTitle.franchiseId
        ? this.findTitlesByFranchise(currentTitle.franchiseId).then((titles) =>
            titles.filter((title) => title.id !== id),
          )
        : Promise.resolve([]),
    ]);

    return {
      currentTitle,
      relations,
      sameFranchiseTitles,
    };
  }

  findRelatedTitles(id: string) {
    return this.prisma.catalogRelation.findMany({
      where: {
        OR: [
          {
            sourceTitleId: id,
          },
          {
            targetTitleId: id,
          },
        ],
      },
      include: RELATED_TITLE_INCLUDE,
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  findTitlesByFranchise(franchiseId: string) {
    return this.prisma.catalogTitle.findMany({
      where: {
        franchiseId,
      },
      include: CATALOG_TITLE_INCLUDE,
      orderBy: [
        { mediumType: 'asc' },
        { releaseYear: 'asc' },
        { displayTitle: 'asc' },
      ],
    });
  }

  findTitlesByContributor(contributorId: string) {
    return this.prisma.catalogTitle.findMany({
      where: {
        contributors: {
          some: {
            contributorId,
          },
        },
      },
      include: CATALOG_TITLE_INCLUDE,
      orderBy: [{ releaseYear: 'asc' }, { displayTitle: 'asc' }],
    });
  }

  async createTitleFromImportCandidate(
    input: CreateCatalogTitleInput,
    client: PrismaClientLike = this.prisma,
  ) {
    return this.catalogIngestionService.createOrReuseTitleFromImportCandidate(
      input,
      client,
    );
  }

  backfillTitleReleases(
    catalogTitleId: string,
    releaseCandidates: CatalogReleaseCandidateInput[],
    client: PrismaClientLike = this.prisma,
  ) {
    return this.catalogIngestionService.backfillCatalogTitleReleases(
      catalogTitleId,
      releaseCandidates,
      client,
    );
  }

  async submitCatalogChange(
    submitterId: string,
    input: {
      action: string;
      entityId?: string | null;
      entityType: string;
      note?: string;
      payload: Record<string, unknown>;
    },
  ) {
    return this.prisma.catalogSubmission.create({
      data: {
        action: input.action,
        entityId: input.entityId ?? null,
        entityType: input.entityType,
        note: input.note?.trim() ?? '',
        payload: input.payload as Prisma.InputJsonObject,
        submitterId,
      },
    });
  }

  listSubmissions(
    viewer: { role: UserRole; userId: string },
    status?: CatalogSubmissionStatus,
  ) {
    this.assertCanModerate(viewer.role);

    const options: Prisma.CatalogSubmissionFindManyArgs = {
      orderBy: {
        createdAt: 'asc',
      },
      take: 100,
    };

    if (status) {
      options.where = {
        status,
      };
    }

    return this.prisma.catalogSubmission.findMany(options);
  }

  listUserSubmissions(submitterId: string, status?: CatalogSubmissionStatus) {
    return this.prisma.catalogSubmission.findMany({
      where: {
        submitterId,
        ...(status ? { status } : {}),
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 100,
    });
  }

  async approveSubmission(
    reviewer: { role: UserRole; userId: string },
    submissionId: string,
    reviewNote = '',
  ) {
    this.assertCanModerate(reviewer.role);

    const submission = await this.getSubmissionOrThrow(submissionId);

    if (submission.status !== CatalogSubmissionStatus.pending) {
      throw new BadRequestException(
        'Only pending submissions can be approved.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.catalogSubmission.update({
        where: {
          id: submissionId,
        },
        data: {
          reviewedAt: new Date(),
          reviewerId: reviewer.userId,
          reviewNote,
          status: CatalogSubmissionStatus.approved,
        },
      });

      await tx.catalogAuditLog.create({
        data: {
          action: 'submission.approve',
          actorId: reviewer.userId,
          after: updated as unknown as Prisma.InputJsonValue,
          entityId: submission.entityId ?? submission.id,
          entityType: submission.entityType,
        },
      });

      return updated;
    });
  }

  async rejectSubmission(
    reviewer: { role: UserRole; userId: string },
    submissionId: string,
    reviewNote = '',
  ) {
    this.assertCanModerate(reviewer.role);

    const submission = await this.getSubmissionOrThrow(submissionId);

    if (submission.status !== CatalogSubmissionStatus.pending) {
      throw new BadRequestException(
        'Only pending submissions can be rejected.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.catalogSubmission.update({
        where: {
          id: submissionId,
        },
        data: {
          reviewedAt: new Date(),
          reviewerId: reviewer.userId,
          reviewNote,
          status: CatalogSubmissionStatus.rejected,
        },
      });

      await tx.catalogAuditLog.create({
        data: {
          action: 'submission.reject',
          actorId: reviewer.userId,
          after: updated as unknown as Prisma.InputJsonValue,
          entityId: submission.entityId ?? submission.id,
          entityType: submission.entityType,
        },
      });

      return updated;
    });
  }

  async mergeTitle(
    actor: { role: UserRole; userId: string },
    sourceTitleId: string,
    targetTitleId: string,
  ) {
    this.assertCanModerate(actor.role);

    if (sourceTitleId === targetTitleId) {
      throw new BadRequestException(
        'sourceTitleId and targetTitleId must differ.',
      );
    }

    const [source, target] = await Promise.all([
      this.prisma.catalogTitle.findUnique({
        where: {
          id: sourceTitleId,
        },
      }),
      this.prisma.catalogTitle.findUnique({
        where: {
          id: targetTitleId,
        },
      }),
    ]);

    if (!source || !target) {
      throw new NotFoundException(
        'Both source and target catalog titles must exist.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.userWorkRecord.updateMany({
        where: {
          catalogTitleId: sourceTitleId,
        },
        data: {
          catalogTitleId: targetTitleId,
        },
      });

      await tx.catalogExternalRef.updateMany({
        where: {
          catalogTitleId: sourceTitleId,
        },
        data: {
          catalogTitleId: targetTitleId,
        },
      });

      const merged = await tx.catalogTitle.update({
        where: {
          id: sourceTitleId,
        },
        data: {
          verificationStatus: CatalogVerificationStatus.merged,
        },
      });

      await tx.catalogAuditLog.create({
        data: {
          action: 'title.merge',
          actorId: actor.userId,
          after: {
            sourceTitleId,
            targetTitleId,
          },
          before: source as unknown as Prisma.InputJsonValue,
          entityId: sourceTitleId,
          entityType: 'catalogTitle',
        },
      });

      return merged;
    });
  }

  async ensureTitleForLegacyWork(
    work: CreateTitleFromLegacyWorkInput,
    client: PrismaClientLike = this.prisma,
  ) {
    const displayTitle = work.title.trim();

    if (!displayTitle) {
      return null;
    }

    const createData: Prisma.CatalogTitleUncheckedCreateInput = {
      canonicalTitle: displayTitle,
      displayTitle,
      id: work.id,
      mediumType: work.type ?? 'other',
      summary: work.description?.trim() ?? '',
      thumbnailUrl: work.thumbnailUrl?.trim() ?? '',
    };
    const updateData: Prisma.CatalogTitleUncheckedUpdateInput = {
      canonicalTitle: displayTitle,
      displayTitle,
      summary: work.description?.trim() ?? '',
      thumbnailUrl: work.thumbnailUrl?.trim() ?? '',
    };

    if (work.createdAt !== undefined) {
      createData.createdAt = work.createdAt;
    }

    if (work.updatedAt !== undefined) {
      createData.updatedAt = work.updatedAt;
    }

    if (work.type !== undefined) {
      updateData.mediumType = work.type;
    }

    return client.catalogTitle.upsert({
      where: {
        id: work.id,
      },
      create: createData,
      update: updateData,
    });
  }

  private async getSubmissionOrThrow(submissionId: string) {
    const submission = await this.prisma.catalogSubmission.findUnique({
      where: {
        id: submissionId,
      },
    });

    if (!submission) {
      throw new NotFoundException(
        `Catalog submission with id "${submissionId}" was not found.`,
      );
    }

    return submission;
  }

  private assertCanModerate(role: UserRole) {
    if (role !== 'moderator' && role !== 'admin') {
      throw new ForbiddenException(
        'Catalog moderation requires moderator access.',
      );
    }
  }
}
