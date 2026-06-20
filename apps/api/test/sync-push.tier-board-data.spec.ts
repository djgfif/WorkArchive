import {
  TierBoardAssetKind,
  TierBoardAssetStorageType,
  TierBoardCardSourceType,
  TierBoardType,
  TierBoardVisibility,
} from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import type {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierBoardPayloadDto,
  SyncTierLanePayloadDto,
} from '../src/modules/sync/payloads/sync-tier-board-payload.dto';
import {
  buildTierBoardAssetCreateData,
  buildTierBoardAssetUpdateData,
  buildTierBoardCardCreateData,
  buildTierBoardCardUpdateData,
  buildTierBoardCreateData,
  buildTierBoardUpdateData,
  buildTierLaneCreateData,
  buildTierLaneUpdateData,
} from '../src/modules/sync/services/sync-push.tier-board-data';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';
const BOARD_ID = 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901';
const LANE_ID = '877fb270-a90b-445f-bc7e-eec9611b6b1d';
const CARD_ID = '0cb7bbce-0885-468f-ab6b-b66d646b78ec';
const ASSET_ID = 'dc42d556-13a5-4b28-897c-5c79d68a7f79';

function buildBoardPayload(
  overrides: Partial<SyncTierBoardPayloadDto> = {},
): SyncTierBoardPayloadDto {
  return {
    id: BOARD_ID,
    title: '  Favorites  ',
    description: '  Best picks  ',
    slug: '  favorites  ',
    boardType: TierBoardType.classic_tier,
    visibility: TierBoardVisibility.private,
    coverImageUrl: '  https://example.com/cover.jpg  ',
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T01:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

function buildLanePayload(
  overrides: Partial<SyncTierLanePayloadDto> = {},
): SyncTierLanePayloadDto {
  return {
    id: LANE_ID,
    boardId: BOARD_ID,
    title: '  S  ',
    description: '  Top shelf  ',
    colorToken: '  #123456  ',
    orderIndex: 2,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T01:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

function buildCardPayload(
  overrides: Partial<SyncTierBoardCardPayloadDto> = {},
): SyncTierBoardCardPayloadDto {
  return {
    id: CARD_ID,
    boardId: BOARD_ID,
    laneId: LANE_ID,
    cardSourceType: TierBoardCardSourceType.library_work,
    title: '  Dune  ',
    subtitle: '  Novel  ',
    imageUrl: '  https://example.com/dune.jpg  ',
    note: '  Re-read  ',
    workId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
    orderIndex: 4,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T01:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

function buildAssetPayload(
  overrides: Partial<SyncTierBoardAssetPayloadDto> = {},
): SyncTierBoardAssetPayloadDto {
  return {
    id: ASSET_ID,
    boardId: BOARD_ID,
    cardId: CARD_ID,
    kind: TierBoardAssetKind.image,
    storageType: TierBoardAssetStorageType.remote_url,
    objectUrl: '  https://example.com/image.jpg  ',
    originalName: '  image.jpg  ',
    mimeType: '  image/jpeg  ',
    sizeBytes: 1000,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T01:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

describe('sync push tier board data builders', () => {
  it('builds normalized tier board create and update data', () => {
    expect(buildTierBoardCreateData(USER_ID, buildBoardPayload())).toEqual({
      id: BOARD_ID,
      userId: USER_ID,
      slug: 'favorites',
      title: 'Favorites',
      description: 'Best picks',
      boardType: TierBoardType.classic_tier,
      visibility: TierBoardVisibility.private,
      coverImageUrl: 'https://example.com/cover.jpg',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T01:00:00.000Z'),
      deletedAt: null,
      syncStatus: 'synced',
      serverVersion: 1,
    });

    expect(
      buildTierBoardUpdateData(
        buildBoardPayload({
          title: '   ',
          slug: '   ',
          deletedAt: '2026-04-19T00:00:00.000Z',
        }),
      ),
    ).toEqual({
      title: BOARD_ID,
      description: 'Best picks',
      slug: BOARD_ID,
      boardType: TierBoardType.classic_tier,
      visibility: TierBoardVisibility.private,
      coverImageUrl: 'https://example.com/cover.jpg',
      deletedAt: new Date('2026-04-19T00:00:00.000Z'),
      syncStatus: 'synced',
      serverVersion: { increment: 1 },
    });
  });

  it('builds normalized lane create and update data with color fallback', () => {
    expect(
      buildTierLaneCreateData(
        buildLanePayload({
          colorToken: '   ',
        }),
      ),
    ).toEqual({
      id: LANE_ID,
      boardId: BOARD_ID,
      title: 'S',
      description: 'Top shelf',
      colorToken: '#64748b',
      orderIndex: 2,
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T01:00:00.000Z'),
      deletedAt: null,
      syncStatus: 'synced',
      serverVersion: 1,
    });

    expect(buildTierLaneUpdateData(buildLanePayload())).toMatchObject({
      title: 'S',
      description: 'Top shelf',
      colorToken: '#123456',
      orderIndex: 2,
      syncStatus: 'synced',
      serverVersion: { increment: 1 },
    });
  });

  it('builds card create and update data using workId as userWorkId', () => {
    expect(buildTierBoardCardCreateData(buildCardPayload())).toMatchObject({
      id: CARD_ID,
      boardId: BOARD_ID,
      laneId: LANE_ID,
      userWorkId: '9fcbf92f-6347-4d79-bdf8-9d0d18439c28',
      title: 'Dune',
      subtitle: 'Novel',
      imageUrl: 'https://example.com/dune.jpg',
      note: 'Re-read',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T01:00:00.000Z'),
      syncStatus: 'synced',
      serverVersion: 1,
    });

    expect(
      buildTierBoardCardUpdateData(
        buildCardPayload({
          title: '   ',
        }),
      ),
    ).toMatchObject({
      title: CARD_ID,
      serverVersion: { increment: 1 },
    });
  });

  it('builds asset data with sync status and version on update', () => {
    const updateData = buildTierBoardAssetUpdateData(buildAssetPayload());

    expect(updateData).toEqual({
      kind: TierBoardAssetKind.image,
      storageType: TierBoardAssetStorageType.remote_url,
      objectUrl: 'https://example.com/image.jpg',
      originalName: 'image.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      cardId: CARD_ID,
      deletedAt: null,
      syncStatus: 'synced',
      serverVersion: { increment: 1 },
    });

    expect(buildTierBoardAssetCreateData(buildAssetPayload())).toEqual({
      ...updateData,
      id: ASSET_ID,
      boardId: BOARD_ID,
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T01:00:00.000Z'),
      serverVersion: 1,
    });
  });
});
