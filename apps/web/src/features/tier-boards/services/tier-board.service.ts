import type {
  TierBoardCardRecord,
  TierLaneRecord,
  TierBoardRecord,
} from '@work-archive/shared-types';

import {
  syncQueueRepository,
  type SyncQueueRepository,
} from '../../sync/queue';
import { worksRepository, type WorksRepository } from '@features/works/data';
import {
  tierBoardRepository,
  type StoredTierBoardAssetRecord,
  type TierBoardEditorState,
  type TierBoardRepository,
} from './tier-board.repository';
import {
  blobToDataUrl,
  cacheTierBoardAssetDataUrl,
  createLocalTierBoardAssetUrl,
  fileToBlob,
  MAX_TIER_BOARD_UPLOAD_BYTES,
  SUPPORTED_TIER_BOARD_UPLOAD_MIME_TYPES,
} from './tier-board-assets';
import {
  buildTierBoardExportAssets,
  buildTierBoardImportRecords,
} from './tier-board-portability';
import {
  assertExportDocument,
  cloneBoard,
  createBoardRecord,
  createCardRecord,
  createLaneRecord,
  createWorkSubtitle,
  getNextOrderIndex,
  getNextSyncStatus,
  getRestoredSyncStatus,
  getRestoreOperation,
  nowIso,
  prepareCardForExport,
  touchTierBoard,
} from './tier-board-records';
import { getTierBoardTemplate } from './tier-board.templates';
import { TierBoardSyncQueueWriter } from './tier-board-sync-queue';
import type {
  CreateBoardInput,
  CreateCardInput,
  CreateLaneInput,
  TierBoardExportDocument,
  TierLaneDeleteSnapshot,
  UpdateBoardInput,
  UpdateCardInput,
  UpdateLaneInput,
} from './tier-board.types';

export { TIER_BOARD_TEMPLATES } from './tier-board.templates';
export type {
  CreateBoardInput,
  CreateCardInput,
  CreateLaneInput,
  TierBoardExportDocument,
  TierLaneDeleteSnapshot,
  UpdateBoardInput,
  UpdateCardInput,
  UpdateLaneInput,
} from './tier-board.types';

export class TierBoardService {
  private readonly syncQueue: TierBoardSyncQueueWriter;

  constructor(
    private readonly repository: TierBoardRepository = tierBoardRepository,
    queueRepository: SyncQueueRepository = syncQueueRepository,
    private readonly worksRepo: WorksRepository = worksRepository,
  ) {
    this.syncQueue = new TierBoardSyncQueueWriter(queueRepository);
  }

  listBoards() {
    return this.repository.listBoards();
  }

  getBoardById(id: string) {
    return this.repository.getBoardById(id);
  }

  getBoardEditorState(id: string) {
    return this.repository.getBoardEditorState(id);
  }

  async createBoard(input: CreateBoardInput = {}) {
    const now = nowIso();
    const board = createBoardRecord(input, now);
    const template = getTierBoardTemplate(input.templateTitle);
    const lanes = template.lanes.map((lane, index) =>
      createLaneRecord(board.id, lane, index, now),
    );
    const db = this.repository.getDbInstance();

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

    return board;
  }

  async updateBoard(id: string, input: UpdateBoardInput) {
    const board = await this.requireBoard(id);
    const now = nowIso();
    const updated: TierBoardRecord = {
      ...board,
      ...input,
      description: input.description ?? board.description,
      title: input.title?.trim() || board.title,
      updatedAt: now,
      syncStatus: getNextSyncStatus(board.serverVersion),
    };

    await this.repository.putBoard(updated);
    await this.syncQueue.enqueueBoard(updated, 'update');

    return updated;
  }

  async deleteBoard(id: string) {
    const state = await this.requireEditorState(id);
    const now = nowIso();
    const board: TierBoardRecord = {
      ...state.board,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
    const lanes = state.lanes.map<TierLaneRecord>((lane) => ({
      ...lane,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(lane.serverVersion),
    }));
    const cards = state.cards.map<TierBoardCardRecord>((card) => ({
      ...card,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(card.serverVersion),
    }));
    const assets = state.assets.map<StoredTierBoardAssetRecord>((asset) => ({
      ...asset,
      deletedAt: now,
      updatedAt: now,
    }));
    const db = this.repository.getDbInstance();

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

    return state;
  }

  async restoreBoardSnapshot(state: TierBoardEditorState) {
    const db = this.repository.getDbInstance();
    const now = nowIso();
    const board: TierBoardRecord = {
      ...state.board,
      deletedAt: null,
      updatedAt: now,
      syncStatus: getRestoredSyncStatus(state.board),
    };
    const lanes = state.lanes.map<TierLaneRecord>((lane) => ({
      ...lane,
      deletedAt: null,
      updatedAt: now,
      syncStatus: getRestoredSyncStatus(lane),
    }));
    const cards = state.cards.map<TierBoardCardRecord>((card) => ({
      ...card,
      deletedAt: null,
      updatedAt: now,
      syncStatus: getRestoredSyncStatus(card),
    }));
    const assets = state.assets.map<StoredTierBoardAssetRecord>((asset) => ({
      ...asset,
      deletedAt: null,
      updatedAt: now,
    }));

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

    return { assets, board, cards, lanes };
  }

  async duplicateBoard(id: string) {
    const state = await this.requireEditorState(id);
    const now = nowIso();
    const board = cloneBoard(state.board, now);
    const laneIdMap = new Map<string, string>();
    const cardIdMap = new Map<string, string>();
    const assetObjectUrlMap = new Map<string, string>();
    const lanes = state.lanes.map<TierLaneRecord>((lane) => {
      const nextId = crypto.randomUUID();
      laneIdMap.set(lane.id, nextId);

      return {
        ...lane,
        id: nextId,
        boardId: board.id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'local-only',
        serverVersion: 0,
      };
    });
    const cards = state.cards.map<TierBoardCardRecord>((card) => {
      const nextId = crypto.randomUUID();
      cardIdMap.set(card.id, nextId);

      return {
        ...card,
        id: nextId,
        boardId: board.id,
        laneId: card.laneId ? (laneIdMap.get(card.laneId) ?? null) : null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'local-only',
        serverVersion: 0,
      };
    });
    const assets = state.assets.map<StoredTierBoardAssetRecord>((asset) => {
      const id = crypto.randomUUID();
      const objectUrl =
        asset.storageType === 'local_blob'
          ? createLocalTierBoardAssetUrl(id)
          : asset.objectUrl;

      assetObjectUrlMap.set(asset.objectUrl, objectUrl);

      return {
        ...asset,
        id,
        boardId: board.id,
        cardId: asset.cardId ? (cardIdMap.get(asset.cardId) ?? null) : null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        objectUrl,
      };
    });
    const normalizedCards = cards.map<TierBoardCardRecord>((card) => ({
      ...card,
      imageUrl: assetObjectUrlMap.get(card.imageUrl) ?? card.imageUrl,
    }));
    const db = this.repository.getDbInstance();

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
        await db.tierBoardCards.bulkAdd(normalizedCards);
        await db.tierBoardAssets.bulkAdd(assets);
        await this.syncQueue.enqueueBoardInOpenTransaction(board, 'create');
        for (const lane of lanes) {
          await this.syncQueue.enqueueLaneInOpenTransaction(lane, 'create');
        }
        for (const card of normalizedCards) {
          await this.syncQueue.enqueueCardInOpenTransaction(card, 'create');
        }
        for (const asset of assets) {
          await this.syncQueue.enqueueAssetInOpenTransaction(asset, 'create');
        }
      },
    );

    return board;
  }

  async createLane(boardId: string, input: CreateLaneInput) {
    const state = await this.requireEditorState(boardId);
    const now = nowIso();
    const lane = createLaneRecord(
      boardId,
      input,
      getNextOrderIndex(state.lanes),
      now,
    );
    const touchedBoard = touchTierBoard(state.board, now);
    const db = this.repository.getDbInstance();

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
        await this.syncQueue.enqueueLaneInOpenTransaction(lane, 'create');
      },
    );

    return lane;
  }

  async updateLane(id: string, input: UpdateLaneInput) {
    const lane = await this.requireLane(id);
    const state = await this.requireEditorState(lane.boardId);
    const now = nowIso();
    const updated: TierLaneRecord = {
      ...lane,
      ...input,
      title: input.title?.trim() || lane.title,
      description: input.description ?? lane.description,
      updatedAt: now,
      syncStatus: getNextSyncStatus(lane.serverVersion),
    };
    const touchedBoard = touchTierBoard(state.board, now);
    const db = this.repository.getDbInstance();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierLanes,
      db.syncQueue,
      async () => {
        await db.tierBoards.put(touchedBoard);
        await db.tierLanes.put(updated);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          touchedBoard,
          'update',
        );
        await this.syncQueue.enqueueLaneInOpenTransaction(updated, 'update');
      },
    );

    return updated;
  }

  async reorderLane(boardId: string, laneIds: string[]) {
    const state = await this.requireEditorState(boardId);
    const lanesById = new Map(state.lanes.map((lane) => [lane.id, lane]));
    const now = nowIso();
    const touchedBoard = touchTierBoard(state.board, now);
    const lanes = laneIds.flatMap((id, index) => {
      const lane = lanesById.get(id);

      return lane
        ? [
            {
              ...lane,
              orderIndex: index,
              updatedAt: now,
              syncStatus: getNextSyncStatus(lane.serverVersion),
            },
          ]
        : [];
    });

    const db = this.repository.getDbInstance();

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

    return lanes;
  }

  async deleteLane(id: string) {
    const lane = await this.requireLane(id);
    const state = await this.requireEditorState(lane.boardId);
    const now = nowIso();
    const touchedBoard = touchTierBoard(state.board, now);
    const deletedLane: TierLaneRecord = {
      ...lane,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(lane.serverVersion),
    };
    const laneCards = state.cards.filter((card) => card.laneId === id);
    const movedCards = laneCards.map<TierBoardCardRecord>((card, index) => ({
      ...card,
      laneId: null,
      orderIndex:
        getNextOrderIndex(
          state.cards.filter((candidate) => candidate.laneId === null),
        ) + index,
      updatedAt: now,
      syncStatus: getNextSyncStatus(card.serverVersion),
    }));
    const db = this.repository.getDbInstance();

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

    return { cards: laneCards, lane } satisfies TierLaneDeleteSnapshot;
  }

  async restoreLaneDeleteSnapshot(snapshot: TierLaneDeleteSnapshot) {
    const now = nowIso();
    const state = await this.requireEditorState(snapshot.lane.boardId);
    const touchedBoard = touchTierBoard(state.board, now);
    const lane: TierLaneRecord = {
      ...snapshot.lane,
      deletedAt: null,
      updatedAt: now,
      syncStatus: getRestoredSyncStatus(snapshot.lane),
    };
    const cards = snapshot.cards.map<TierBoardCardRecord>((card) => ({
      ...card,
      deletedAt: null,
      updatedAt: now,
      syncStatus: getRestoredSyncStatus(card),
    }));
    const db = this.repository.getDbInstance();

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

    return { cards, lane };
  }

  async createCard(boardId: string, input: CreateCardInput) {
    const state = await this.requireEditorState(boardId);
    const now = nowIso();
    const card = createCardRecord(
      boardId,
      input,
      getNextOrderIndex(
        state.cards.filter(
          (record) => (record.laneId ?? null) === (input.laneId ?? null),
        ),
      ),
      now,
    );
    const touchedBoard = touchTierBoard(state.board, now);
    const db = this.repository.getDbInstance();

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
        await this.syncQueue.enqueueCardInOpenTransaction(card, 'create');
      },
    );

    return card;
  }

  createCustomTextCard(
    boardId: string,
    input: Omit<CreateCardInput, 'cardSourceType' | 'imageUrl'>,
  ) {
    return this.createCard(boardId, {
      ...input,
      cardSourceType: 'custom',
      imageUrl: '',
    });
  }

  async updateCard(id: string, input: UpdateCardInput) {
    const card = await this.requireCard(id);
    const state = await this.requireEditorState(card.boardId);
    const now = nowIso();
    const updated: TierBoardCardRecord = {
      ...card,
      ...input,
      title: input.title?.trim() || card.title,
      subtitle: input.subtitle ?? card.subtitle,
      note: input.note ?? card.note,
      imageUrl: input.imageUrl ?? card.imageUrl,
      updatedAt: now,
      syncStatus: getNextSyncStatus(card.serverVersion),
    };
    const touchedBoard = touchTierBoard(state.board, now);
    const db = this.repository.getDbInstance();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierBoardCards,
      db.syncQueue,
      async () => {
        await db.tierBoards.put(touchedBoard);
        await db.tierBoardCards.put(updated);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          touchedBoard,
          'update',
        );
        await this.syncQueue.enqueueCardInOpenTransaction(updated, 'update');
      },
    );

    return updated;
  }

  async deleteCard(id: string) {
    const card = await this.requireCard(id);
    const state = await this.requireEditorState(card.boardId);
    const now = nowIso();
    const deleted: TierBoardCardRecord = {
      ...card,
      deletedAt: now,
      syncStatus: getNextSyncStatus(card.serverVersion),
      updatedAt: now,
    };
    const touchedBoard = touchTierBoard(state.board, now);
    const db = this.repository.getDbInstance();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierBoardCards,
      db.syncQueue,
      async () => {
        await db.tierBoards.put(touchedBoard);
        await db.tierBoardCards.put(deleted);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          touchedBoard,
          'update',
        );
        await this.syncQueue.enqueueCardInOpenTransaction(deleted, 'delete');
      },
    );

    return card;
  }

  async duplicateCard(id: string) {
    const source = await this.requireCard(id);
    const state = await this.requireEditorState(source.boardId);
    const now = nowIso();
    const touchedBoard = touchTierBoard(state.board, now);
    const card: TierBoardCardRecord = {
      ...source,
      id: crypto.randomUUID(),
      title: `${source.title} 복사본`,
      orderIndex: getNextOrderIndex(
        state.cards.filter((candidate) => candidate.laneId === source.laneId),
      ),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    };
    const db = this.repository.getDbInstance();

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
        await this.syncQueue.enqueueCardInOpenTransaction(card, 'create');
      },
    );

    return card;
  }

  async restoreCardSnapshot(card: TierBoardCardRecord) {
    const state = await this.requireEditorState(card.boardId);
    const now = nowIso();
    const restored: TierBoardCardRecord = {
      ...card,
      deletedAt: null,
      updatedAt: now,
      syncStatus: getRestoredSyncStatus(card),
    };
    const touchedBoard = touchTierBoard(state.board, now);
    const db = this.repository.getDbInstance();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierBoardCards,
      db.syncQueue,
      async () => {
        await db.tierBoards.put(touchedBoard);
        await db.tierBoardCards.put(restored);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          touchedBoard,
          'update',
        );
        await this.syncQueue.enqueueCardInOpenTransaction(
          restored,
          getRestoreOperation(restored),
        );
      },
    );

    return restored;
  }

  moveCardToLane(id: string, laneId: string) {
    return this.moveCard(id, laneId);
  }

  removeCardFromLane(id: string) {
    return this.moveCard(id, null);
  }

  async reorderCard(boardId: string, laneId: string | null, cardIds: string[]) {
    const state = await this.requireEditorState(boardId);
    const cardsById = new Map(state.cards.map((card) => [card.id, card]));
    const now = nowIso();
    const touchedBoard = touchTierBoard(state.board, now);
    const cards = cardIds.flatMap((id, index) => {
      const card = cardsById.get(id);

      return card
        ? [
            {
              ...card,
              laneId,
              orderIndex: index,
              updatedAt: now,
              syncStatus: getNextSyncStatus(card.serverVersion),
            },
          ]
        : [];
    });

    const db = this.repository.getDbInstance();

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

    return cards;
  }

  async createCardFromWorkSnapshot(
    boardId: string,
    workId: string,
    laneId: string | null = null,
  ) {
    const work = await this.worksRepo.getById(workId);

    if (!work || work.deletedAt !== null) {
      throw new Error('가져올 작품을 찾을 수 없습니다.');
    }

    const state = await this.requireEditorState(boardId);
    const now = nowIso();
    const touchedBoard = touchTierBoard(state.board, now);
    const card: TierBoardCardRecord = {
      ...createCardRecord(
        boardId,
        {
          imageUrl: work.thumbnailUrl,
          laneId,
          note: work.shortReview,
          cardSourceType: 'library_work',
          subtitle: createWorkSubtitle(work),
          title: work.title,
        },
        getNextOrderIndex(
          state.cards.filter((record) => record.laneId === laneId),
        ),
        now,
      ),
      workId: work.id,
    };
    const db = this.repository.getDbInstance();

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
        await this.syncQueue.enqueueCardInOpenTransaction(card, 'create');
      },
    );

    return card;
  }

  createImageUrlCard(
    boardId: string,
    input: Omit<CreateCardInput, 'cardSourceType'>,
  ) {
    return this.createCard(boardId, {
      ...input,
      cardSourceType: 'image_url',
    });
  }

  async createUploadedImageCard(
    boardId: string,
    file: File,
    input: Omit<CreateCardInput, 'imageUrl' | 'cardSourceType'>,
  ) {
    if (!SUPPORTED_TIER_BOARD_UPLOAD_MIME_TYPES.has(file.type)) {
      throw new Error('jpg, jpeg, png, webp 이미지만 업로드할 수 있습니다.');
    }

    if (file.size > MAX_TIER_BOARD_UPLOAD_BYTES) {
      throw new Error('이미지 파일은 5MB 이하만 업로드할 수 있습니다.');
    }

    const state = await this.requireEditorState(boardId);
    const now = nowIso();
    const assetId = crypto.randomUUID();
    const objectUrl = createLocalTierBoardAssetUrl(assetId);
    const blob = await fileToBlob(file);
    const dataUrl = await blobToDataUrl(blob);
    cacheTierBoardAssetDataUrl(assetId, dataUrl);
    const card: TierBoardCardRecord = createCardRecord(
      boardId,
      {
        ...input,
        imageUrl: objectUrl,
        cardSourceType: 'image_upload',
      },
      getNextOrderIndex(
        state.cards.filter(
          (record) => (record.laneId ?? null) === (input.laneId ?? null),
        ),
      ),
      now,
    );
    const asset: StoredTierBoardAssetRecord = {
      id: assetId,
      boardId,
      cardId: card.id,
      kind: 'image',
      storageType: 'local_blob',
      objectUrl,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      blob,
      dataUrl,
    };
    const touchedBoard = touchTierBoard(state.board, now);
    const db = this.repository.getDbInstance();

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

    return { asset, card };
  }

  async exportBoardJson(boardId: string): Promise<TierBoardExportDocument> {
    const state = await this.requireEditorState(boardId);
    const assets = await buildTierBoardExportAssets(state.assets);

    return {
      format: 'work-archive.tier-board',
      version: 1,
      exportedAt: nowIso(),
      board: state.board,
      lanes: state.lanes,
      cards: state.cards.map(prepareCardForExport),
      assets,
    };
  }

  async importBoardJson(rawValue: string) {
    const startedAt = Date.now();

    try {
      return await this.importBoardJsonUnsafe(rawValue);
    } catch (error) {
      this.logTierBoardEvent('tier_board.import.failed', {
        durationMs: Date.now() - startedAt,
        errorCode: error instanceof Error ? error.name : 'UnknownError',
      });
      throw error;
    }
  }

  private async importBoardJsonUnsafe(rawValue: string) {
    const parsed = assertExportDocument(JSON.parse(rawValue));
    const now = nowIso();
    const { assets, board, cards, lanes } = buildTierBoardImportRecords(
      parsed,
      now,
    );
    const db = this.repository.getDbInstance();

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
        await this.syncQueue.enqueueBoardInOpenTransaction(
          board,
          'create',
          'tier_board_import',
        );
        for (const lane of lanes) {
          await this.syncQueue.enqueueLaneInOpenTransaction(
            lane,
            'create',
            'tier_board_import',
          );
        }
        for (const card of cards) {
          await this.syncQueue.enqueueCardInOpenTransaction(
            card,
            'create',
            'tier_board_import',
          );
        }
        for (const asset of assets) {
          await this.syncQueue.enqueueAssetInOpenTransaction(
            asset,
            'create',
            'tier_board_import',
          );
        }
      },
    );

    return board;
  }

  private logTierBoardEvent(
    event: string,
    fields: {
      durationMs?: number;
      errorCode?: string;
    } = {},
  ) {
    console.warn(
      JSON.stringify({
        count: null,
        durationMs: fields.durationMs ?? null,
        entityType: 'tier_board',
        errorCode: fields.errorCode ?? null,
        event,
        provider: null,
        requestId: null,
        userId: null,
      }),
    );
  }

  async applyLaneTemplate(boardId: string, templateLabel: string) {
    const template = getTierBoardTemplate(templateLabel);
    const state = await this.requireEditorState(boardId);
    const now = nowIso();
    const touchedBoard = touchTierBoard(state.board, now);
    const deletedLanes = state.lanes.map<TierLaneRecord>((lane) => ({
      ...lane,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(lane.serverVersion),
    }));
    const lanes = template.lanes.map((lane, index) =>
      createLaneRecord(boardId, lane, index, now),
    );
    const cards = state.cards.map<TierBoardCardRecord>((card) => ({
      ...card,
      laneId: null,
      updatedAt: now,
      syncStatus: getNextSyncStatus(card.serverVersion),
    }));
    const db = this.repository.getDbInstance();

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

    return lanes;
  }

  private async moveCard(id: string, laneId: string | null) {
    const card = await this.requireCard(id);
    const state = await this.requireEditorState(card.boardId);
    const now = nowIso();
    const moved: TierBoardCardRecord = {
      ...card,
      laneId,
      orderIndex: getNextOrderIndex(
        state.cards.filter(
          (record) => record.laneId === laneId && record.id !== id,
        ),
      ),
      updatedAt: now,
      syncStatus: getNextSyncStatus(card.serverVersion),
    };
    const touchedBoard = touchTierBoard(state.board, now);
    const db = this.repository.getDbInstance();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierBoardCards,
      db.syncQueue,
      async () => {
        await db.tierBoards.put(touchedBoard);
        await db.tierBoardCards.put(moved);
        await this.syncQueue.enqueueBoardInOpenTransaction(
          touchedBoard,
          'update',
        );
        await this.syncQueue.enqueueCardInOpenTransaction(moved, 'update');
      },
    );

    return moved;
  }

  private async requireBoard(id: string) {
    const board = await this.repository.getBoardById(id);

    if (!board) {
      throw new Error('티어보드를 찾을 수 없습니다.');
    }

    return board;
  }

  private async requireEditorState(id: string) {
    const state = await this.repository.getBoardEditorState(id);

    if (!state) {
      throw new Error('티어보드를 찾을 수 없습니다.');
    }

    return state;
  }

  private async requireLane(id: string) {
    const lane = await this.repository.getLaneById(id);

    if (!lane) {
      throw new Error('티어 행을 찾을 수 없습니다.');
    }

    return lane;
  }

  private async requireCard(id: string) {
    const card = await this.repository.getCardById(id);

    if (!card) {
      throw new Error('티어보드 항목을 찾을 수 없습니다.');
    }

    return card;
  }
}

export const tierBoardService = new TierBoardService();
