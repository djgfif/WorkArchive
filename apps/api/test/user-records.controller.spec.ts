import { WorkStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { UserRecordsController } from '../src/modules/user-records/user-records.controller';
import type { UserRecordsService } from '../src/modules/user-records/user-records.service';

describe('UserRecordsController', () => {
  let controller: UserRecordsController;
  let userRecordsService: jest.Mocked<
    Pick<UserRecordsService, 'getReleasesView'>
  >;

  beforeEach(() => {
    userRecordsService = {
      getReleasesView: jest.fn(),
    };
    controller = new UserRecordsController(
      userRecordsService as unknown as UserRecordsService,
    );
  });

  it('returns catalog releases together with matching user release records', async () => {
    const response = {
      policy: {
        defaultProgressUnit: null,
        mediumType: 'novel',
        progressOnly: false,
        recordingUnit: 'title',
        releaseRecordsSupported: true,
        webPartSplitEnabled: true,
      },
      releases: [
        {
          catalogTitleId: 'catalog-title-1',
          displayLabel: 'Vol. 1',
          id: 'release-1',
          isbn: '9781234567890',
          releaseDate: '2026-04-18T00:00:00.000Z',
          releaseType: 'volume',
          sequence: 1,
          summary: '',
          thumbnailUrl: 'https://example.com/vol1.jpg',
          title: 'Dune Vol. 1',
          userReleaseRecord: {
            catalogReleaseId: 'release-1',
            createdAt: '2026-04-18T00:00:00.000Z',
            deletedAt: null,
            favorite: false,
            id: 'user-release-1',
            rating: 4.5,
            review: '',
            serverVersion: 1,
            shortReview: 'Great volume',
            status: WorkStatus.completed,
            syncStatus: 'synced',
            updatedAt: '2026-04-18T00:00:00.000Z',
            userWorkRecordId: 'record-1',
          },
        },
      ],
    };

    userRecordsService.getReleasesView.mockResolvedValue(response as never);

    const result = await controller.findReleases(
      {
        email: 'user@example.com',
        role: 'user',
        sessionId: 'session-1',
        userId: 'user-1',
      },
      'record-1',
    );

    expect(userRecordsService.getReleasesView).toHaveBeenCalledWith(
      'user-1',
      'record-1',
    );
    expect(result.releases).toEqual([
      expect.objectContaining({
        displayLabel: 'Vol. 1',
        id: 'release-1',
        userReleaseRecord: expect.objectContaining({
          id: 'user-release-1',
          rating: 4.5,
          status: WorkStatus.completed,
        }),
      }),
    ]);
  });
});
