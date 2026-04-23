import { WorkType, CatalogVerificationStatus } from '@prisma/client';
import { beforeEach, describe, expect, it } from '@jest/globals';

import { CatalogIngestionService } from '../src/modules/catalog/catalog-ingestion.service';
import type { PrismaService } from '../src/prisma/prisma.service';

type CatalogTitleRecord = {
  aliases: string[];
  canonicalTitle: string;
  country: string | null;
  createdAt: Date;
  displayTitle: string;
  franchiseId: string | null;
  id: string;
  mediumType: WorkType;
  originalTitle: string | null;
  releaseYear: number | null;
  subType: string | null;
  summary: string;
  thumbnailUrl: string;
  updatedAt: Date;
  verificationStatus: CatalogVerificationStatus;
};

type FranchiseRecord = {
  aliases: string[];
  canonicalName: string;
  displayName: string;
  id: string;
  originalName: string | null;
};

type CatalogExternalRefRecord = {
  catalogReleaseId: string | null;
  catalogTitleId: string | null;
  externalId: string;
  id: string;
  provider: string;
  rawType: string;
  url: string;
};

type CatalogReleaseRecord = {
  catalogTitleId: string;
  displayLabel: string;
  id: string;
  isbn: string | null;
  releaseDate: Date | null;
  releaseType: string;
  sequence: number | null;
  summary: string;
  thumbnailUrl: string;
  title: string;
  updatedAt: Date;
};

type ContributorRecord = {
  canonicalName: string;
  displayName: string;
  id: string;
};

type CatalogTitleContributorRecord = {
  catalogTitleId: string;
  contributorId: string;
  displayOrder: number;
  role: 'author';
};

function createTitle(
  overrides: Partial<CatalogTitleRecord> = {},
): CatalogTitleRecord {
  return {
    aliases: [],
    canonicalTitle: 'Dune',
    country: null,
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    displayTitle: 'Dune',
    franchiseId: null,
    id: crypto.randomUUID(),
    mediumType: WorkType.novel,
    originalTitle: null,
    releaseYear: null,
    subType: null,
    summary: '',
    thumbnailUrl: '',
    updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    verificationStatus: CatalogVerificationStatus.draft,
    ...overrides,
  };
}

function createFranchise(
  overrides: Partial<FranchiseRecord> = {},
): FranchiseRecord {
  return {
    aliases: [],
    canonicalName: 'Dune',
    displayName: 'Dune',
    id: crypto.randomUUID(),
    originalName: null,
    ...overrides,
  };
}

function createRelease(
  overrides: Partial<CatalogReleaseRecord> & Pick<CatalogReleaseRecord, 'catalogTitleId'>,
): CatalogReleaseRecord {
  return {
    displayLabel: 'Vol. 1',
    id: crypto.randomUUID(),
    isbn: null,
    releaseDate: null,
    releaseType: 'volume',
    sequence: 1,
    summary: '',
    thumbnailUrl: '',
    title: 'Vol. 1',
    updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    ...overrides,
  };
}

function createPrismaMock() {
  const titles: CatalogTitleRecord[] = [];
  const franchises: FranchiseRecord[] = [];
  const externalRefs: CatalogExternalRefRecord[] = [];
  const releases: CatalogReleaseRecord[] = [];
  const contributors: ContributorRecord[] = [];
  const titleContributors: CatalogTitleContributorRecord[] = [];

  function expandTitle(title: CatalogTitleRecord) {
    return {
      ...title,
      contributors: titleContributors
        .filter((entry) => entry.catalogTitleId === title.id)
        .map((entry) => ({
          ...entry,
          contributor: contributors.find(
            (contributor) => contributor.id === entry.contributorId,
          )!,
        })),
      externalRefs: externalRefs.filter((ref) => ref.catalogTitleId === title.id),
      franchise:
        franchises.find((franchise) => franchise.id === title.franchiseId) ?? null,
    };
  }

  function getTitle(id: string) {
    return titles.find((title) => title.id === id) ?? null;
  }

  function getRelease(id: string) {
    return releases.find((release) => release.id === id) ?? null;
  }

  const prisma = {
    catalogTitle: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const title = createTitle({
          canonicalTitle: String(data.canonicalTitle),
          country: (data.country as string | null | undefined) ?? null,
          displayTitle: String(data.displayTitle),
          franchiseId: (data.franchiseId as string | null | undefined) ?? null,
          id: (data.id as string | undefined) ?? crypto.randomUUID(),
          mediumType: data.mediumType as WorkType,
          releaseYear: (data.releaseYear as number | null | undefined) ?? null,
          subType: (data.subType as string | null | undefined) ?? null,
          summary: String(data.summary ?? ''),
          thumbnailUrl: String(data.thumbnailUrl ?? ''),
          verificationStatus:
            (data.verificationStatus as CatalogVerificationStatus | undefined) ??
            CatalogVerificationStatus.draft,
        });

        titles.push(title);

        return title;
      },
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) => {
        return titles
          .filter((title) => {
            if (where?.franchiseId && title.franchiseId !== where.franchiseId) {
              return false;
            }

            if (where?.mediumType && title.mediumType !== where.mediumType) {
              return false;
            }

            const verificationStatus = where?.verificationStatus as
              | { not?: CatalogVerificationStatus }
              | undefined;

            if (
              verificationStatus?.not &&
              title.verificationStatus === verificationStatus.not
            ) {
              return false;
            }

            return true;
          })
          .map(expandTitle);
      },
      findUnique: async ({
        where,
        select,
      }: {
        where: { id: string };
        select?: { id: true; mediumType: true };
      }) => {
        const title = getTitle(where.id);

        if (!title) {
          return null;
        }

        if (select) {
          return {
            id: title.id,
            mediumType: title.mediumType,
          };
        }

        return expandTitle(title);
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const title = getTitle(where.id);

        if (!title) {
          throw new Error('catalog title not found');
        }

        Object.assign(title, {
          ...data,
          updatedAt: new Date(),
        });

        return title;
      },
    },
    catalogExternalRef: {
      findUnique: async ({
        where,
      }: {
        where: {
          provider_rawType_externalId: {
            externalId: string;
            provider: string;
            rawType: string;
          };
        };
      }) => {
        const ref =
          externalRefs.find(
            (entry) =>
              entry.externalId ===
                where.provider_rawType_externalId.externalId &&
              entry.provider === where.provider_rawType_externalId.provider &&
              entry.rawType === where.provider_rawType_externalId.rawType,
          ) ?? null;

        if (!ref) {
          return null;
        }

        const release = ref.catalogReleaseId ? getRelease(ref.catalogReleaseId) : null;

        return {
          ...ref,
          catalogRelease: release
            ? {
                ...release,
                catalogTitle: expandTitle(getTitle(release.catalogTitleId)!),
              }
            : null,
          catalogTitle: ref.catalogTitleId ? expandTitle(getTitle(ref.catalogTitleId)!) : null,
        };
      },
      upsert: async ({
        create,
        update,
        where,
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
        where: {
          provider_rawType_externalId: {
            externalId: string;
            provider: string;
            rawType: string;
          };
        };
      }) => {
        const index = externalRefs.findIndex(
          (entry) =>
            entry.externalId === where.provider_rawType_externalId.externalId &&
            entry.provider === where.provider_rawType_externalId.provider &&
            entry.rawType === where.provider_rawType_externalId.rawType,
        );

        if (index >= 0) {
          externalRefs[index] = {
            ...externalRefs[index]!,
            ...update,
          } as CatalogExternalRefRecord;

          return externalRefs[index];
        }

        const ref: CatalogExternalRefRecord = {
          catalogReleaseId: (create.catalogReleaseId as string | null | undefined) ?? null,
          catalogTitleId: (create.catalogTitleId as string | null | undefined) ?? null,
          externalId: String(create.externalId),
          id: crypto.randomUUID(),
          provider: String(create.provider),
          rawType: String(create.rawType ?? ''),
          url: String(create.url ?? ''),
        };

        externalRefs.push(ref);

        return ref;
      },
    },
    catalogRelease: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const release = createRelease({
          catalogTitleId: String(data.catalogTitleId),
          displayLabel: String(data.displayLabel ?? ''),
          id: (data.id as string | undefined) ?? crypto.randomUUID(),
          isbn: (data.isbn as string | null | undefined) ?? null,
          releaseDate: (data.releaseDate as Date | null | undefined) ?? null,
          releaseType: String(data.releaseType ?? 'volume'),
          sequence: (data.sequence as number | null | undefined) ?? null,
          summary: String(data.summary ?? ''),
          thumbnailUrl: String(data.thumbnailUrl ?? ''),
          title: String(data.title ?? ''),
        });

        releases.push(release);

        return release;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        return (
          releases.find((release) => {
            if (release.catalogTitleId !== where.catalogTitleId) {
              return false;
            }

            if (where.isbn && release.isbn !== where.isbn) {
              return false;
            }

            const displayLabel = where.displayLabel as
              | { equals: string }
              | undefined;

            if (
              displayLabel &&
              release.displayLabel.toLowerCase() !== displayLabel.equals.toLowerCase()
            ) {
              return false;
            }

            if (where.sequence !== undefined && release.sequence !== where.sequence) {
              return false;
            }

            return true;
          }) ?? null
        );
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const release = getRelease(where.id);

        if (!release) {
          throw new Error('catalog release not found');
        }

        Object.assign(release, {
          ...data,
          updatedAt: new Date(),
        });

        return release;
      },
    },
    catalogTitleContributor: {
      upsert: async ({
        create,
        update,
        where,
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
        where: {
          catalogTitleId_contributorId_role: {
            catalogTitleId: string;
            contributorId: string;
            role: 'author';
          };
        };
      }) => {
        const existing = titleContributors.find(
          (entry) =>
            entry.catalogTitleId ===
              where.catalogTitleId_contributorId_role.catalogTitleId &&
            entry.contributorId ===
              where.catalogTitleId_contributorId_role.contributorId &&
            entry.role === where.catalogTitleId_contributorId_role.role,
        );

        if (existing) {
          existing.displayOrder = Number(update.displayOrder ?? existing.displayOrder);

          return existing;
        }

        const record: CatalogTitleContributorRecord = {
          catalogTitleId: String(create.catalogTitleId),
          contributorId: String(create.contributorId),
          displayOrder: Number(create.displayOrder ?? 0),
          role: 'author',
        };

        titleContributors.push(record);

        return record;
      },
    },
    contributor: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const contributor: ContributorRecord = {
          canonicalName: String(data.canonicalName),
          displayName: String(data.displayName),
          id: crypto.randomUUID(),
        };

        contributors.push(contributor);

        return contributor;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const displayName = (where.displayName as { equals: string }).equals.toLowerCase();

        return (
          contributors.find(
            (contributor) => contributor.displayName.toLowerCase() === displayName,
          ) ?? null
        );
      },
    },
    franchise: {
      create: async ({
        data,
        select,
      }: {
        data: Record<string, unknown>;
        select?: { id: true };
      }) => {
        const franchise = createFranchise({
          canonicalName: String(data.canonicalName),
          displayName: String(data.displayName),
          id: (data.id as string | undefined) ?? crypto.randomUUID(),
        });

        franchises.push(franchise);

        return select ? { id: franchise.id } : franchise;
      },
      findMany: async ({ where }: { where: { OR: Array<Record<string, unknown>> } }) => {
        return franchises.filter((franchise) => {
          const candidates = [
            franchise.canonicalName,
            franchise.displayName,
            franchise.originalName ?? '',
            ...franchise.aliases,
          ].map((value) => value.toLowerCase());

          return where.OR.some((entry) => {
            if ('aliases' in entry) {
              return candidates.includes(
                String((entry.aliases as { has: string }).has).toLowerCase(),
              );
            }

            const filterValue = Object.values(entry)[0] as { contains: string };

            return candidates.some((candidate) =>
              candidate.includes(filterValue.contains.toLowerCase()),
            );
          });
        });
      },
    },
  };

  return {
    data: {
      contributors,
      externalRefs,
      franchises,
      releases,
      titleContributors,
      titles,
    },
    prisma: prisma as unknown as PrismaService,
  };
}

describe('CatalogIngestionService', () => {
  let service: CatalogIngestionService;
  let store: ReturnType<typeof createPrismaMock>['data'];

  beforeEach(() => {
    const mock = createPrismaMock();

    store = mock.data;
    service = new CatalogIngestionService(mock.prisma);
  });

  it('reuses an existing catalog title when the same external ref already exists', async () => {
    const title = createTitle({
      displayTitle: 'Dune',
    });
    const release = createRelease({
      catalogTitleId: title.id,
      title: 'Dune Vol. 1',
    });

    store.titles.push(title);
    store.releases.push(release);
    store.externalRefs.push({
      catalogReleaseId: release.id,
      catalogTitleId: title.id,
      externalId: '123',
      id: crypto.randomUUID(),
      provider: 'aladin',
      rawType: 'volume',
      url: '',
    });

    const result = await service.createOrReuseTitleFromImportCandidate({
      canonicalTitle: 'Dune',
      mediumType: WorkType.novel,
      releaseCandidates: [
        {
          displayLabel: 'Vol. 1',
          externalRefs: [
            {
              externalId: '123',
              provider: 'aladin',
              rawType: 'volume',
            },
          ],
          releaseType: 'volume',
          sequence: 1,
          title: 'Dune Vol. 1',
        },
      ],
    });

    expect(result.id).toBe(title.id);
    expect(store.titles).toHaveLength(1);
  });

  it('does not overmatch on contributor and year when the title itself differs', async () => {
    const franchise = createFranchise({
      displayName: 'Dune Universe',
    });
    const title = createTitle({
      canonicalTitle: 'Dune Messiah',
      displayTitle: 'Dune Messiah',
      franchiseId: franchise.id,
      releaseYear: 1969,
    });
    const contributor: ContributorRecord = {
      canonicalName: 'Frank Herbert',
      displayName: 'Frank Herbert',
      id: crypto.randomUUID(),
    };

    store.franchises.push(franchise);
    store.titles.push(title);
    store.contributors.push(contributor);
    store.titleContributors.push({
      catalogTitleId: title.id,
      contributorId: contributor.id,
      displayOrder: 0,
      role: 'author',
    });

    const match = await service.findCatalogMatchForImportCandidate({
      contributorNames: ['Frank Herbert'],
      franchiseName: 'Dune Universe',
      mediumType: WorkType.novel,
      releaseYear: 1969,
      title: 'Dune',
    });

    expect(match).toBeNull();
  });

  it('does not create releases when the provider gave no release identity', async () => {
    const title = createTitle();

    store.titles.push(title);

    await expect(
      service.backfillCatalogTitleReleases(title.id, [
        {
          title: 'Dune',
        },
      ]),
    ).resolves.toEqual([]);
    expect(store.releases).toHaveLength(0);
  });

  it('dedupes releases by provider/externalId, then isbn, then sequence and label', async () => {
    const title = createTitle();

    store.titles.push(title);

    await service.backfillCatalogTitleReleases(title.id, [
      {
        displayLabel: 'Vol. 1',
        externalRefs: [
          {
            externalId: 'aladin-volume-1',
            provider: 'aladin',
            rawType: 'volume',
          },
        ],
        isbn: '978-1-23456-789-0',
        releaseType: 'volume',
        sequence: 1,
        title: 'Dune Vol. 1',
      },
    ]);
    await service.backfillCatalogTitleReleases(title.id, [
      {
        displayLabel: 'Vol. 1 (provider duplicate)',
        externalRefs: [
          {
            externalId: 'aladin-volume-1',
            provider: 'aladin',
            rawType: 'volume',
          },
        ],
        isbn: '9781234567890',
        releaseType: 'volume',
        sequence: 1,
        title: 'Provider Duplicate',
      },
    ]);
    await service.backfillCatalogTitleReleases(title.id, [
      {
        displayLabel: 'Vol. 1',
        isbn: '9781234567890',
        releaseType: 'volume',
        title: 'ISBN Duplicate',
      },
    ]);
    await service.backfillCatalogTitleReleases(title.id, [
      {
        displayLabel: 'Vol. 1',
        releaseType: 'volume',
        sequence: 1,
        title: 'Sequence Duplicate',
      },
    ]);

    expect(store.releases).toHaveLength(1);
    expect(store.releases[0]?.title).toBe('Sequence Duplicate');
  });
});
