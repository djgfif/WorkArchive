import type {
  SyncEntityType,
  TierBoardAssetRecord,
  TierBoardItemRecord,
  TierBoardLaneRecord,
  TierBoardRecord,
} from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../../works/db/work-archive.db';

type DatabaseResolver = () => WorkArchiveDatabase;

export type StoredTierBoardAssetRecord = TierBoardAssetRecord & {
  blob?: Blob | null;
};

export interface TierBoardEditorState {
  assets: StoredTierBoardAssetRecord[];
  board: TierBoardRecord;
  items: TierBoardItemRecord[];
  lanes: TierBoardLaneRecord[];
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

    const [lanes, items, assets] = await Promise.all([
      db.tierBoardLanes
        .where('boardId')
        .equals(id)
        .toArray()
        .then((records) =>
          records
            .filter(isActive)
            .sort((left, right) => left.orderIndex - right.orderIndex),
        ),
      db.tierBoardItems
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
      items,
      lanes,
    };
  }

  async putBoard(board: TierBoardRecord) {
    await this.getDb().tierBoards.put(board);

    return board;
  }

  async putLane(lane: TierBoardLaneRecord) {
    await this.getDb().tierBoardLanes.put(lane);

    return lane;
  }

  async putItem(item: TierBoardItemRecord) {
    await this.getDb().tierBoardItems.put(item);

    return item;
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

  async bulkPutLanes(lanes: TierBoardLaneRecord[]) {
    if (lanes.length > 0) {
      await this.getDb().tierBoardLanes.bulkPut(lanes);
    }

    return lanes;
  }

  async bulkPutItems(items: TierBoardItemRecord[]) {
    if (items.length > 0) {
      await this.getDb().tierBoardItems.bulkPut(items);
    }

    return items;
  }

  async bulkPutAssets(assets: StoredTierBoardAssetRecord[]) {
    if (assets.length > 0) {
      await this.getDb().tierBoardAssets.bulkPut(assets);
    }

    return assets;
  }

  async getLaneById(id: string) {
    const lane = await this.getDb().tierBoardLanes.get(id);

    return lane && isActive(lane) ? lane : null;
  }

  async getItemById(id: string) {
    const item = await this.getDb().tierBoardItems.get(id);

    return item && isActive(item) ? item : null;
  }

  async getEntity(entityType: SyncEntityType, id: string) {
    if (entityType === 'tier_board') return this.getDb().tierBoards.get(id);
    if (entityType === 'tier_board_lane') return this.getDb().tierBoardLanes.get(id);
    if (entityType === 'tier_board_item') return this.getDb().tierBoardItems.get(id);
    if (entityType === 'tier_board_asset') return this.getDb().tierBoardAssets.get(id);

    return null;
  }

  async putEntity(
    entity:
      | TierBoardRecord
      | TierBoardLaneRecord
      | TierBoardItemRecord
      | StoredTierBoardAssetRecord,
  ) {
    if ('layout' in entity) return this.putBoard(entity);
    if ('sourceType' in entity) return this.putItem(entity);
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
    } as TierBoardRecord | TierBoardLaneRecord | TierBoardItemRecord);
  }
}

export const tierBoardRepository = new TierBoardRepository();
