import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CatalogSubmissionStatus } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import {
  assertCatalogModerationAccess,
  assertPendingCatalogSubmission,
  buildCatalogSubmissionCreateData,
  buildCatalogSubmissionListArgs,
  buildUserCatalogSubmissionListArgs,
} from '../src/modules/catalog/catalog-submissions';

describe('catalog submission helpers', () => {
  it('allows only moderator roles to access catalog moderation flows', () => {
    expect(() => assertCatalogModerationAccess('moderator')).not.toThrow();
    expect(() => assertCatalogModerationAccess('admin')).not.toThrow();
    expect(() => assertCatalogModerationAccess('user')).toThrow(
      new ForbiddenException('Catalog moderation requires moderator access.'),
    );
  });

  it('requires pending submissions before review decisions', () => {
    expect(() =>
      assertPendingCatalogSubmission(CatalogSubmissionStatus.pending),
    ).not.toThrow();
    expect(() =>
      assertPendingCatalogSubmission(CatalogSubmissionStatus.approved, 'approved'),
    ).toThrow(
      new BadRequestException('Only pending submissions can be approved.'),
    );
    expect(() =>
      assertPendingCatalogSubmission(CatalogSubmissionStatus.rejected, 'rejected'),
    ).toThrow(
      new BadRequestException('Only pending submissions can be rejected.'),
    );
  });

  it('builds normalized submission create data', () => {
    expect(
      buildCatalogSubmissionCreateData('user-1', {
        action: 'title.update',
        entityType: 'catalogTitle',
        note: '  please review  ',
        payload: {
          displayTitle: 'Dune',
        },
      }),
    ).toEqual({
      action: 'title.update',
      entityId: null,
      entityType: 'catalogTitle',
      note: 'please review',
      payload: {
        displayTitle: 'Dune',
      },
      submitterId: 'user-1',
    });
  });

  it('builds bounded list args for moderation and self-service views', () => {
    expect(buildCatalogSubmissionListArgs()).toEqual({
      orderBy: {
        createdAt: 'asc',
      },
      take: 100,
    });
    expect(
      buildCatalogSubmissionListArgs(CatalogSubmissionStatus.pending),
    ).toEqual({
      orderBy: {
        createdAt: 'asc',
      },
      take: 100,
      where: {
        status: CatalogSubmissionStatus.pending,
      },
    });
    expect(
      buildUserCatalogSubmissionListArgs(
        'user-1',
        CatalogSubmissionStatus.rejected,
      ),
    ).toEqual({
      orderBy: {
        createdAt: 'asc',
      },
      take: 100,
      where: {
        status: CatalogSubmissionStatus.rejected,
        submitterId: 'user-1',
      },
    });
  });
});
