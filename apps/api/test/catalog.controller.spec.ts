import { ForbiddenException } from '@nestjs/common';
import {
  CatalogRelationType,
  CatalogSubmissionStatus,
  CatalogTitleStatus,
  CatalogVerificationStatus,
  WorkType,
} from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { CatalogController } from '../src/modules/catalog/catalog.controller';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import type {
  CatalogRelatedRelationView,
  CatalogTitleView,
} from '../src/modules/catalog/catalog.service';

function createCatalogTitleView(
  overrides: Partial<CatalogTitleView> = {},
): CatalogTitleView {
  return {
    aliases: [],
    canonicalTitle: 'Steins;Gate',
    contributors: [],
    country: null,
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    displayTitle: 'Steins;Gate',
    endDate: null,
    externalRefs: [],
    franchise: {
      aliases: [],
      canonicalName: 'Science Adventure',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      description: '',
      displayName: 'Science Adventure',
      id: 'franchise-1',
      originalName: null,
      thumbnailUrl: '',
      updatedAt: new Date('2026-04-18T00:00:00.000Z'),
      verificationStatus: CatalogVerificationStatus.draft,
    },
    franchiseId: 'franchise-1',
    id: 'title-1',
    mediumType: WorkType.anime,
    originalTitle: null,
    releaseYear: 2011,
    startDate: null,
    status: CatalogTitleStatus.unknown,
    subType: 'tv',
    summary: '',
    thumbnailUrl: 'https://example.com/steinsgate.jpg',
    updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    verificationStatus: CatalogVerificationStatus.draft,
    ...overrides,
  };
}

function createRelatedRelation(
  overrides: Partial<CatalogRelatedRelationView> = {},
): CatalogRelatedRelationView {
  return {
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    id: 'relation-1',
    relationType: CatalogRelationType.sequel,
    sourceTitle: createCatalogTitleView(),
    sourceTitleId: 'title-1',
    targetTitle: createCatalogTitleView({
      displayTitle: 'Steins;Gate 0',
      id: 'title-2',
      mediumType: WorkType.anime,
      releaseYear: 2018,
      thumbnailUrl: 'https://example.com/steinsgate-zero.jpg',
    }),
    targetTitleId: 'title-2',
    ...overrides,
  };
}

describe('CatalogController', () => {
  let controller: CatalogController;
  let catalogService: jest.Mocked<
    Pick<
      CatalogService,
      'findRelatedTitleReadModel' | 'findTitlesByFranchise'
      | 'listSubmissions'
      | 'listUserSubmissions'
    >
  >;

  beforeEach(() => {
    catalogService = {
      findRelatedTitleReadModel: jest.fn(),
      findTitlesByFranchise: jest.fn(),
      listSubmissions: jest.fn(),
      listUserSubmissions: jest.fn(),
    };
    controller = new CatalogController(catalogService as unknown as CatalogService);
  });

  it('returns current title, same-franchise titles, and relationType metadata', async () => {
    const currentTitle = createCatalogTitleView();
    const sequel = createCatalogTitleView({
      displayTitle: 'Steins;Gate 0',
      id: 'title-2',
      releaseYear: 2018,
      thumbnailUrl: 'https://example.com/steinsgate-zero.jpg',
    });

    catalogService.findRelatedTitleReadModel.mockResolvedValue({
      currentTitle,
      relations: [createRelatedRelation()],
      sameFranchiseTitles: [sequel],
    });

    const result = await controller.findRelated('title-1');

    expect(result.currentTitle.displayTitle).toBe('Steins;Gate');
    expect(result.sameFranchiseTitles).toEqual([
      expect.objectContaining({
        id: 'title-2',
        relationType: CatalogRelationType.sequel,
        thumbnailUrl: 'https://example.com/steinsgate-zero.jpg',
        title: 'Steins;Gate 0',
      }),
    ]);
    expect(result.relations).toEqual([
      expect.objectContaining({
        relationDirection: 'outgoing',
        relationType: CatalogRelationType.sequel,
        targetTitle: expect.objectContaining({
          id: 'title-2',
          title: 'Steins;Gate 0',
        }),
      }),
    ]);
  });

  it('returns franchise titles for the requested franchise id', async () => {
    catalogService.findTitlesByFranchise.mockResolvedValue([
      createCatalogTitleView(),
      createCatalogTitleView({
        displayTitle: 'Steins;Gate 0',
        id: 'title-2',
        releaseYear: 2018,
      }),
    ]);

    const result = await controller.findFranchiseTitles('franchise-1');

    expect(result.franchiseId).toBe('franchise-1');
    expect(result.titles).toEqual([
      expect.objectContaining({
        displayTitle: 'Steins;Gate',
      }),
      expect.objectContaining({
        displayTitle: 'Steins;Gate 0',
      }),
    ]);
  });

  it('delegates the full submission list with moderator identity only', async () => {
    catalogService.listSubmissions.mockResolvedValue([]);

    const result = await controller.listSubmissions(
      {
        email: 'mod@example.com',
        role: 'moderator',
        sessionId: 'session-1',
        userId: 'moderator-1',
      },
      { status: CatalogSubmissionStatus.pending },
    );

    expect(result).toEqual([]);
    expect(catalogService.listSubmissions).toHaveBeenCalledWith(
      {
        role: 'moderator',
        userId: 'moderator-1',
      },
      CatalogSubmissionStatus.pending,
    );
  });

  it('propagates the moderation guard when a regular user requests all submissions', () => {
    catalogService.listSubmissions.mockImplementation(() => {
      throw new ForbiddenException('Catalog moderation requires moderator access.');
    });

    expect(() =>
      controller.listSubmissions(
        {
          email: 'user@example.com',
          role: 'user',
          sessionId: 'session-1',
          userId: 'user-1',
        },
        {},
      ),
    ).toThrow('Catalog moderation requires moderator access.');
  });

  it('lets a regular user list only their own submissions', async () => {
    catalogService.listUserSubmissions.mockResolvedValue([]);

    const result = await controller.listMySubmissions(
      {
        email: 'user@example.com',
        role: 'user',
        sessionId: 'session-1',
        userId: 'user-1',
      },
      { status: CatalogSubmissionStatus.pending },
    );

    expect(result).toEqual([]);
    expect(catalogService.listUserSubmissions).toHaveBeenCalledWith(
      'user-1',
      CatalogSubmissionStatus.pending,
    );
    expect(catalogService.listSubmissions).not.toHaveBeenCalled();
  });
});

describe('CatalogService submission listing', () => {
  it('rejects full submission listing for regular users before querying storage', () => {
    const prisma = {
      catalogSubmission: {
        findMany: jest.fn(),
      },
    };
    const service = new CatalogService(prisma as never, {} as never);

    expect(() =>
      service.listSubmissions({
        role: 'user',
        userId: 'user-1',
      }),
    ).toThrow('Catalog moderation requires moderator access.');
    expect(prisma.catalogSubmission.findMany).not.toHaveBeenCalled();
  });

  it('allows moderators and admins to list all submissions', async () => {
    const prisma = {
      catalogSubmission: {
        findMany: jest.fn(async () => []),
      },
    };
    const service = new CatalogService(prisma as never, {} as never);

    await expect(
      service.listSubmissions(
        {
          role: 'moderator',
          userId: 'moderator-1',
        },
        CatalogSubmissionStatus.pending,
      ),
    ).resolves.toEqual([]);
    await expect(
      service.listSubmissions({
        role: 'admin',
        userId: 'admin-1',
      }),
    ).resolves.toEqual([]);
    expect(prisma.catalogSubmission.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.catalogSubmission.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          status: CatalogSubmissionStatus.pending,
        },
      }),
    );
  });

  it('filters self-service submission listing by submitter', async () => {
    const prisma = {
      catalogSubmission: {
        findMany: jest.fn(async () => []),
      },
    };
    const service = new CatalogService(prisma as never, {} as never);

    await expect(
      service.listUserSubmissions('user-1', CatalogSubmissionStatus.pending),
    ).resolves.toEqual([]);

    expect(prisma.catalogSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: CatalogSubmissionStatus.pending,
          submitterId: 'user-1',
        },
      }),
    );
  });
});
