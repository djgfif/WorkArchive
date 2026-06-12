import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CatalogSubmissionStatus,
  type Prisma,
  type UserRole,
} from '@prisma/client';

export interface CatalogSubmissionInput {
  action: string;
  entityId?: string | null;
  entityType: string;
  note?: string;
  payload: Record<string, unknown>;
}

export function assertCatalogModerationAccess(role: UserRole) {
  if (role !== 'moderator' && role !== 'admin') {
    throw new ForbiddenException(
      'Catalog moderation requires moderator access.',
    );
  }
}

export function assertPendingCatalogSubmission(
  status: CatalogSubmissionStatus,
  action = 'reviewed',
) {
  if (status !== CatalogSubmissionStatus.pending) {
    throw new BadRequestException(
      `Only pending submissions can be ${action}.`,
    );
  }
}

export function buildCatalogSubmissionCreateData(
  submitterId: string,
  input: CatalogSubmissionInput,
): Prisma.CatalogSubmissionUncheckedCreateInput {
  return {
    action: input.action,
    entityId: input.entityId ?? null,
    entityType: input.entityType,
    note: input.note?.trim() ?? '',
    payload: input.payload as Prisma.InputJsonObject,
    submitterId,
  };
}

export function buildCatalogSubmissionListArgs(
  status?: CatalogSubmissionStatus,
): Prisma.CatalogSubmissionFindManyArgs {
  return {
    ...(status
      ? {
          where: {
            status,
          },
        }
      : {}),
    orderBy: {
      createdAt: 'asc',
    },
    take: 100,
  };
}

export function buildUserCatalogSubmissionListArgs(
  submitterId: string,
  status?: CatalogSubmissionStatus,
): Prisma.CatalogSubmissionFindManyArgs {
  return {
    where: {
      submitterId,
      ...(status ? { status } : {}),
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: 100,
  };
}
