import type {
  TierBoardCardRecord,
  TierLaneRecord,
  TierBoardRecord,
} from '@work-archive/shared-types';

import { appI18n, type AppTranslationKey } from '@app/i18n';
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
  createBoardRecord,
  createCardRecord,
  createLaneRecord,
  createWorkSubtitle,
  getNextOrderIndex,
  getNextSyncStatus,
  nowIso,
  prepareCardForExport,
  touchTierBoard,
} from './tier-board-records';
import {
  buildDeletedBoardRecordSet,
  buildDuplicatedBoardRecordSet,
  buildDuplicatedCardRecordSet,
  buildLaneDeleteRecordSet,
  buildLaneRestoreRecordSet,
  buildMovedCardRecordSet,
  buildReorderedCardsRecordSet,
  buildRestoredBoardRecordSet,
  buildRestoredCardRecordSet,
  buildTierBoardTemplateApplication,
} from './tier-board-record-sets';
import { getTierBoardTemplate } from './tier-board.templates';
import { TierBoardSyncQueueWriter } from './tier-board-sync-queue';
import { TierBoardTransactionWriter } from './tier-board-transaction-writer';
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
  private readonly writer: TierBoardTransactionWriter;

  constructor(
    private readonly repository: TierBoardRepository = tierBoardRepository,
    queueRepository: SyncQueueRepository = syncQueueRepository,
    private readonly worksRepo: WorksRepository = worksRepository,
  ) {
    const syncQueue = new TierBoardSyncQueueWriter(queueRepository);

    this.writer = new TierBoardTransactionWriter(
      () => this.repository.getDbInstance(),
      syncQueue,
    );
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
    const lanes = getLocalizedTemplateLanes(template.lanes).map((lane, index) =>
      createLaneRecord(board.id, lane, index, now),
    );

    await this.writer.createBoard(board, lanes);

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

    await this.writer.updateBoard(updated);

    return updated;
  }

  async deleteBoard(id: string) {
    const state = await this.requireEditorState(id);
    const now = nowIso();
    const { assets, board, cards, lanes } = buildDeletedBoardRecordSet(
      state,
      now,
    );

    await this.writer.deleteRecordSet({ assets, board, cards, lanes });

    return state;
  }

  async restoreBoardSnapshot(state: TierBoardEditorState) {
    const now = nowIso();
    const { assets, board, cards, lanes } = buildRestoredBoardRecordSet(
      state,
      now,
    );

    await this.writer.restoreRecordSet({ assets, board, cards, lanes });

    return { assets, board, cards, lanes };
  }

  async duplicateBoard(id: string) {
    const state = await this.requireEditorState(id);
    const now = nowIso();
    const { assets, board, cards, lanes } = buildDuplicatedBoardRecordSet(
      state,
      now,
    );

    await this.writer.createRecordSet({ assets, board, cards, lanes });

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

    await this.writer.saveLaneChange({
      lane,
      operation: 'create',
      touchedBoard,
    });

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

    await this.writer.saveLaneChange({
      lane: updated,
      operation: 'update',
      touchedBoard,
    });

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

    await this.writer.reorderLanes({ lanes, touchedBoard });

    return lanes;
  }

  async deleteLane(id: string) {
    const lane = await this.requireLane(id);
    const state = await this.requireEditorState(lane.boardId);
    const now = nowIso();
    const { deletedLane, movedCards, snapshot, touchedBoard } =
      buildLaneDeleteRecordSet({
        lane,
        now,
        state,
      });

    await this.writer.deleteLane({ deletedLane, movedCards, touchedBoard });

    return snapshot;
  }

  async restoreLaneDeleteSnapshot(snapshot: TierLaneDeleteSnapshot) {
    const now = nowIso();
    const state = await this.requireEditorState(snapshot.lane.boardId);
    const { cards, lane, touchedBoard } = buildLaneRestoreRecordSet({
      now,
      snapshot,
      state,
    });

    await this.writer.restoreLane({ cards, lane, touchedBoard });

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

    await this.writer.saveCardChange({
      card,
      operation: 'create',
      touchedBoard,
    });

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

    await this.writer.saveCardChange({
      card: updated,
      operation: 'update',
      touchedBoard,
    });

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

    await this.writer.saveCardChange({
      card: deleted,
      operation: 'delete',
      touchedBoard,
    });

    return card;
  }

  async duplicateCard(id: string) {
    const source = await this.requireCard(id);
    const state = await this.requireEditorState(source.boardId);
    const now = nowIso();
    const { card, touchedBoard } = buildDuplicatedCardRecordSet({
      now,
      source,
      state,
    });

    await this.writer.saveCardChange({
      card,
      operation: 'create',
      touchedBoard,
    });

    return card;
  }

  async restoreCardSnapshot(card: TierBoardCardRecord) {
    const state = await this.requireEditorState(card.boardId);
    const now = nowIso();
    const { card: restored, touchedBoard } = buildRestoredCardRecordSet({
      card,
      now,
      state,
    });

    await this.writer.restoreCard({
      card: restored,
      touchedBoard,
    });

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
    const now = nowIso();
    const { cards, touchedBoard } = buildReorderedCardsRecordSet({
      cardIds,
      laneId,
      now,
      state,
    });

    await this.writer.reorderCards({ cards, touchedBoard });

    return cards;
  }

  async createCardFromWorkSnapshot(
    boardId: string,
    workId: string,
    laneId: string | null = null,
  ) {
    const work = await this.worksRepo.getById(workId);

    if (!work || work.deletedAt !== null) {
      throw new Error(appI18n.t('tierBoards.errors.workNotFound'));
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

    await this.writer.saveCardChange({
      card,
      operation: 'create',
      touchedBoard,
    });

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
      throw new Error(appI18n.t('tierBoards.errors.invalidUploadType'));
    }

    if (file.size > MAX_TIER_BOARD_UPLOAD_BYTES) {
      throw new Error(appI18n.t('tierBoards.errors.uploadTooLarge'));
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

    await this.writer.saveUploadedCard({ asset, card, touchedBoard });

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

    await this.writer.createRecordSet(
      { assets, board, cards, lanes },
      'tier_board_import',
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
    const { cards, deletedLanes, lanes, touchedBoard } =
      buildTierBoardTemplateApplication({
        boardId,
        now,
        state,
        templateLanes: getLocalizedTemplateLanes(template.lanes),
      });

    await this.writer.applyTemplate({
      cards,
      deletedLanes,
      lanes,
      touchedBoard,
    });

    return lanes;
  }

  private async moveCard(id: string, laneId: string | null) {
    const card = await this.requireCard(id);
    const state = await this.requireEditorState(card.boardId);
    const now = nowIso();
    const { card: moved, touchedBoard } = buildMovedCardRecordSet({
      card,
      laneId,
      now,
      state,
    });

    await this.writer.saveCardChange({
      card: moved,
      operation: 'update',
      touchedBoard,
    });

    return moved;
  }

  private async requireBoard(id: string) {
    const board = await this.repository.getBoardById(id);

    if (!board) {
      throw new Error(appI18n.t('tierBoards.errors.boardNotFound'));
    }

    return board;
  }

  private async requireEditorState(id: string) {
    const state = await this.repository.getBoardEditorState(id);

    if (!state) {
      throw new Error(appI18n.t('tierBoards.errors.boardNotFound'));
    }

    return state;
  }

  private async requireLane(id: string) {
    const lane = await this.repository.getLaneById(id);

    if (!lane) {
      throw new Error(appI18n.t('tierBoards.errors.laneNotFound'));
    }

    return lane;
  }

  private async requireCard(id: string) {
    const card = await this.repository.getCardById(id);

    if (!card) {
      throw new Error(appI18n.t('tierBoards.errors.cardNotFound'));
    }

    return card;
  }
}

export const tierBoardService = new TierBoardService();

function getLocalizedTemplateLanes(
  lanes: readonly CreateLaneInput[],
): CreateLaneInput[] {
  return lanes.map((lane) => ({
    ...lane,
    title: getLocalizedTemplateText(lane.title),
  }));
}

function getLocalizedTemplateText(value: string) {
  return value.startsWith('tierBoards.templates.')
    ? appI18n.t(value as AppTranslationKey)
    : value;
}
