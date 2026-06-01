import type {
  SyncOperation,
  TierBoardCardRecord,
  TierLaneRecord,
  TierBoardRecord,
} from '@work-archive/shared-types';

import type { WorkArchiveDatabase } from '../../works/storage';
import type {
  StoredTierBoardAssetRecord,
} from './tier-board.repository';
import type { TierBoardRecordSet } from './tier-board-record-sets';
import { getRestoreOperation } from './tier-board-records';
import type { TierBoardSyncQueueWriter } from './tier-board-sync-queue';
import type {
  TierBoardAssetChangeSource,
  TierBoardChangeSource,
} from './tier-board.types';

type SharedTierBoardChangeSource =
  TierBoardAssetChangeSource & TierBoardChangeSource;

interface TouchedLaneWrite {
  lane: TierLaneRecord;
  operation: SyncOperation;
  touchedBoard: TierBoardRecord;
}

interface TouchedLanesWrite {
  lanes: TierLaneRecord[];
  touchedBoard: TierBoardRecord;
}

interface LaneDeleteWrite {
  deletedLane: TierLaneRecord;
  movedCards: TierBoardCardRecord[];
  touchedBoard: TierBoardRecord;
}

interface LaneRestoreWrite {
  cards: TierBoardCardRecord[];
  lane: TierLaneRecord;
  touchedBoard: TierBoardRecord;
}

interface TouchedCardWrite {
  card: TierBoardCardRecord;
  operation: SyncOperation;
  touchedBoard: TierBoardRecord;
}

interface TouchedCardsWrite {
  cards: TierBoardCardRecord[];
  touchedBoard: TierBoardRecord;
}

interface UploadedCardWrite {
  asset: StoredTierBoardAssetRecord;
  card: TierBoardCardRecord;
  touchedBoard: TierBoardRecord;
}

interface TemplateApplicationWrite {
  cards: TierBoardCardRecord[];
  deletedLanes: TierLaneRecord[];
  lanes: TierLaneRecord[];
  touchedBoard: TierBoardRecord;
}

export class TierBoardTransactionWriter {
  constructor(
    private readonly getDb: () => WorkArchiveDatabase,
    private readonly syncQueue: TierBoardSyncQueueWriter,
  ) {}

  async createBoard(board: TierBoardRecord, lanes: TierLaneRecord[]) {
    const db = this.getDb();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierLanes,
      db.syncQueue,
      async () => {
        await db.tierBoards.add(board);
        await db.tierLanes.bulkAdd(lanes);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          board,
          'create',
          'tier_board_create',
        );
        for (const lane of lanes) {
          await this.syncQueue.enqueueLaneInOpenTransaction(
            lane,
            'create',
            'tier_board_create',
          );
        }
      },
    );
  }

  async updateBoard(board: TierBoardRecord) {
    const db = this.getDb();

    await db.transaction('rw', db.tierBoards, db.syncQueue, async () => {
      await db.tierBoards.put(board);
      await this.syncQueue.enqueueBoardInOpenTransaction(board, 'update');
    });
  }

  async deleteRecordSet(recordSet: TierBoardRecordSet) {
    const { assets, board, cards, lanes } = recordSet;
    const db = this.getDb();

    await db.transaction(
      'rw',
      [
        db.tierBoards,
        db.tierLanes,
        db.tierBoardCards,
        db.tierBoardAssets,
        db.syncQueue,
      ],
      async () => {
        await db.tierBoards.put(board);
        await db.tierLanes.bulkPut(lanes);
        await db.tierBoardCards.bulkPut(cards);
        await db.tierBoardAssets.bulkPut(assets);
        await this.syncQueue.enqueueBoardInOpenTransaction(board, 'delete');
        for (const lane of lanes) {
          await this.syncQueue.enqueueLaneInOpenTransaction(lane, 'delete');
        }
        for (const card of cards) {
          await this.syncQueue.enqueueCardInOpenTransaction(card, 'delete');
        }
        for (const asset of assets) {
          await this.syncQueue.enqueueAssetInOpenTransaction(asset, 'delete');
        }
      },
    );
  }

  async restoreRecordSet(recordSet: TierBoardRecordSet) {
    const { assets, board, cards, lanes } = recordSet;
    const db = this.getDb();

    await db.transaction(
      'rw',
      [
        db.tierBoards,
        db.tierLanes,
        db.tierBoardCards,
        db.tierBoardAssets,
        db.syncQueue,
      ],
      async () => {
        await db.tierBoards.put(board);
        await db.tierLanes.bulkPut(lanes);
        await db.tierBoardCards.bulkPut(cards);
        await db.tierBoardAssets.bulkPut(assets);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          board,
          getRestoreOperation(board),
        );
        for (const lane of lanes) {
          await this.syncQueue.enqueueLaneInOpenTransaction(
            lane,
            getRestoreOperation(lane),
          );
        }
        for (const card of cards) {
          await this.syncQueue.enqueueCardInOpenTransaction(
            card,
            getRestoreOperation(card),
          );
        }
        for (const asset of assets) {
          await this.syncQueue.enqueueAssetInOpenTransaction(asset, 'create');
        }
      },
    );
  }

  async createRecordSet(
    recordSet: TierBoardRecordSet,
    source?: SharedTierBoardChangeSource,
  ) {
    const { assets, board, cards, lanes } = recordSet;
    const db = this.getDb();

    await db.transaction(
      'rw',
      [
        db.tierBoards,
        db.tierLanes,
        db.tierBoardCards,
        db.tierBoardAssets,
        db.syncQueue,
      ],
      async () => {
        await db.tierBoards.add(board);
        await db.tierLanes.bulkAdd(lanes);
        await db.tierBoardCards.bulkAdd(cards);
        await db.tierBoardAssets.bulkAdd(assets);
        await this.enqueueBoard(board, 'create', source);
        for (const lane of lanes) {
          await this.enqueueLane(lane, 'create', source);
        }
        for (const card of cards) {
          await this.enqueueCard(card, 'create', source);
        }
        for (const asset of assets) {
          await this.enqueueAsset(asset, 'create', source);
        }
      },
    );
  }

  async saveLaneChange(input: TouchedLaneWrite) {
    const { lane, operation, touchedBoard } = input;
    const db = this.getDb();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierLanes,
      db.syncQueue,
      async () => {
        await db.tierBoards.put(touchedBoard);
        await db.tierLanes.put(lane);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          touchedBoard,
          'update',
        );
        await this.syncQueue.enqueueLaneInOpenTransaction(lane, operation);
      },
    );
  }

  async reorderLanes(input: TouchedLanesWrite) {
    const { lanes, touchedBoard } = input;
    const db = this.getDb();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierLanes,
      db.syncQueue,
      async () => {
        await db.tierBoards.put(touchedBoard);
        await db.tierLanes.bulkPut(lanes);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          touchedBoard,
          'update',
        );
        for (const lane of lanes) {
          await this.syncQueue.enqueueLaneInOpenTransaction(lane, 'update');
        }
      },
    );
  }

  async deleteLane(input: LaneDeleteWrite) {
    const { deletedLane, movedCards, touchedBoard } = input;
    const db = this.getDb();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierLanes,
      db.tierBoardCards,
      db.syncQueue,
      async () => {
        await db.tierBoards.put(touchedBoard);
        await db.tierLanes.put(deletedLane);
        await db.tierBoardCards.bulkPut(movedCards);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          touchedBoard,
          'update',
        );
        await this.syncQueue.enqueueLaneInOpenTransaction(
          deletedLane,
          'delete',
        );
        for (const card of movedCards) {
          await this.syncQueue.enqueueCardInOpenTransaction(card, 'update');
        }
      },
    );
  }

  async restoreLane(input: LaneRestoreWrite) {
    const { cards, lane, touchedBoard } = input;
    const db = this.getDb();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierLanes,
      db.tierBoardCards,
      db.syncQueue,
      async () => {
        await db.tierBoards.put(touchedBoard);
        await db.tierLanes.put(lane);
        await db.tierBoardCards.bulkPut(cards);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          touchedBoard,
          'update',
        );
        await this.syncQueue.enqueueLaneInOpenTransaction(
          lane,
          getRestoreOperation(lane),
        );
        for (const card of cards) {
          await this.syncQueue.enqueueCardInOpenTransaction(
            card,
            getRestoreOperation(card),
          );
        }
      },
    );
  }

  async saveCardChange(input: TouchedCardWrite) {
    const { card, operation, touchedBoard } = input;
    const db = this.getDb();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierBoardCards,
      db.syncQueue,
      async () => {
        await db.tierBoards.put(touchedBoard);
        await db.tierBoardCards.put(card);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          touchedBoard,
          'update',
        );
        await this.syncQueue.enqueueCardInOpenTransaction(card, operation);
      },
    );
  }

  async restoreCard(input: Omit<TouchedCardWrite, 'operation'>) {
    await this.saveCardChange({
      ...input,
      operation: getRestoreOperation(input.card),
    });
  }

  async reorderCards(input: TouchedCardsWrite) {
    const { cards, touchedBoard } = input;
    const db = this.getDb();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierBoardCards,
      db.syncQueue,
      async () => {
        await db.tierBoards.put(touchedBoard);
        await db.tierBoardCards.bulkPut(cards);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          touchedBoard,
          'update',
        );
        for (const card of cards) {
          await this.syncQueue.enqueueCardInOpenTransaction(card, 'update');
        }
      },
    );
  }

  async saveUploadedCard(input: UploadedCardWrite) {
    const { asset, card, touchedBoard } = input;
    const db = this.getDb();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierBoardCards,
      db.tierBoardAssets,
      db.syncQueue,
      async () => {
        await db.tierBoards.put(touchedBoard);
        await db.tierBoardCards.add(card);
        await db.tierBoardAssets.add(asset);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          touchedBoard,
          'update',
        );
        await this.syncQueue.enqueueCardInOpenTransaction(card, 'create');
        await this.syncQueue.enqueueAssetInOpenTransaction(asset, 'create');
      },
    );
  }

  async applyTemplate(input: TemplateApplicationWrite) {
    const { cards, deletedLanes, lanes, touchedBoard } = input;
    const db = this.getDb();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierLanes,
      db.tierBoardCards,
      db.syncQueue,
      async () => {
        await db.tierBoards.put(touchedBoard);
        await db.tierLanes.bulkPut([...deletedLanes, ...lanes]);
        await db.tierBoardCards.bulkPut(cards);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          touchedBoard,
          'update',
        );
        for (const lane of deletedLanes) {
          await this.syncQueue.enqueueLaneInOpenTransaction(lane, 'delete');
        }
        for (const lane of lanes) {
          await this.syncQueue.enqueueLaneInOpenTransaction(lane, 'create');
        }
        for (const card of cards) {
          await this.syncQueue.enqueueCardInOpenTransaction(card, 'update');
        }
      },
    );
  }

  private enqueueBoard(
    board: TierBoardRecord,
    operation: SyncOperation,
    source?: TierBoardChangeSource,
  ) {
    return source
      ? this.syncQueue.enqueueBoardInOpenTransaction(board, operation, source)
      : this.syncQueue.enqueueBoardInOpenTransaction(board, operation);
  }

  private enqueueLane(
    lane: TierLaneRecord,
    operation: SyncOperation,
    source?: TierBoardChangeSource,
  ) {
    return source
      ? this.syncQueue.enqueueLaneInOpenTransaction(lane, operation, source)
      : this.syncQueue.enqueueLaneInOpenTransaction(lane, operation);
  }

  private enqueueCard(
    card: TierBoardCardRecord,
    operation: SyncOperation,
    source?: TierBoardChangeSource,
  ) {
    return source
      ? this.syncQueue.enqueueCardInOpenTransaction(card, operation, source)
      : this.syncQueue.enqueueCardInOpenTransaction(card, operation);
  }

  private enqueueAsset(
    asset: StoredTierBoardAssetRecord,
    operation: SyncOperation,
    source?: TierBoardAssetChangeSource,
  ) {
    return source
      ? this.syncQueue.enqueueAssetInOpenTransaction(asset, operation, source)
      : this.syncQueue.enqueueAssetInOpenTransaction(asset, operation);
  }
}
