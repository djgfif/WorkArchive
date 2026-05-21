import type {
  SyncEntityType,
  TierBoardAssetRecord,
  TierBoardCardRecord,
  TierLaneRecord,
  TierBoardRecord,
} from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../../works/db/work-archive.db';

type DatabaseResolver = () => WorkArchiveDatabase;

export type StoredTierBoardAssetRecord = TierBoardAssetRecord & {
  blob?: Blob | null;
  dataUrl?: string;
};

export interface TierBoardEditorState {
  assets: StoredTierBoardAssetRecord[];
  board: TierBoardRecord;
  cards: TierBoardCardRecord[];
  lanes: TierLaneRecord[];
}

function isActive(record: { deletedAt: string | null }) {
  return record.deletedAt === null;
}

export class TierBoardRepository {
  constructor(private readonly getDb: DatabaseResolver = getWorkArchiveDb) {}

  getDbInstance() {
    return this.getDb();
  }

  async listBoards() {
    return (await this.getDb().tierBoards.toArray())
      .filter(isActive)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getBoardById(id: string) {
    const board = await this.getDb().tierBoards.get(id);

    return board && isActive(board) ? board : null;
  }

  async getBoardEditorState(id: string): Promise<TierBoardEditorState | null> {
    const db = this.getDb();
    const board = await db.tierBoards.get(id);

    if (!board || !isActive(board)) {
      return null;
    }

    const [lanes, cards, assets] = await Promise.all([
      db.tierLanes
        .where('boardId')
        .equals(id)
        .toArray()
        .then((records) =>
          records
            .filter(isActive)
            .sort((left, right) => left.orderIndex - right.orderIndex),
        ),
      db.tierBoardCards
        .where('boardId')
        .equals(id)
        .filter(isActive)
        .toArray()
        .then((records) =>
          records.sort(
            (left, right) =>
              left.orderIndex - right.orderIndex ||
              left.title.localeCompare(right.title),
          ),
        ),
      db.tierBoardAssets
        .where('boardId')
        .equals(id)
        .filter(isActive)
        .toArray(),
    ]);

    return {
      assets,
      board,
      cards,
      lanes,
    };
  }

  async putBoard(board: TierBoardRecord) {
    await this.getDb().tierBoards.put(board);

    return board;
  }

  async putLane(lane: TierLaneRecord) {
    await this.getDb().tierLanes.put(lane);

    return lane;
  }

  async putCard(card: TierBoardCardRecord) {
    await this.getDb().tierBoardCards.put(card);

    return card;
  }

  async putAsset(asset: StoredTierBoardAssetRecord) {
    await this.getDb().tierBoardAssets.put(asset);

    return asset;
  }

  async bulkPutBoards(boards: TierBoardRecord[]) {
    if (boards.length > 0) {
      await this.getDb().tierBoards.bulkPut(boards);
    }

    return boards;
  }

  async bulkPutLanes(lanes: TierLaneRecord[]) {
    if (lanes.length > 0) {
      await this.getDb().tierLanes.bulkPut(lanes);
    }

    return lanes;
  }

  async bulkPutCards(cards: TierBoardCardRecord[]) {
    if (cards.length > 0) {
      await this.getDb().tierBoardCards.bulkPut(cards);
    }

    return cards;
  }

  async bulkPutAssets(assets: StoredTierBoardAssetRecord[]) {
    if (assets.length > 0) {
      await this.getDb().tierBoardAssets.bulkPut(assets);
    }

    return assets;
  }

  async getLaneById(id: string) {
    const lane = await this.getDb().tierLanes.get(id);

    return lane && isActive(lane) ? lane : null;
  }

  async getCardById(id: string) {
    const card = await this.getDb().tierBoardCards.get(id);

    return card && isActive(card) ? card : null;
  }

  async getEntity(entityType: SyncEntityType, id: string) {
    if (entityType === 'tier_board') return this.getDb().tierBoards.get(id);
    if (entityType === 'tier_lane') return this.getDb().tierLanes.get(id);
    if (entityType === 'tier_board_card') return this.getDb().tierBoardCards.get(id);
    if (entityType === 'tier_board_asset') return this.getDb().tierBoardAssets.get(id);

    return null;
  }

  async putEntity(
    entity:
      | TierBoardRecord
      | TierLaneRecord
      | TierBoardCardRecord
      | StoredTierBoardAssetRecord,
  ) {
    if ('boardType' in entity) return this.putBoard(entity);
    if ('cardSourceType' in entity) return this.putCard(entity);
    if ('storageType' in entity) return this.putAsset(entity);

    return this.putLane(entity);
  }

  async markSyncStatus(entityType: SyncEntityType, id: string, syncStatus: string) {
    const entity = await this.getEntity(entityType, id);

    if (!entity || !('syncStatus' in entity)) {
      return;
    }

    await this.putEntity({
      ...entity,
      syncStatus,
    } as TierBoardRecord | TierLaneRecord | TierBoardCardRecord);
  }
}

export const tierBoardRepository = new TierBoardRepository();
