import { WorkStatus, WorkType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { AuthenticatedUser } from '../src/modules/auth/auth.types';
import { UserRecordsV2Controller } from '../src/modules/user-records/user-records-v2.controller';
import type { UserRecordsService } from '../src/modules/user-records/user-records.service';

const user: AuthenticatedUser = {
  email: 'user@example.com',
  role: 'user',
  sessionId: 'session-1',
  userId: 'user-1',
};

describe('UserRecordsV2Controller', () => {
  let controller: UserRecordsV2Controller;
  let service: jest.Mocked<
    Pick<
      UserRecordsService,
      | 'createViewForUser'
      | 'createViewFromImportForUser'
      | 'getV2ViewOrThrow'
      | 'listV2Views'
      | 'updateViewForUser'
    >
  >;

  beforeEach(() => {
    service = {
      createViewForUser: jest.fn(),
      createViewFromImportForUser: jest.fn(),
      getV2ViewOrThrow: jest.fn(),
      listV2Views: jest.fn(),
      updateViewForUser: jest.fn(),
    };
    service.createViewForUser.mockResolvedValue({
      record: { id: 'record-1' },
    } as never);
    service.createViewFromImportForUser.mockResolvedValue({
      record: { id: 'record-1' },
    } as never);
    service.getV2ViewOrThrow.mockResolvedValue({
      identity: {
        kind: 'manual',
        title: 'Example',
        mediumType: WorkType.novel,
      },
      record: { id: 'record-1' },
    } as never);
    controller = new UserRecordsV2Controller(
      service as unknown as UserRecordsService,
    );
  });

  it('maps catalog identity without legacy precedence fields', async () => {
    await controller.create(user, {
      identity: {
        kind: 'catalog',
        catalogTitleId: 'f4b5b53c-ad7e-4f37-82f8-4f76e9862281',
      },
      record: {
        favorite: true,
        status: WorkStatus.in_progress,
      },
    });

    expect(service.createViewForUser).toHaveBeenCalledWith('user-1', {
      catalogTitleId: 'f4b5b53c-ad7e-4f37-82f8-4f76e9862281',
      favorite: true,
      status: WorkStatus.in_progress,
    });
    expect(service.createViewFromImportForUser).not.toHaveBeenCalled();
  });

  it('resolves external identity through catalog ingestion and dedupes refs', async () => {
    await controller.create(user, {
      identity: {
        kind: 'external',
        provider: 'open-library',
        externalId: 'OL1M',
        externalRefs: [
          { provider: 'open-library', externalId: 'OL1M' },
          { provider: 'wikidata', externalId: 'Q1' },
        ],
        title: 'Dune',
        mediumType: WorkType.novel,
        author: 'Frank Herbert',
      },
      record: {
        rating: 4.5,
      },
    });

    expect(service.createViewFromImportForUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        author: 'Frank Herbert',
        catalogTitle: 'Dune',
        contributors: [{ name: 'Frank Herbert' }],
        externalRefs: [
          { provider: 'open-library', externalId: 'OL1M' },
          { provider: 'wikidata', externalId: 'Q1' },
        ],
        mediumType: WorkType.novel,
        rating: 4.5,
        title: 'Dune',
        type: WorkType.novel,
      }),
    );
  });

  it('maps manual identity to a draft record without catalog fields', async () => {
    await controller.create(user, {
      identity: {
        kind: 'manual',
        title: 'My private note',
        mediumType: WorkType.other,
      },
    });

    expect(service.createViewForUser).toHaveBeenCalledWith('user-1', {
      title: 'My private note',
      type: WorkType.other,
    });
    expect(service.createViewFromImportForUser).not.toHaveBeenCalled();
  });

  it('rejects fields from another identity branch', async () => {
    await expect(
      controller.create(user, {
        identity: {
          kind: 'catalog',
          catalogTitleId: 'f4b5b53c-ad7e-4f37-82f8-4f76e9862281',
          title: 'Ambiguous',
        } as never,
      }),
    ).rejects.toThrow(/cannot include: title/);

    expect(service.createViewForUser).not.toHaveBeenCalled();
  });

  it('returns the v2 view after create and update', async () => {
    const created = await controller.create(user, {
      identity: {
        kind: 'manual',
        title: 'Example',
        mediumType: WorkType.novel,
      },
    });
    const updated = await controller.update(user, 'record-1', {
      favorite: true,
    });

    expect(service.getV2ViewOrThrow).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'record-1',
    );
    expect(service.updateViewForUser).toHaveBeenCalledWith(
      'user-1',
      'record-1',
      { favorite: true },
    );
    expect(created).toEqual(updated);
  });
});
