import {
  TierBoardAssetKind,
  TierBoardAssetStorageType,
  TierBoardCardSourceType,
} from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type {
  SyncTierBoardAssetPayloadDto,
  SyncTierBoardCardPayloadDto,
  SyncTierLanePayloadDto,
} from '../src/modules/sync/payloads/sync-tier-board-payload.dto';
import {
  validateTierBoardAssetParents,
  validateTierBoardCardParents,
  validateTierLaneParents,
} from '../src/modules/sync/services/sync-push.tier-board-validation';

const USER_ID = '2c92b57e-e529-4344-bd62-0cff4de5dfe2';
const OTHER_USER_ID = 'fcaf0c1d-ac54-422d-a222-b29ff0940d2e';
const BOARD_ID = 'b2e7f8a5-0d7a-4874-9fc1-88124c77d901';
const OTHER_BOARD_ID = '97ec202f-c909-46c1-97d8-990e1932a7c9';
const LANE_ID = '877fb270-a90b-445f-bc7e-eec9611b6b1d';
const CARD_ID = '0cb7bbce-0885-468f-ab6b-b66d646b78ec';

type TierBoardValidationClient = Parameters<
  typeof validateTierBoardCardParents
>[2];

const boardFindUnique = jest.fn<() => Promise<unknown>>();
const laneFindUnique = jest.fn<() => Promise<unknown>>();
const cardFindUnique = jest.fn<() => Promise<unknown>>();

const client = {
  userTierBoard: { findUnique: boardFindUnique },
  userTierLane: { findUnique: laneFindUnique },
  userTierBoardCard: { findUnique: cardFindUnique },
} as unknown as TierBoardValidationClient;

function buildCardPayload(
  overrides: Partial<SyncTierBoardCardPayloadDto> = {},
): SyncTierBoardCardPayloadDto {
  return {
    id: CARD_ID,
    boardId: BOARD_ID,
    laneId: LANE_ID,
    cardSourceType: TierBoardCardSourceType.library_work,
    title: 'Dune',
    subtitle: 'Novel',
    imageUrl: 'https://example.com/dune.jpg',
    note: 'Re-read',
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

function buildLanePayload(
  overrides: Partial<SyncTierLanePayloadDto> = {},
): SyncTierLanePayloadDto {
  return {
    id: LANE_ID,
    boardId: BOARD_ID,
    title: 'S',
    description: 'Top shelf',
    colorToken: '#123456',
    orderIndex: 2,
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
    id: 'dc42d556-13a5-4b28-897c-5c79d68a7f79',
    boardId: BOARD_ID,
    cardId: CARD_ID,
    kind: TierBoardAssetKind.image,
    storageType: TierBoardAssetStorageType.remote_url,
    objectUrl: 'https://example.com/image.jpg',
    originalName: 'image.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T01:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

describe('tier board sync parent validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateTierLaneParents', () => {
    it('rejects lane payloads when the parent board is unavailable', async () => {
      for (const board of [
        null,
        { id: BOARD_ID, userId: OTHER_USER_ID, deletedAt: null },
        {
          id: BOARD_ID,
          userId: USER_ID,
          deletedAt: new Date('2026-04-18T01:00:00.000Z'),
        },
      ]) {
        boardFindUnique.mockResolvedValueOnce(board);

        await expect(
          validateTierLaneParents(USER_ID, buildLanePayload(), client),
        ).resolves.toBe(
          'Parent tier board is missing or belongs to another user.',
        );
      }
    });

    it('accepts lane payloads with a valid board parent', async () => {
      boardFindUnique.mockResolvedValue({
        id: BOARD_ID,
        userId: USER_ID,
        deletedAt: null,
      });

      await expect(
        validateTierLaneParents(USER_ID, buildLanePayload(), client),
      ).resolves.toBeNull();
    });
  });

  describe('validateTierBoardCardParents', () => {
    it('rejects card payloads when the parent board is unavailable', async () => {
      for (const board of [
        null,
        { id: BOARD_ID, userId: OTHER_USER_ID, deletedAt: null },
        {
          id: BOARD_ID,
          userId: USER_ID,
          deletedAt: new Date('2026-04-18T01:00:00.000Z'),
        },
      ]) {
        boardFindUnique.mockResolvedValueOnce(board);

        await expect(
          validateTierBoardCardParents(USER_ID, buildCardPayload(), client),
        ).resolves.toBe(
          'Parent tier board is missing or belongs to another user.',
        );
      }

      expect(laneFindUnique).not.toHaveBeenCalled();
    });

    it('accepts card payloads with a valid board and no lane', async () => {
      boardFindUnique.mockResolvedValue({
        id: BOARD_ID,
        userId: USER_ID,
        deletedAt: null,
      });

      await expect(
        validateTierBoardCardParents(
          USER_ID,
          buildCardPayload({ laneId: null }),
          client,
        ),
      ).resolves.toBeNull();

      expect(laneFindUnique).not.toHaveBeenCalled();
    });

    it('rejects card payloads when the parent lane is unavailable', async () => {
      boardFindUnique.mockResolvedValue({
        id: BOARD_ID,
        userId: USER_ID,
        deletedAt: null,
      });

      for (const lane of [
        null,
        {
          id: LANE_ID,
          boardId: OTHER_BOARD_ID,
          deletedAt: null,
          board: { userId: USER_ID },
        },
        {
          id: LANE_ID,
          boardId: BOARD_ID,
          deletedAt: null,
          board: { userId: OTHER_USER_ID },
        },
        {
          id: LANE_ID,
          boardId: BOARD_ID,
          deletedAt: new Date('2026-04-18T01:00:00.000Z'),
          board: { userId: USER_ID },
        },
      ]) {
        laneFindUnique.mockResolvedValueOnce(lane);

        await expect(
          validateTierBoardCardParents(USER_ID, buildCardPayload(), client),
        ).resolves.toBe(
          'Parent tier board lane is missing or belongs to another user.',
        );
      }
    });

    it('accepts card payloads with valid board and lane parents', async () => {
      boardFindUnique.mockResolvedValue({
        id: BOARD_ID,
        userId: USER_ID,
        deletedAt: null,
      });
      laneFindUnique.mockResolvedValue({
        id: LANE_ID,
        boardId: BOARD_ID,
        deletedAt: null,
        board: { userId: USER_ID },
      });

      await expect(
        validateTierBoardCardParents(USER_ID, buildCardPayload(), client),
      ).resolves.toBeNull();
    });
  });

  describe('validateTierBoardAssetParents', () => {
    it('rejects asset payloads when the parent board is unavailable', async () => {
      boardFindUnique.mockResolvedValue(null);

      await expect(
        validateTierBoardAssetParents(USER_ID, buildAssetPayload(), client),
      ).resolves.toBe(
        'Parent tier board is missing or belongs to another user.',
      );

      expect(cardFindUnique).not.toHaveBeenCalled();
    });

    it('accepts asset payloads with a valid board and no card', async () => {
      boardFindUnique.mockResolvedValue({
        id: BOARD_ID,
        userId: USER_ID,
        deletedAt: null,
      });

      await expect(
        validateTierBoardAssetParents(
          USER_ID,
          buildAssetPayload({ cardId: null }),
          client,
        ),
      ).resolves.toBeNull();

      expect(cardFindUnique).not.toHaveBeenCalled();
    });

    it('rejects asset payloads when the parent card is unavailable', async () => {
      boardFindUnique.mockResolvedValue({
        id: BOARD_ID,
        userId: USER_ID,
        deletedAt: null,
      });

      for (const card of [
        null,
        {
          id: CARD_ID,
          boardId: OTHER_BOARD_ID,
          deletedAt: null,
          board: { userId: USER_ID },
        },
        {
          id: CARD_ID,
          boardId: BOARD_ID,
          deletedAt: null,
          board: { userId: OTHER_USER_ID },
        },
        {
          id: CARD_ID,
          boardId: BOARD_ID,
          deletedAt: new Date('2026-04-18T01:00:00.000Z'),
          board: { userId: USER_ID },
        },
      ]) {
        cardFindUnique.mockResolvedValueOnce(card);

        await expect(
          validateTierBoardAssetParents(USER_ID, buildAssetPayload(), client),
        ).resolves.toBe(
          'Parent tier board card is missing or belongs to another user.',
        );
      }
    });

    it('accepts asset payloads with valid board and card parents', async () => {
      boardFindUnique.mockResolvedValue({
        id: BOARD_ID,
        userId: USER_ID,
        deletedAt: null,
      });
      cardFindUnique.mockResolvedValue({
        id: CARD_ID,
        boardId: BOARD_ID,
        deletedAt: null,
        board: { userId: USER_ID },
      });

      await expect(
        validateTierBoardAssetParents(USER_ID, buildAssetPayload(), client),
      ).resolves.toBeNull();
    });
  });
});
