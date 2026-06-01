import type {
  TierBoardCardRecord,
  TierBoardRecord,
  TierLaneRecord,
} from '@work-archive/shared-types';

import { createLocalTierBoardAssetUrl } from './tier-board-assets';
import type {
  StoredTierBoardAssetRecord,
  TierBoardEditorState,
} from './tier-board.repository';
import {
  cloneBoard,
  createLaneRecord,
  getNextOrderIndex,
  getNextSyncStatus,
  getRestoredSyncStatus,
  touchTierBoard,
} from './tier-board-records';
import type { CreateLaneInput, TierLaneDeleteSnapshot } from './tier-board.types';

export interface TierBoardRecordSet {
  assets: StoredTierBoardAssetRecord[];
  board: TierBoardRecord;
  cards: TierBoardCardRecord[];
  lanes: TierLaneRecord[];
}

export interface TierBoardTemplateApplication {
  cards: TierBoardCardRecord[];
  deletedLanes: TierLaneRecord[];
  lanes: TierLaneRecord[];
  touchedBoard: TierBoardRecord;
}

export interface TouchedCardRecordSet {
  card: TierBoardCardRecord;
  touchedBoard: TierBoardRecord;
}

export interface TouchedCardsRecordSet {
  cards: TierBoardCardRecord[];
  touchedBoard: TierBoardRecord;
}

export interface TierLaneDeleteRecordSet {
  deletedLane: TierLaneRecord;
  movedCards: TierBoardCardRecord[];
  snapshot: TierLaneDeleteSnapshot;
  touchedBoard: TierBoardRecord;
}

export interface TierLaneRestoreRecordSet {
  cards: TierBoardCardRecord[];
  lane: TierLaneRecord;
  touchedBoard: TierBoardRecord;
}

export function buildDeletedBoardRecordSet(
  state: TierBoardEditorState,
  now: string,
): TierBoardRecordSet {
  return {
    assets: state.assets.map<StoredTierBoardAssetRecord>((asset) => ({
      ...asset,
      deletedAt: now,
      updatedAt: now,
    })),
    board: {
      ...state.board,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    },
    cards: state.cards.map<TierBoardCardRecord>((card) => ({
      ...card,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(card.serverVersion),
    })),
    lanes: state.lanes.map<TierLaneRecord>((lane) => ({
      ...lane,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(lane.serverVersion),
    })),
  };
}

export function buildRestoredBoardRecordSet(
  state: TierBoardEditorState,
  now: string,
): TierBoardRecordSet {
  return {
    assets: state.assets.map<StoredTierBoardAssetRecord>((asset) => ({
      ...asset,
      deletedAt: null,
      updatedAt: now,
    })),
    board: {
      ...state.board,
      deletedAt: null,
      updatedAt: now,
      syncStatus: getRestoredSyncStatus(state.board),
    },
    cards: state.cards.map<TierBoardCardRecord>((card) => ({
      ...card,
      deletedAt: null,
      updatedAt: now,
      syncStatus: getRestoredSyncStatus(card),
    })),
    lanes: state.lanes.map<TierLaneRecord>((lane) => ({
      ...lane,
      deletedAt: null,
      updatedAt: now,
      syncStatus: getRestoredSyncStatus(lane),
    })),
  };
}

export function buildDuplicatedBoardRecordSet(
  state: TierBoardEditorState,
  now: string,
): TierBoardRecordSet {
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

  return {
    assets,
    board,
    cards: cards.map<TierBoardCardRecord>((card) => ({
      ...card,
      imageUrl: assetObjectUrlMap.get(card.imageUrl) ?? card.imageUrl,
    })),
    lanes,
  };
}

export function buildTierBoardTemplateApplication(input: {
  boardId: string;
  now: string;
  state: TierBoardEditorState;
  templateLanes: readonly CreateLaneInput[];
}): TierBoardTemplateApplication {
  const { boardId, now, state, templateLanes } = input;

  return {
    cards: state.cards.map<TierBoardCardRecord>((card) => ({
      ...card,
      laneId: null,
      updatedAt: now,
      syncStatus: getNextSyncStatus(card.serverVersion),
    })),
    deletedLanes: state.lanes.map<TierLaneRecord>((lane) => ({
      ...lane,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(lane.serverVersion),
    })),
    lanes: templateLanes.map((lane, index) =>
      createLaneRecord(boardId, lane, index, now),
    ),
    touchedBoard: touchTierBoard(state.board, now),
  };
}

export function buildLaneDeleteRecordSet(input: {
  lane: TierLaneRecord;
  now: string;
  state: TierBoardEditorState;
}): TierLaneDeleteRecordSet {
  const { lane, now, state } = input;
  const laneCards = state.cards.filter((card) => card.laneId === lane.id);
  const poolOrderStart = getNextOrderIndex(
    state.cards.filter((candidate) => candidate.laneId === null),
  );

  return {
    deletedLane: {
      ...lane,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(lane.serverVersion),
    },
    movedCards: laneCards.map<TierBoardCardRecord>((card, index) => ({
      ...card,
      laneId: null,
      orderIndex: poolOrderStart + index,
      updatedAt: now,
      syncStatus: getNextSyncStatus(card.serverVersion),
    })),
    snapshot: {
      cards: laneCards,
      lane,
    },
    touchedBoard: touchTierBoard(state.board, now),
  };
}

export function buildLaneRestoreRecordSet(input: {
  now: string;
  snapshot: TierLaneDeleteSnapshot;
  state: TierBoardEditorState;
}): TierLaneRestoreRecordSet {
  const { now, snapshot, state } = input;

  return {
    cards: snapshot.cards.map<TierBoardCardRecord>((card) => ({
      ...card,
      deletedAt: null,
      updatedAt: now,
      syncStatus: getRestoredSyncStatus(card),
    })),
    lane: {
      ...snapshot.lane,
      deletedAt: null,
      updatedAt: now,
      syncStatus: getRestoredSyncStatus(snapshot.lane),
    },
    touchedBoard: touchTierBoard(state.board, now),
  };
}

export function buildDuplicatedCardRecordSet(input: {
  now: string;
  source: TierBoardCardRecord;
  state: TierBoardEditorState;
}): TouchedCardRecordSet {
  const { now, source, state } = input;

  return {
    card: {
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
    },
    touchedBoard: touchTierBoard(state.board, now),
  };
}

export function buildRestoredCardRecordSet(input: {
  card: TierBoardCardRecord;
  now: string;
  state: TierBoardEditorState;
}): TouchedCardRecordSet {
  const { card, now, state } = input;

  return {
    card: {
      ...card,
      deletedAt: null,
      updatedAt: now,
      syncStatus: getRestoredSyncStatus(card),
    },
    touchedBoard: touchTierBoard(state.board, now),
  };
}

export function buildMovedCardRecordSet(input: {
  card: TierBoardCardRecord;
  laneId: string | null;
  now: string;
  state: TierBoardEditorState;
}): TouchedCardRecordSet {
  const { card, laneId, now, state } = input;

  return {
    card: {
      ...card,
      laneId,
      orderIndex: getNextOrderIndex(
        state.cards.filter(
          (record) => record.laneId === laneId && record.id !== card.id,
        ),
      ),
      updatedAt: now,
      syncStatus: getNextSyncStatus(card.serverVersion),
    },
    touchedBoard: touchTierBoard(state.board, now),
  };
}

export function buildReorderedCardsRecordSet(input: {
  cardIds: string[];
  laneId: string | null;
  now: string;
  state: TierBoardEditorState;
}): TouchedCardsRecordSet {
  const { cardIds, laneId, now, state } = input;
  const cardsById = new Map(state.cards.map((card) => [card.id, card]));

  return {
    cards: cardIds.flatMap((id, index) => {
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
    }),
    touchedBoard: touchTierBoard(state.board, now),
  };
}
