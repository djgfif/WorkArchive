import { type AddressInfo } from 'node:net';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WorkStatus, WorkSyncStatus, WorkType } from '@prisma/client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { AppModule } from '../src/app.module';
import { readApiRuntimeConfig } from '../src/config/api-runtime-config';
import { configureApp } from '../src/configure-app';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestSession } from './test-auth-session';

function createPrismaServiceMock() {
  const users: Array<Record<string, unknown>> = [];
  const catalogWorks: Array<Record<string, unknown>> = [];
  const catalogTitles: Array<Record<string, unknown>> = [];
  const catalogExternalRefs: Array<Record<string, unknown>> = [];
  const userWorkRecords: Array<Record<string, unknown>> = [];
  const userReleaseRecords: Array<Record<string, unknown>> = [];
  const userTimelineEntries: Array<Record<string, unknown>> = [];
  const userRefreshSessions: Array<Record<string, unknown>> = [];
  const userSyncAppliedMutations: Array<Record<string, unknown>> = [];
  const externalApiCredentials: Array<Record<string, unknown>> = [];
  const securityEvents: Array<Record<string, unknown>> = [];

  function buildServerVersion(
    currentVersion: number,
    nextVersionInput: unknown,
  ) {
    if (
      typeof nextVersionInput === 'object' &&
      nextVersionInput !== null &&
      'increment' in nextVersionInput
    ) {
      return (
        currentVersion +
        Number((nextVersionInput as { increment: number }).increment)
      );
    }

    return typeof nextVersionInput === 'number'
      ? nextVersionInput
      : currentVersion;
  }

  function getCatalogWorkById(id: string) {
    return catalogWorks.find((catalogWork) => catalogWork.id === id) ?? null;
  }

  function getCatalogTitleById(id: string | null | undefined) {
    if (!id) {
      return null;
    }

    return catalogTitles.find((catalogTitle) => catalogTitle.id === id) ?? null;
  }

  function getSortDirections(orderBy: unknown) {
    let updatedAtDirection: 'asc' | 'desc' = 'desc';
    let idDirection: 'asc' | 'desc' = 'desc';

    if (Array.isArray(orderBy)) {
      for (const entry of orderBy) {
        if (
          entry &&
          typeof entry === 'object' &&
          'updatedAt' in entry &&
          (entry.updatedAt === 'asc' || entry.updatedAt === 'desc')
        ) {
          updatedAtDirection = entry.updatedAt;
        }

        if (
          entry &&
          typeof entry === 'object' &&
          'id' in entry &&
          (entry.id === 'asc' || entry.id === 'desc')
        ) {
          idDirection = entry.id;
        }
      }

      return {
        idDirection,
        updatedAtDirection,
      };
    }

    if (
      orderBy &&
      typeof orderBy === 'object' &&
      'updatedAt' in orderBy &&
      (orderBy.updatedAt === 'asc' || orderBy.updatedAt === 'desc')
    ) {
      updatedAtDirection = orderBy.updatedAt;
    }

    if (
      orderBy &&
      typeof orderBy === 'object' &&
      'id' in orderBy &&
      (orderBy.id === 'asc' || orderBy.id === 'desc')
    ) {
      idDirection = orderBy.id;
    }

    return {
      idDirection,
      updatedAtDirection,
    };
  }

  function joinRecord(record: Record<string, unknown>) {
    return {
      ...record,
      catalogWork: getCatalogWorkById(record.catalogWorkId as string),
      catalogTitle: getCatalogTitleById(record.catalogTitleId as string | null),
    };
  }

  function joinTimelineEntry(entry: Record<string, unknown>) {
    const parent =
      userWorkRecords.find((record) => record.id === entry.userWorkRecordId) ??
      null;

    return {
      ...entry,
      userWorkRecord: parent
        ? {
            id: parent.id,
            userId: parent.userId,
          }
        : null,
    };
  }

  const prismaMock: Record<string, unknown> = {};

  prismaMock.$transaction = async <T>(
    input: Promise<T>[] | ((client: typeof prismaMock) => Promise<T>),
  ) => {
    if (typeof input === 'function') {
      return input(prismaMock);
    }

    return Promise.all(input);
  };

  prismaMock.user = {
    findUnique: async ({
      where,
    }: {
      where: {
        email?: string;
        id?: string;
      };
    }) =>
      users.find((user) => {
        if (where.id && user.id !== where.id) {
          return false;
        }

        if (where.email && user.email !== where.email) {
          return false;
        }

        return true;
      }) ?? null,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const now = new Date();
      const user = {
        avatarUrl: data.avatarUrl ?? '',
        id: data.id ?? crypto.randomUUID(),
        email: data.email,
        nickname: data.nickname ?? '',
        role: data.role ?? 'user',
        createdAt: now,
        updatedAt: now,
      };

      users.push(user);

      return user;
    },
    update: async ({
      where,
      data,
    }: {
      where: {
        id: string;
      };
      data: Record<string, unknown>;
    }) => {
      const index = users.findIndex((user) => user.id === where.id);

      if (index === -1) {
        throw new Error('user not found');
      }

      const updatedUser = {
        ...users[index],
        ...data,
        updatedAt: new Date(),
      };

      users[index] = updatedUser;

      return updatedUser;
    },
  };
  prismaMock.userRefreshSession = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const now = new Date();
      const session = {
        id: data.id ?? crypto.randomUUID(),
        userId: data.userId,
        tokenHash: data.tokenHash,
        previousTokenHash: data.previousTokenHash ?? null,
        previousRotatedAt: data.previousRotatedAt ?? null,
        rememberMe: data.rememberMe ?? true,
        userAgent: data.userAgent ?? null,
        ipAddress: data.ipAddress ?? null,
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
        lastUsedAt: data.lastUsedAt ?? null,
        rotatedAt: data.rotatedAt ?? null,
        expiresAt: data.expiresAt,
        revokedAt: data.revokedAt ?? null,
      };

      userRefreshSessions.push(session);

      return session;
    },
    findUnique: async ({
      include,
      where,
    }: {
      include?: {
        user?: boolean;
      };
      where: {
        id: string;
      };
    }) => {
      const session =
        userRefreshSessions.find((candidate) => candidate.id === where.id) ??
        null;

      if (!session || !include?.user) {
        return session;
      }

      return {
        ...session,
        user: users.find((user) => user.id === session.userId),
      };
    },
    findMany: async ({
      orderBy,
      where,
    }: {
      orderBy?: {
        createdAt?: 'asc' | 'desc';
      };
      where?: {
        expiresAt?: {
          gt: Date;
        };
        revokedAt?: null;
        userId?: string;
      };
    } = {}) =>
      [...userRefreshSessions]
        .filter((session) => {
          if (where?.userId && session.userId !== where.userId) {
            return false;
          }

          if (where?.revokedAt === null && session.revokedAt !== null) {
            return false;
          }

          if (
            where?.expiresAt?.gt &&
            new Date(session.expiresAt as Date).getTime() <=
              where.expiresAt.gt.getTime()
          ) {
            return false;
          }

          return true;
        })
        .sort((left, right) => {
          const delta =
            new Date(left.createdAt as Date).getTime() -
            new Date(right.createdAt as Date).getTime();

          return orderBy?.createdAt === 'asc' ? delta : -delta;
        }),
    update: async ({
      data,
      where,
    }: {
      data: Record<string, unknown>;
      where: {
        id: string;
      };
    }) => {
      const index = userRefreshSessions.findIndex(
        (session) => session.id === where.id,
      );

      if (index === -1) {
        throw new Error('session not found');
      }

      const updatedSession = {
        ...userRefreshSessions[index],
        ...data,
        updatedAt: new Date(),
      };

      userRefreshSessions[index] = updatedSession;

      return updatedSession;
    },
    updateMany: async ({
      data,
      where,
    }: {
      data: Record<string, unknown>;
      where: {
        id?: string;
        revokedAt?: null;
        userId?: string;
      };
    }) => {
      let count = 0;

      for (const session of userRefreshSessions) {
        if (where.id && session.id !== where.id) {
          continue;
        }

        if (where.userId && session.userId !== where.userId) {
          continue;
        }

        if ('revokedAt' in where && session.revokedAt !== where.revokedAt) {
          continue;
        }

        Object.assign(session, data, {
          updatedAt: new Date(),
        });
        count += 1;
      }

      return {
        count,
      };
    },
  };
  prismaMock.catalogWork = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const now = new Date();
      const catalogWork = {
        id: data.id ?? crypto.randomUUID(),
        type: data.type ?? WorkType.novel,
        title: data.title,
        author: data.author ?? '',
        genres: data.genres ?? [],
        description: data.description ?? '',
        thumbnailUrl: data.thumbnailUrl ?? '',
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
      };

      catalogWorks.push(catalogWork);

      return catalogWork;
    },
    update: async ({
      where,
      data,
    }: {
      where: {
        id: string;
      };
      data: Record<string, unknown>;
    }) => {
      const index = catalogWorks.findIndex(
        (catalogWork) => catalogWork.id === where.id,
      );

      if (index === -1) {
        throw new Error('catalog work not found');
      }

      const updatedCatalogWork = {
        ...catalogWorks[index],
        ...data,
        updatedAt: data.updatedAt ?? new Date(),
      };

      catalogWorks[index] = updatedCatalogWork;

      return updatedCatalogWork;
    },
  };
  prismaMock.catalogTitle = {
    upsert: async ({
      create,
      update,
      where,
    }: {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
      where: {
        id: string;
      };
    }) => {
      const index = catalogTitles.findIndex((title) => title.id === where.id);
      const now = new Date();

      if (index >= 0) {
        const updatedTitle = {
          ...catalogTitles[index],
          ...update,
          updatedAt: update.updatedAt ?? now,
        };

        catalogTitles[index] = updatedTitle;

        return updatedTitle;
      }

      const title = {
        id: create.id ?? where.id,
        franchiseId: create.franchiseId ?? null,
        mediumType: create.mediumType ?? WorkType.other,
        subType: create.subType ?? null,
        canonicalTitle: create.canonicalTitle,
        displayTitle: create.displayTitle,
        originalTitle: create.originalTitle ?? null,
        aliases: create.aliases ?? [],
        releaseYear: create.releaseYear ?? null,
        startDate: create.startDate ?? null,
        endDate: create.endDate ?? null,
        country: create.country ?? null,
        status: create.status ?? 'unknown',
        summary: create.summary ?? '',
        thumbnailUrl: create.thumbnailUrl ?? '',
        verificationStatus: create.verificationStatus ?? 'draft',
        createdAt: create.createdAt ?? now,
        updatedAt: create.updatedAt ?? now,
        franchise: null,
        contributors: [],
        outgoingRelations: [],
        externalRefs: [],
      };

      catalogTitles.push(title);

      return title;
    },
    findFirst: async ({
      where,
      select,
    }: {
      where?: {
        displayTitle?: {
          equals: string;
          mode?: string;
        };
        mediumType?: WorkType;
      };
      select?: Record<string, boolean>;
    } = {}) => {
      const title =
        catalogTitles.find((catalogTitle) => {
          if (
            where?.mediumType &&
            catalogTitle.mediumType !== where.mediumType
          ) {
            return false;
          }

          if (where?.displayTitle?.equals) {
            const expected = where.displayTitle.equals.toLowerCase();
            const actual = String(catalogTitle.displayTitle).toLowerCase();

            if (actual !== expected) {
              return false;
            }
          }

          return true;
        }) ?? null;

      if (!title || !select) {
        return title;
      }

      return Object.fromEntries(
        Object.entries(select)
          .filter(([, enabled]) => enabled)
          .map(([key]) => [key, title[key]]),
      );
    },
    findMany: async ({
      where,
    }: {
      where?: {
        franchiseId?: string;
        mediumType?: WorkType;
        verificationStatus?: {
          not?: string;
        };
      };
    } = {}) =>
      catalogTitles.filter((catalogTitle) => {
        if (
          where?.franchiseId &&
          catalogTitle.franchiseId !== where.franchiseId
        ) {
          return false;
        }

        if (where?.mediumType && catalogTitle.mediumType !== where.mediumType) {
          return false;
        }

        if (
          where?.verificationStatus?.not &&
          catalogTitle.verificationStatus === where.verificationStatus.not
        ) {
          return false;
        }

        return true;
      }),
    findUnique: async ({
      where,
    }: {
      where: {
        id: string;
      };
    }) => getCatalogTitleById(where.id),
  };
  prismaMock.userWorkRecord = {
    findMany: async ({
      where,
      orderBy,
    }: {
      where?: {
        deletedAt?: null;
        updatedAt?: {
          gt: Date;
        };
        userId?: string;
      };
      orderBy?:
        | {
            id?: 'asc' | 'desc';
            updatedAt?: 'asc' | 'desc';
          }
        | Array<{
            id?: 'asc' | 'desc';
            updatedAt?: 'asc' | 'desc';
          }>;
    } = {}) =>
      [...userWorkRecords]
        .filter((record) => {
          if (where?.userId && record.userId !== where.userId) {
            return false;
          }

          if (where?.deletedAt === null && record.deletedAt !== null) {
            return false;
          }

          if (
            where?.updatedAt?.gt &&
            new Date(record.updatedAt as Date).getTime() <=
              where.updatedAt.gt.getTime()
          ) {
            return false;
          }

          return true;
        })
        .sort((left, right) => {
          const { idDirection, updatedAtDirection } =
            getSortDirections(orderBy);
          const updatedAtDelta =
            new Date(left.updatedAt as Date).getTime() -
            new Date(right.updatedAt as Date).getTime();

          if (updatedAtDelta !== 0) {
            return updatedAtDirection === 'asc'
              ? updatedAtDelta
              : -updatedAtDelta;
          }

          const idDelta = String(left.id).localeCompare(String(right.id));

          return idDirection === 'asc' ? idDelta : -idDelta;
        })
        .map((record) => joinRecord(record)),
    findUnique: async ({
      where,
    }: {
      where: {
        id: string;
      };
    }) => {
      const record =
        userWorkRecords.find((work) => work.id === where.id) ?? null;

      return record ? joinRecord(record) : null;
    },
    findFirst: async ({
      where,
    }: {
      where: {
        deletedAt?: null;
        id?: string;
        userId?: string;
      };
    }) => {
      const record =
        userWorkRecords.find((work) => {
          if (where.id && work.id !== where.id) {
            return false;
          }

          if (where.userId && work.userId !== where.userId) {
            return false;
          }

          if (where.deletedAt === null && work.deletedAt !== null) {
            return false;
          }

          return true;
        }) ?? null;

      return record ? joinRecord(record) : null;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const now = new Date();
      const record = {
        id: data.id ?? crypto.randomUUID(),
        userId: data.userId ?? null,
        catalogWorkId: data.catalogWorkId,
        catalogTitleId: data.catalogTitleId ?? null,
        status: data.status ?? WorkStatus.planned,
        rating: data.rating ?? null,
        shortReview: data.shortReview ?? '',
        review: data.review ?? '',
        personalTags: data.personalTags ?? [],
        favorite: data.favorite ?? false,
        progressCurrent: data.progressCurrent ?? null,
        progressTotal: data.progressTotal ?? null,
        progressUnit: data.progressUnit ?? null,
        lastConsumedLabel: data.lastConsumedLabel ?? null,
        startedAt: data.startedAt ?? null,
        completedAt: data.completedAt ?? null,
        droppedAt: data.droppedAt ?? null,
        lastConsumedAt: data.lastConsumedAt ?? null,
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
        deletedAt: data.deletedAt ?? null,
        syncStatus: data.syncStatus ?? WorkSyncStatus.synced,
        serverVersion: data.serverVersion ?? 1,
      };

      userWorkRecords.push(record);

      return joinRecord(record);
    },
    update: async ({
      where,
      data,
    }: {
      where: {
        id: string;
      };
      data: Record<string, unknown>;
    }) => {
      const index = userWorkRecords.findIndex(
        (record) => record.id === where.id,
      );

      if (index === -1) {
        throw new Error('user work record not found');
      }

      const current = userWorkRecords[index]!;
      const updatedRecord = {
        ...current,
        ...data,
        serverVersion: buildServerVersion(
          Number(current.serverVersion),
          data.serverVersion,
        ),
        updatedAt: data.updatedAt ?? new Date(),
      };

      userWorkRecords[index] = updatedRecord;

      return joinRecord(updatedRecord);
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: {
        deletedAt?: null;
        id?: string;
        userId?: string;
      };
      data: Record<string, unknown>;
    }) => {
      let count = 0;

      for (let index = 0; index < userWorkRecords.length; index += 1) {
        const current = userWorkRecords[index]!;

        if (where.id && current.id !== where.id) {
          continue;
        }

        if (where.userId && current.userId !== where.userId) {
          continue;
        }

        if (where.deletedAt === null && current.deletedAt !== null) {
          continue;
        }

        userWorkRecords[index] = {
          ...current,
          ...data,
          serverVersion: buildServerVersion(
            Number(current.serverVersion),
            data.serverVersion,
          ),
          updatedAt: data.updatedAt ?? new Date(),
        };
        count += 1;
      }

      return { count };
    },
  };
  prismaMock.userSyncAppliedMutation = {
    findUnique: async ({
      where,
    }: {
      where: {
        userId_clientMutationId: {
          clientMutationId: string;
          userId: string;
        };
      };
    }) => {
      const unique = where.userId_clientMutationId;

      return (
        userSyncAppliedMutations.find(
          (record) =>
            record.userId === unique.userId &&
            record.clientMutationId === unique.clientMutationId,
        ) ?? null
      );
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const record = {
        id: crypto.randomUUID(),
        appliedAt: new Date(),
        ...data,
      };

      userSyncAppliedMutations.push(record);

      return record;
    },
  };
  prismaMock.catalogExternalRef = {
    findUnique: async ({
      include,
      where,
    }: {
      include?: {
        catalogTitle?: boolean;
      };
      where: {
        provider_rawType_externalId: {
          externalId: string;
          provider: string;
          rawType: string;
        };
      };
    }) => {
      const ref =
        catalogExternalRefs.find(
          (externalRef) =>
            externalRef.externalId ===
              where.provider_rawType_externalId.externalId &&
            externalRef.provider ===
              where.provider_rawType_externalId.provider &&
            externalRef.rawType === where.provider_rawType_externalId.rawType,
        ) ?? null;

      if (!ref || !include?.catalogTitle) {
        return ref;
      }

      return {
        ...ref,
        catalogTitle: getCatalogTitleById(ref.catalogTitleId as string | null),
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
      const index = catalogExternalRefs.findIndex(
        (externalRef) =>
          externalRef.externalId ===
            where.provider_rawType_externalId.externalId &&
          externalRef.provider === where.provider_rawType_externalId.provider &&
          externalRef.rawType === where.provider_rawType_externalId.rawType,
      );
      const now = new Date();

      if (index >= 0) {
        const updatedRef = {
          ...catalogExternalRefs[index],
          ...update,
          updatedAt: now,
        };

        catalogExternalRefs[index] = updatedRef;

        return updatedRef;
      }

      const ref = {
        id: create.id ?? crypto.randomUUID(),
        catalogTitleId: create.catalogTitleId ?? null,
        catalogReleaseId: create.catalogReleaseId ?? null,
        franchiseId: create.franchiseId ?? null,
        contributorId: create.contributorId ?? null,
        provider: create.provider,
        externalId: create.externalId,
        url: create.url ?? '',
        rawType: create.rawType ?? '',
        language: create.language ?? null,
        country: create.country ?? null,
        confidence: create.confidence ?? null,
        lastFetchedAt: create.lastFetchedAt ?? null,
        createdAt: now,
        updatedAt: now,
      };

      catalogExternalRefs.push(ref);

      return ref;
    },
  };
  prismaMock.userReleaseRecord = {
    findMany: async ({
      where,
    }: {
      where?: {
        updatedAt?: {
          gt: Date;
        };
        userWorkRecord?: {
          userId?: string;
        };
      };
    } = {}) =>
      userReleaseRecords.filter((record) => {
        if (where?.userWorkRecord?.userId) {
          const parent = userWorkRecords.find(
            (workRecord) => workRecord.id === record.userWorkRecordId,
          );

          if (parent?.userId !== where.userWorkRecord.userId) {
            return false;
          }
        }

        if (
          where?.updatedAt?.gt &&
          new Date(record.updatedAt as Date).getTime() <=
            where.updatedAt.gt.getTime()
        ) {
          return false;
        }

        return true;
      }),
  };
  prismaMock.userTimelineEntry = {
    findUnique: async ({
      where,
    }: {
      where: {
        id: string;
      };
    }) => {
      const entry =
        userTimelineEntries.find((candidate) => candidate.id === where.id) ??
        null;

      return entry ? joinTimelineEntry(entry) : null;
    },
    findMany: async ({
      where,
    }: {
      where?: {
        updatedAt?: {
          gt: Date;
        };
        userId?: string;
      };
    } = {}) =>
      [...userTimelineEntries]
        .filter((entry) => {
          if (where?.userId && entry.userId !== where.userId) {
            return false;
          }

          if (
            where?.updatedAt?.gt &&
            new Date(entry.updatedAt as Date).getTime() <=
              where.updatedAt.gt.getTime()
          ) {
            return false;
          }

          return true;
        })
        .sort((left, right) => {
          const updatedAtDelta =
            new Date(left.updatedAt as Date).getTime() -
            new Date(right.updatedAt as Date).getTime();

          if (updatedAtDelta !== 0) {
            return updatedAtDelta;
          }

          return String(left.id).localeCompare(String(right.id));
        })
        .map((entry) => joinTimelineEntry(entry)),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const now = new Date();
      const entry = {
        id: data.id ?? crypto.randomUUID(),
        userId: data.userId,
        userWorkRecordId: data.userWorkRecordId,
        type: data.type ?? 'note',
        occurredAt: data.occurredAt ?? now,
        note: data.note ?? '',
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
        deletedAt: data.deletedAt ?? null,
        syncStatus: data.syncStatus ?? WorkSyncStatus.synced,
        serverVersion: data.serverVersion ?? 1,
      };

      userTimelineEntries.push(entry);

      return joinTimelineEntry(entry);
    },
    update: async ({
      data,
      where,
    }: {
      data: Record<string, unknown>;
      where: {
        id: string;
      };
    }) => {
      const index = userTimelineEntries.findIndex(
        (entry) => entry.id === where.id,
      );

      if (index === -1) {
        throw new Error('timeline entry not found');
      }

      const current = userTimelineEntries[index]!;
      const updatedEntry = {
        ...current,
        ...data,
        serverVersion: buildServerVersion(
          Number(current.serverVersion),
          data.serverVersion,
        ),
        updatedAt: data.updatedAt ?? new Date(),
      };

      userTimelineEntries[index] = updatedEntry;

      return joinTimelineEntry(updatedEntry);
    },
  };
  prismaMock.externalApiCredential = {
    findUnique: async ({
      where,
    }: {
      where: {
        userId_provider: {
          provider: string;
          userId: string;
        };
      };
    }) =>
      externalApiCredentials.find(
        (credential) =>
          credential.userId === where.userId_provider.userId &&
          credential.provider === where.userId_provider.provider,
      ) ?? null,
    upsert: async ({
      create,
      update,
      where,
    }: {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
      where: {
        userId_provider: {
          provider: string;
          userId: string;
        };
      };
    }) => {
      const index = externalApiCredentials.findIndex(
        (credential) =>
          credential.userId === where.userId_provider.userId &&
          credential.provider === where.userId_provider.provider,
      );
      const now = new Date();

      if (index >= 0) {
        const updatedCredential = {
          ...externalApiCredentials[index],
          ...update,
          updatedAt: now,
        };

        externalApiCredentials[index] = updatedCredential;

        return updatedCredential;
      }

      const credential = {
        id: create.id ?? crypto.randomUUID(),
        userId: create.userId,
        provider: create.provider,
        encryptedKey: create.encryptedKey,
        iv: create.iv,
        authTag: create.authTag,
        createdAt: now,
        updatedAt: now,
      };

      externalApiCredentials.push(credential);

      return credential;
    },
    deleteMany: async ({
      where,
    }: {
      where: {
        provider: string;
        userId: string;
      };
    }) => {
      const nextCredentials = externalApiCredentials.filter(
        (credential) =>
          credential.userId !== where.userId ||
          credential.provider !== where.provider,
      );
      const count = externalApiCredentials.length - nextCredentials.length;

      externalApiCredentials.splice(
        0,
        externalApiCredentials.length,
        ...nextCredentials,
      );

      return {
        count,
      };
    },
  };

  const emptyFindManyDelegate = {
    findMany: async () => [],
  };

  prismaMock.userSeries = emptyFindManyDelegate;
  prismaMock.userContributor = emptyFindManyDelegate;
  prismaMock.userWorkSeriesLink = emptyFindManyDelegate;
  prismaMock.userWorkContributor = emptyFindManyDelegate;
  prismaMock.userWorkRelation = emptyFindManyDelegate;
  prismaMock.userTierBoard = emptyFindManyDelegate;
  prismaMock.userTierLane = emptyFindManyDelegate;
  prismaMock.userTierBoardCard = emptyFindManyDelegate;
  prismaMock.userTierBoardAsset = emptyFindManyDelegate;

  prismaMock.securityEvent = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const event = {
        id: data.id ?? crypto.randomUUID(),
        ...data,
        createdAt: data.createdAt ?? new Date(),
      };

      securityEvents.push(event);

      return event;
    },
  };

  return prismaMock;
}

describe('Auth, works, and sync API (e2e)', () => {
  const REFRESH_TOKEN_COOKIE_NAME = 'work_archive_refresh_token';
  let app: INestApplication;
  let authService: AuthService;
  let baseUrl: string;
  let cookieJar: string | null;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.EXTERNAL_API_KEY_ENCRYPTION_SECRET =
      'test-external-api-key-encryption-secret';
    process.env.WEB_BASE_URL = 'http://localhost:18730';
    delete process.env.COOKIE_SECURE;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaServiceMock())
      .compile();

    app = moduleRef.createNestApplication();
    await configureApp(app, readApiRuntimeConfig());
    await app.listen(0);
    authService = app.get(AuthService);
    prisma = app.get(PrismaService);
    cookieJar = null;

    const address = app.getHttpServer().address() as AddressInfo;

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  async function requestJson(
    path: string,
    init?: RequestInit,
    accessToken?: string,
  ): Promise<{
    body: unknown;
    setCookie: string | null;
    status: number;
  }> {
    const headers = new Headers(init?.headers);

    headers.set('content-type', 'application/json');

    if (!headers.has('cookie') && cookieJar) {
      headers.set('cookie', cookieJar);
    }

    if (accessToken) {
      headers.set('authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
    const nextCookie = response.headers.get('set-cookie');

    if (nextCookie) {
      cookieJar = nextCookie.split(';')[0] ?? null;
    }

    const body = response.status === 204 ? null : await response.json();

    return {
      body,
      setCookie: nextCookie,
      status: response.status,
    };
  }

  async function createAuthenticatedUser(email: string, rememberMe = true) {
    const session = await createTestSession({
      authService,
      email,
      prisma,
      rememberMe,
    });

    cookieJar = session.cookie;

    return session;
  }

  function getFetchInputUrl(input: Parameters<typeof fetch>[0]) {
    if (typeof input === 'string') {
      return input;
    }

    if (input instanceof URL) {
      return input.toString();
    }

    return input.url;
  }

  function mockAladinResponse(body: unknown, status = 200) {
    const realFetch = globalThis.fetch.bind(globalThis);

    jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (getFetchInputUrl(input).includes('aladin.co.kr')) {
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status,
            headers: {
              'content-type': 'application/json',
            },
          }),
        );
      }

      return realFetch(input, init);
    });
  }

  function buildSyncPayload(
    workId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id: workId,
      type: WorkType.novel,
      title: 'Dune',
      author: 'Frank Herbert',
      genres: ['Science Fiction'],
      personalTags: [],
      description: '',
      thumbnailUrl: '',
      status: WorkStatus.completed,
      rating: 5,
      shortReview: '',
      review: '',
      favorite: false,
      createdAt: '2026-04-18T00:00:00.000Z',
      updatedAt: '2026-04-18T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'pending',
      serverVersion: 1,
      ...overrides,
    };
  }

  it('reports Google OAuth readiness and redirects unconfigured starts to login', async () => {
    const unconfiguredStatus = await requestJson('/api/auth/google/status');

    expect(unconfiguredStatus.status).toBe(200);
    expect(unconfiguredStatus.body).toEqual({
      configured: false,
    });

    const unconfiguredStart = await fetch(`${baseUrl}/api/auth/google/start`, {
      redirect: 'manual',
    });

    expect(unconfiguredStart.status).toBe(302);
    expect(unconfiguredStart.headers.get('location')).toBe(
      'http://localhost:18730/auth/login?google=unconfigured',
    );

    const unconfiguredStartWithDevOrigin = await fetch(
      `${baseUrl}/api/auth/google/start?return_origin=${encodeURIComponent('http://localhost:18730')}`,
      {
        redirect: 'manual',
      },
    );

    expect(unconfiguredStartWithDevOrigin.status).toBe(302);
    expect(unconfiguredStartWithDevOrigin.headers.get('location')).toBe(
      'http://localhost:18730/auth/login?google=unconfigured',
    );

    const unconfiguredStartWithUntrustedOrigin = await fetch(
      `${baseUrl}/api/auth/google/start?return_origin=${encodeURIComponent('https://evil.example')}`,
      {
        redirect: 'manual',
      },
    );

    expect(unconfiguredStartWithUntrustedOrigin.status).toBe(302);
    expect(unconfiguredStartWithUntrustedOrigin.headers.get('location')).toBe(
      'http://localhost:18730/auth/login?google=unconfigured',
    );

    process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-client-secret';

    const configuredStatus = await requestJson('/api/auth/google/status');

    expect(configuredStatus.status).toBe(200);
    expect(configuredStatus.body).toEqual({
      configured: true,
    });

    const configuredStart = await fetch(
      `${baseUrl}/api/auth/google/start?return_origin=${encodeURIComponent('http://localhost:18730')}`,
      {
        redirect: 'manual',
      },
    );
    const googleLocation = configuredStart.headers.get('location');
    const setCookie = configuredStart.headers.get('set-cookie') ?? '';
    const googleAuthUrl =
      typeof googleLocation === 'string' ? new URL(googleLocation) : null;
    const state = googleAuthUrl?.searchParams.get('state') ?? '';
    const nonce = googleAuthUrl?.searchParams.get('nonce') ?? '';

    expect(configuredStart.status).toBe(302);
    expect(state).toBeTruthy();
    expect(nonce).toBeTruthy();
    expect(setCookie).toContain('wa_google_oauth_flow=');
    expect(setCookie).toContain('Path=/api/auth/google');
    expect(setCookie).not.toMatch(/;\s*Secure/i);
    expect(setCookie).not.toContain('wa_google_oauth_state=');
    expect(setCookie).not.toContain('wa_google_oauth_nonce=');
    expect(setCookie).not.toContain(state);
    expect(setCookie).not.toContain(nonce);

    process.env.COOKIE_SECURE = 'true';

    const secureConfiguredStart = await fetch(
      `${baseUrl}/api/auth/google/start?return_origin=${encodeURIComponent('http://localhost:18730')}`,
      {
        redirect: 'manual',
      },
    );
    const secureSetCookie =
      secureConfiguredStart.headers.get('set-cookie') ?? '';

    expect(secureConfiguredStart.status).toBe(302);
    expect(secureSetCookie).toContain('wa_google_oauth_flow=');
    expect(secureSetCookie).toMatch(/;\s*Secure/i);
  });

  it('keeps legacy email/password login and registration disabled with 410 Gone', async () => {
    for (const path of ['/api/auth/register', '/api/auth/login']) {
      const response = await requestJson(path, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(410);
      expect(response.body).toEqual(
        expect.objectContaining({
          message:
            'Email/password authentication is disabled. Continue with Google or use Work Archive as a guest.',
        }),
      );
    }
  });

  it('removes the legacy password-reset endpoints entirely', async () => {
    for (const path of [
      '/api/auth/password-reset/request',
      '/api/auth/password-reset/confirm',
    ]) {
      const response = await requestJson(path, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(404);
    }
  });

  it('keeps health public and supports seeded sessions, refresh, stale refresh rejection, and /auth/me', async () => {
    const healthResponse = await fetch(`${baseUrl}/health`);

    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toEqual({
      service: 'work-archive-api',
      status: 'ok',
    });
    const livezResponse = await fetch(`${baseUrl}/livez`);

    expect(livezResponse.status).toBe(200);

    const prefixedHealthResponse = await fetch(`${baseUrl}/api/health`);

    expect(prefixedHealthResponse.status).toBe(404);

    const session = await createAuthenticatedUser('frieren@example.com');
    const staleRefreshCookie = cookieJar;
    const meResponse = await requestJson(
      '/api/auth/me',
      undefined,
      session.accessToken,
    );

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toEqual(
      expect.objectContaining({
        email: 'frieren@example.com',
      }),
    );

    const refreshResponse = await requestJson('/api/auth/refresh', {
      method: 'POST',
    });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.setCookie).toContain(
      `${REFRESH_TOKEN_COOKIE_NAME}=`,
    );
    expect(refreshResponse.body).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        user: expect.objectContaining({
          email: 'frieren@example.com',
        }),
      }),
    );

    const staleRefreshResponse = await requestJson('/api/auth/refresh', {
      method: 'POST',
      ...(staleRefreshCookie
        ? {
            headers: {
              cookie: staleRefreshCookie,
            },
          }
        : {}),
    });

    expect(staleRefreshResponse.status).toBe(401);

    const missingRefreshResponse = await requestJson('/api/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: '',
      },
    });

    expect(missingRefreshResponse.status).toBe(204);
  });

  it('logs out cleanly and rejects refresh attempts after logout', async () => {
    const session = await createAuthenticatedUser('logout@example.com');

    const logoutResponse = await requestJson(
      '/api/auth/logout',
      {
        method: 'POST',
      },
      session.accessToken,
    );

    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.setCookie).toContain(
      `${REFRESH_TOKEN_COOKIE_NAME}=;`,
    );

    const refreshAfterLogoutResponse = await requestJson('/api/auth/refresh', {
      method: 'POST',
    });

    expect(refreshAfterLogoutResponse.status).toBe(204);
  });

  it('lists refresh sessions and supports device-level revoke and logout-all', async () => {
    const firstSession = await createAuthenticatedUser(
      'sessions@example.com',
      true,
    );
    const secondSession = await createAuthenticatedUser(
      'sessions@example.com',
      false,
    );

    const sessionsResponse = await requestJson(
      '/api/auth/sessions',
      undefined,
      secondSession.accessToken,
    );

    expect(sessionsResponse.status).toBe(200);
    expect(sessionsResponse.body).toEqual({
      sessions: expect.arrayContaining([
        expect.objectContaining({
          current: false,
          rememberMe: true,
        }),
        expect.objectContaining({
          current: true,
          rememberMe: false,
        }),
      ]),
    });

    const listedSessions = (
      sessionsResponse.body as {
        sessions: Array<{
          current: boolean;
          id: string;
        }>;
      }
    ).sessions;
    const otherSession = listedSessions.find((session) => !session.current);

    expect(otherSession).toBeDefined();

    const revokeOtherResponse = await requestJson(
      `/api/auth/sessions/${otherSession!.id}`,
      {
        method: 'DELETE',
      },
      secondSession.accessToken,
    );

    expect(revokeOtherResponse.status).toBe(204);

    const firstMeAfterRevoke = await requestJson(
      '/api/auth/me',
      undefined,
      firstSession.accessToken,
    );
    const secondMeAfterRevoke = await requestJson(
      '/api/auth/me',
      undefined,
      secondSession.accessToken,
    );

    expect(firstMeAfterRevoke.status).toBe(401);
    expect(secondMeAfterRevoke.status).toBe(200);

    const revokeAllResponse = await requestJson(
      '/api/auth/sessions/revoke-all',
      {
        method: 'POST',
      },
      secondSession.accessToken,
    );

    expect(revokeAllResponse.status).toBe(204);
    expect(revokeAllResponse.setCookie).toContain(
      `${REFRESH_TOKEN_COOKIE_NAME}=;`,
    );

    const secondMeAfterRevokeAll = await requestJson(
      '/api/auth/me',
      undefined,
      secondSession.accessToken,
    );

    expect(secondMeAfterRevokeAll.status).toBe(401);
  });

  it('revokes all active sessions when a rotated refresh token is reused', async () => {
    const firstSession = await createAuthenticatedUser('reuse@example.com');
    const secondSession = await createAuthenticatedUser('reuse@example.com');
    const staleRefreshCookie = cookieJar;

    const refreshResponse = await requestJson('/api/auth/refresh', {
      method: 'POST',
    });
    const rotatedSession = refreshResponse.body as {
      accessToken: string;
    };

    expect(refreshResponse.status).toBe(200);

    const staleRefreshResponse = await requestJson('/api/auth/refresh', {
      method: 'POST',
      ...(staleRefreshCookie
        ? {
            headers: {
              cookie: staleRefreshCookie,
            },
          }
        : {}),
    });

    expect(staleRefreshResponse.status).toBe(401);

    await expect(
      requestJson('/api/auth/me', undefined, firstSession.accessToken),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );
    await expect(
      requestJson('/api/auth/me', undefined, secondSession.accessToken),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );
    await expect(
      requestJson('/api/auth/me', undefined, rotatedSession.accessToken),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );
  });

  it('protects auth, works, and sync routes when authentication is missing', async () => {
    await expect(requestJson('/api/auth/me')).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );

    await expect(requestJson('/api/works')).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );

    await expect(
      requestJson('/api/works', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Dune',
        }),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );

    await expect(
      requestJson('/api/sync/pull', {
        method: 'POST',
        body: JSON.stringify({
          since: null,
        }),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );

    await expect(
      requestJson('/api/imports/providers/aladin/status'),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );

    await expect(
      requestJson('/api/imports/providers/aladin/key', {
        method: 'PUT',
        body: JSON.stringify({
          ttbKey: 'test-ttb-key',
        }),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );

    await expect(
      requestJson('/api/imports/providers/aladin/key', {
        method: 'DELETE',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 401,
      }),
    );
  });

  it('supports authenticated Aladin key settings and import search without creating works', async () => {
    const session = await createAuthenticatedUser('imports@example.com');
    const statusBeforeSave = await requestJson(
      '/api/imports/providers/aladin/status',
      undefined,
      session.accessToken,
    );

    expect(statusBeforeSave.status).toBe(200);
    expect(statusBeforeSave.body).toEqual({
      provider: 'aladin',
      configured: false,
    });

    const blankKeyResponse = await requestJson(
      '/api/imports/providers/aladin/key',
      {
        method: 'PUT',
        body: JSON.stringify({
          ttbKey: '   ',
        }),
      },
      session.accessToken,
    );

    expect(blankKeyResponse.status).toBe(400);

    const saveKeyResponse = await requestJson(
      '/api/imports/providers/aladin/key',
      {
        method: 'PUT',
        body: JSON.stringify({
          ttbKey: '  test-ttb-key  ',
        }),
      },
      session.accessToken,
    );

    expect(saveKeyResponse.status).toBe(200);
    expect(saveKeyResponse.body).toEqual({
      provider: 'aladin',
      configured: true,
    });

    const providerReadinessResponse = await requestJson(
      '/api/imports/providers',
      undefined,
      session.accessToken,
    );

    expect(providerReadinessResponse.status).toBe(200);
    expect(providerReadinessResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'aladin',
          credentialMode: 'user',
          configured: true,
        }),
        expect.objectContaining({
          provider: 'manual',
          credentialMode: 'none',
          configured: true,
        }),
      ]),
    );

    mockAladinResponse({
      item: [
        {
          itemId: 123,
          title: '듄',
          author: '프랭크 허버트',
          description: '사막 행성을 둘러싼 이야기',
          cover: 'https://image.aladin.co.kr/cover.jpg',
          categoryName: '국내도서>소설/시/희곡>영미소설',
          publisher: '황금가지',
          pubDate: '2026-04-18',
          link: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123',
        },
      ],
    });

    const searchResponse = await requestJson(
      '/api/imports/search?provider=aladin&query=%EB%93%84&type=novel&limit=10',
      undefined,
      session.accessToken,
    );

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body).toEqual({
      provider: 'aladin',
      providers: ['aladin'],
      query: '듄',
      candidates: [
        expect.objectContaining({
          id: 'aladin:123',
          externalId: '123',
          sourceId: 'aladin',
          sourceLabel: 'Aladin Book',
          title: '듄',
          author: '프랭크 허버트',
          type: 'novel',
          thumbnailUrl: 'https://image.aladin.co.kr/cover.jpg',
          note: '도서 DB 제공: 알라딘 인터넷서점(www.aladin.co.kr)',
          sourceUrl: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123',
        }),
      ],
      diagnostics: {
        providers: [
          expect.objectContaining({
            provider: 'aladin',
            credentialMode: 'user',
            configured: true,
            status: 'searched',
            resultCount: 1,
          }),
        ],
      },
    });

    const deleteKeyResponse = await requestJson(
      '/api/imports/providers/aladin/key',
      {
        method: 'DELETE',
      },
      session.accessToken,
    );

    expect(deleteKeyResponse.status).toBe(204);

    const compatibleSaveKeyResponse = await requestJson(
      '/api/imports/providers/aladin/key',
      {
        method: 'PUT',
        body: JSON.stringify({
          values: {
            ttbKey: '  test-ttb-key  ',
          },
        }),
      },
      session.accessToken,
    );

    expect(compatibleSaveKeyResponse.status).toBe(200);
    expect(compatibleSaveKeyResponse.body).toEqual({
      provider: 'aladin',
      configured: true,
    });

    await expect(
      requestJson(
        '/api/imports/providers/aladin/key',
        {
          method: 'DELETE',
        },
        session.accessToken,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 204,
      }),
    );

    const searchAfterDeleteResponse = await requestJson(
      '/api/imports/search?provider=aladin&query=Dune&type=novel',
      undefined,
      session.accessToken,
    );

    expect(searchAfterDeleteResponse.status).toBe(403);
  });

  it('allows guest import search only for no-user-key providers', async () => {
    const providersResponse = await requestJson('/api/imports/providers');

    expect(providersResponse.status).toBe(200);
    expect(providersResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'manual',
          credentialMode: 'none',
          configured: true,
        }),
        expect.objectContaining({
          provider: 'aladin',
          credentialMode: 'user',
          configured: false,
        }),
        expect.objectContaining({
          provider: 'tmdb',
          credentialMode: 'user',
          configured: false,
        }),
      ]),
    );

    const manualSearchResponse = await requestJson(
      '/api/imports/search?provider=manual&query=Dune&type=novel&limit=5',
    );

    expect(manualSearchResponse.status).toBe(200);
    expect(manualSearchResponse.body).toEqual(
      expect.objectContaining({
        provider: 'manual',
        providers: ['manual'],
        query: 'Dune',
        candidates: [
          expect.objectContaining({
            sourceId: 'manual',
            title: 'Dune',
            type: 'novel',
            catalogMatch: null,
            existingRecord: null,
          }),
        ],
      }),
    );

    const aladinGuestResponse = await requestJson(
      '/api/imports/search?provider=aladin&query=Dune&type=novel',
    );

    expect(aladinGuestResponse.status).toBe(401);

    const tmdbGuestResponse = await requestJson(
      '/api/imports/search?provider=tmdb&query=Dune&type=movie',
    );

    expect(tmdbGuestResponse.status).toBe(401);
  });

  it('rejects malformed optional import authorization headers', async () => {
    const providersResponse = await requestJson('/api/imports/providers', {
      headers: {
        authorization: 'Basic invalid-token',
      },
    });

    expect(providersResponse.status).toBe(401);

    const searchResponse = await requestJson(
      '/api/imports/search?provider=manual&query=Dune&type=novel',
      {
        headers: {
          authorization: 'Bearer',
        },
      },
    );

    expect(searchResponse.status).toBe(401);
  });

  it('supports works CRUD with user scoping, soft delete, and ownership protection', async () => {
    const firstUser = await createAuthenticatedUser('frieren@example.com');
    const secondUser = await createAuthenticatedUser('fern@example.com');

    const createResponse = await requestJson(
      '/api/works',
      {
        method: 'POST',
        body: JSON.stringify({
          type: WorkType.anime,
          title: "  Frieren: Beyond Journey's End  ",
          author: ' Kanehito Yamada ',
          genres: [' Fantasy ', 'Drama', 'Fantasy'],
          status: WorkStatus.completed,
          rating: 4.5,
          shortReview: ' Quiet and precise. ',
          favorite: true,
        }),
      },
      firstUser.accessToken,
    );

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: WorkType.anime,
        title: "Frieren: Beyond Journey's End",
        author: 'Kanehito Yamada',
        genres: [],
        personalTags: ['Fantasy', 'Drama'],
        syncStatus: 'synced',
        serverVersion: 1,
      }),
    );

    const workId = (createResponse.body as { id: string }).id;
    const ownerDetail = await requestJson(
      `/api/works/${workId}`,
      undefined,
      firstUser.accessToken,
    );

    expect(ownerDetail.status).toBe(200);
    expect(ownerDetail.body).toEqual(
      expect.objectContaining({
        id: workId,
        title: "Frieren: Beyond Journey's End",
      }),
    );

    const updateResponse = await requestJson(
      `/api/works/${workId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Frieren',
          favorite: false,
        }),
      },
      firstUser.accessToken,
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toEqual(
      expect.objectContaining({
        id: workId,
        title: 'Frieren',
        favorite: false,
        serverVersion: 2,
      }),
    );

    const firstUserList = await requestJson(
      '/api/works',
      undefined,
      firstUser.accessToken,
    );
    const secondUserList = await requestJson(
      '/api/works',
      undefined,
      secondUser.accessToken,
    );

    expect(firstUserList.status).toBe(200);
    expect(firstUserList.body).toEqual([
      expect.objectContaining({
        id: workId,
      }),
    ]);
    expect(secondUserList.status).toBe(200);
    expect(secondUserList.body).toEqual([]);

    const secondUserDetail = await requestJson(
      `/api/works/${workId}`,
      undefined,
      secondUser.accessToken,
    );
    const secondUserUpdate = await requestJson(
      `/api/works/${workId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Fern edition',
        }),
      },
      secondUser.accessToken,
    );
    const secondUserDelete = await requestJson(
      `/api/works/${workId}`,
      {
        method: 'DELETE',
      },
      secondUser.accessToken,
    );

    expect(secondUserDetail.status).toBe(404);
    expect(secondUserUpdate.status).toBe(404);
    expect(secondUserDelete.status).toBe(404);

    const deleteResponse = await requestJson(
      `/api/works/${workId}`,
      {
        method: 'DELETE',
      },
      firstUser.accessToken,
    );

    expect(deleteResponse.status).toBe(204);

    const deletedDetail = await requestJson(
      `/api/works/${workId}`,
      undefined,
      firstUser.accessToken,
    );
    const listAfterDelete = await requestJson(
      '/api/works',
      undefined,
      firstUser.accessToken,
    );

    expect(deletedDetail.status).toBe(404);
    expect(listAfterDelete.status).toBe(200);
    expect(listAfterDelete.body).toEqual([]);
  });

  it('rejects unsupported sync schema versions before reaching sync services', async () => {
    const user = await createAuthenticatedUser('sync-schema@example.com');

    const pullResponse = await requestJson(
      '/api/sync/pull',
      {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: 1,
          since: null,
        }),
      },
      user.accessToken,
    );

    expect(pullResponse.status).toBe(400);
    expect((pullResponse.body as { message: string[] }).message).toEqual(
      expect.arrayContaining([expect.stringContaining('schemaVersion')]),
    );
  });

  it('supports authenticated push and pull sync with create, update, delete, duplicate no-op, and conflict handling', async () => {
    const firstUser = await createAuthenticatedUser('sync-owner@example.com');
    const secondUser = await createAuthenticatedUser('sync-other@example.com');
    const workId = '3f831224-abf9-44c3-b3f9-9ff4da2f7de8';

    const pushCreateResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          changes: [
            {
              queueId: '6a8f8eb6-8317-4e8a-b8e7-530c5cc1db4d',
              entityType: 'work',
              entityId: workId,
              operation: 'create',
              createdAt: '2026-04-18T00:00:00.000Z',
              payload: buildSyncPayload(workId, {
                syncStatus: 'local-only',
                serverVersion: 0,
              }),
            },
          ],
        }),
      },
      firstUser.accessToken,
    );

    expect(pushCreateResponse.status).toBe(200);
    expect(pushCreateResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'applied',
            entityId: workId,
            work: expect.objectContaining({
              title: 'Dune',
              syncStatus: 'synced',
              serverVersion: 1,
            }),
          }),
        ],
      }),
    );

    const duplicateCreateResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          changes: [
            {
              queueId: '8bde1974-11bb-4b66-b2f7-273a4e0a3575',
              entityType: 'work',
              entityId: workId,
              operation: 'create',
              createdAt: '2026-04-18T00:01:00.000Z',
              payload: buildSyncPayload(workId, {
                syncStatus: 'local-only',
                serverVersion: 0,
              }),
            },
          ],
        }),
      },
      firstUser.accessToken,
    );

    expect(duplicateCreateResponse.status).toBe(200);
    expect(duplicateCreateResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'applied',
            message: 'Remote record already matches the queued change.',
            work: expect.objectContaining({
              serverVersion: 1,
            }),
          }),
        ],
      }),
    );

    const pushUpdateResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          changes: [
            {
              queueId: 'ea483856-fafc-4aa9-ac6f-925f9c34d5ea',
              entityType: 'work',
              entityId: workId,
              operation: 'update',
              createdAt: '2026-04-18T00:02:00.000Z',
              payload: buildSyncPayload(workId, {
                title: 'Dune Messiah',
                updatedAt: '2026-04-18T00:02:00.000Z',
                serverVersion: 1,
              }),
            },
          ],
        }),
      },
      firstUser.accessToken,
    );

    expect(pushUpdateResponse.status).toBe(200);
    expect(pushUpdateResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'applied',
            work: expect.objectContaining({
              title: 'Dune Messiah',
              serverVersion: 2,
            }),
          }),
        ],
      }),
    );

    const secondUserPull = await requestJson(
      '/api/sync/pull',
      {
        method: 'POST',
        body: JSON.stringify({
          since: '2026-04-17T00:00:00.000Z',
        }),
      },
      secondUser.accessToken,
    );

    expect(secondUserPull.status).toBe(200);
    expect(secondUserPull.body).toEqual(
      expect.objectContaining({
        changes: [],
      }),
    );

    const staleVersionUpdateResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          changes: [
            {
              queueId: 'd125b784-6d75-429f-bfa1-04f0f491de14',
              entityType: 'work',
              entityId: workId,
              operation: 'update',
              createdAt: '2026-04-18T00:03:00.000Z',
              payload: buildSyncPayload(workId, {
                title: 'Children of Dune',
                updatedAt: '2026-04-18T00:01:30.000Z',
                serverVersion: 1,
              }),
            },
          ],
        }),
      },
      firstUser.accessToken,
    );

    expect(staleVersionUpdateResponse.status).toBe(200);
    expect(staleVersionUpdateResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'conflict',
            code: 'conflict_remote_newer',
            work: expect.objectContaining({
              title: 'Dune Messiah',
              serverVersion: 2,
            }),
          }),
        ],
      }),
    );

    const pullResponse = await requestJson(
      '/api/sync/pull',
      {
        method: 'POST',
        body: JSON.stringify({
          since: '2026-04-17T00:00:00.000Z',
        }),
      },
      firstUser.accessToken,
    );

    expect(pullResponse.status).toBe(200);
    expect(pullResponse.body).toEqual(
      expect.objectContaining({
        nextSince: expect.any(String),
        changes: expect.arrayContaining([
          expect.objectContaining({
            entityId: workId,
            operation: 'upsert',
            work: expect.objectContaining({
              title: 'Dune Messiah',
              serverVersion: 2,
            }),
          }),
        ]),
      }),
    );

    const firstPullNextSince = (
      pullResponse.body as {
        nextSince: string;
      }
    ).nextSince;

    const pushDeleteResponse = await requestJson(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          changes: [
            {
              queueId: '5188f5b1-1c80-49fd-ba6d-6848b8f0f6a3',
              entityType: 'work',
              entityId: workId,
              operation: 'delete',
              createdAt: '2026-04-18T00:04:00.000Z',
              payload: buildSyncPayload(workId, {
                title: 'Dune Messiah',
                updatedAt: '2026-04-18T00:04:00.000Z',
                deletedAt: '2026-04-18T00:04:00.000Z',
                serverVersion: 2,
              }),
            },
          ],
        }),
      },
      firstUser.accessToken,
    );

    expect(pushDeleteResponse.status).toBe(200);
    expect(pushDeleteResponse.body).toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            status: 'applied',
            work: expect.objectContaining({
              deletedAt: '2026-04-18T00:04:00.000Z',
              serverVersion: 3,
            }),
          }),
        ],
      }),
    );

    const pullDeletedResponse = await requestJson(
      '/api/sync/pull',
      {
        method: 'POST',
        body: JSON.stringify({
          since: firstPullNextSince,
        }),
      },
      firstUser.accessToken,
    );

    expect(pullDeletedResponse.status).toBe(200);
    expect(pullDeletedResponse.body).toEqual(
      expect.objectContaining({
        changes: [
          expect.objectContaining({
            entityId: workId,
            operation: 'delete',
            work: expect.objectContaining({
              deletedAt: '2026-04-18T00:04:00.000Z',
              serverVersion: 3,
            }),
          }),
        ],
      }),
    );
  });

  it('validates works payloads, including blank titles', async () => {
    const session = await createAuthenticatedUser('validation@example.com');
    const blankTitleCreateResponse = await requestJson(
      '/api/works',
      {
        method: 'POST',
        body: JSON.stringify({
          title: '   ',
        }),
      },
      session.accessToken,
    );

    expect(blankTitleCreateResponse.status).toBe(400);
    expect(
      (blankTitleCreateResponse.body as { message: string[] }).message,
    ).toEqual(expect.arrayContaining([expect.stringContaining('title')]));

    const minimalCreateResponse = await requestJson(
      '/api/works',
      {
        method: 'POST',
        body: JSON.stringify({
          title: '  Only Required Title  ',
        }),
      },
      session.accessToken,
    );

    expect(minimalCreateResponse.status).toBe(201);
    expect(minimalCreateResponse.body).toEqual(
      expect.objectContaining({
        title: 'Only Required Title',
        type: WorkType.novel,
        author: '',
        genres: [],
        status: WorkStatus.planned,
        rating: null,
        favorite: false,
        syncStatus: 'synced',
      }),
    );

    const workId = (minimalCreateResponse.body as { id: string }).id;
    const blankTitleUpdateResponse = await requestJson(
      `/api/works/${workId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: '   ',
        }),
      },
      session.accessToken,
    );

    expect(blankTitleUpdateResponse.status).toBe(400);

    const invalidUpdateResponse = await requestJson(
      `/api/works/${workId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          rating: '4',
          genres: 'Drama',
        }),
      },
      session.accessToken,
    );

    expect(invalidUpdateResponse.status).toBe(400);
    expect(
      (invalidUpdateResponse.body as { message: string[] }).message,
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('rating'),
        expect.stringContaining('genres'),
      ]),
    );
  });
});
