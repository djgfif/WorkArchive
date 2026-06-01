import { describe, expect, it } from 'vitest';

import type {
  TierBoardCardRecord,
  TierLaneRecord,
  TierBoardRecord,
} from '@work-archive/shared-types';
import type { TierBoardEditorState } from '../services/tier-board.repository';
import {
  applyCardMovePreview,
  applyCardOrderPreview,
  applyLaneOrderPreview,
  getCardsForLane,
  getCardSortableId,
  getLaneContainerId,
  getLaneSortableId,
  getPoolContainerId,
  parseCardSortableId,
  parseDropLaneId,
  parseLaneSortableId,
} from './tier-board-editor-helpers';

const now = '2026-05-21T00:00:00.000Z';

function buildBoard(): TierBoardRecord {
  return {
    id: 'board-1',
    title: '편집기 헬퍼 테스트',
    description: '',
    slug: 'editor-helper-test',
    boardType: 'classic_tier',
    visibility: 'private',
    coverImageUrl: '',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'synced',
    serverVersion: 1,
  };
}

function buildLane(id: string, orderIndex: number): TierLaneRecord {
  return {
    id,
    boardId: 'board-1',
    title: id,
    description: '',
    colorToken: '#64748b',
    orderIndex,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'synced',
    serverVersion: 1,
  };
}

function buildCard(
  id: string,
  laneId: string | null,
  orderIndex: number,
): TierBoardCardRecord {
  return {
    id,
    boardId: 'board-1',
    laneId,
    orderIndex,
    cardSourceType: 'custom',
    workId: null,
    title: id,
    subtitle: '',
    imageUrl: '',
    note: '',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'synced',
    serverVersion: 1,
  };
}

function buildState(): TierBoardEditorState {
  return {
    assets: [],
    board: buildBoard(),
    cards: [
      buildCard('card-late', 'lane-a', 2),
      buildCard('card-first', 'lane-a', 0),
      buildCard('card-pool', null, 0),
    ],
    lanes: [buildLane('lane-a', 0), buildLane('lane-b', 1)],
  };
}

describe('tier-board-editor-helpers', () => {
  it('parses sortable and drop ids without conflating pool and invalid targets', () => {
    expect(getLaneSortableId('lane-a')).toBe('lane:lane-a');
    expect(getCardSortableId('card-a')).toBe('card:card-a');
    expect(parseLaneSortableId('lane:lane-a')).toBe('lane-a');
    expect(parseCardSortableId('card:card-a')).toBe('card-a');
    expect(parseDropLaneId(getLaneContainerId('lane-a'))).toBe('lane-a');
    expect(parseDropLaneId(getPoolContainerId())).toBeNull();
    expect(parseDropLaneId('unknown-target')).toBeUndefined();
  });

  it('sorts lane cards by their persisted order index', () => {
    expect(
      getCardsForLane(buildState().cards, 'lane-a').map((card) => card.id),
    ).toEqual(['card-first', 'card-late']);
  });

  it('previews lane and card ordering without mutating unrelated records', () => {
    const state = buildState();
    const lanePreview = applyLaneOrderPreview(state, ['lane-b', 'lane-a']);
    const cardPreview = applyCardOrderPreview(state, 'card-pool', 'lane-a', [
      'card-pool',
      'card-first',
      'card-late',
    ]);

    expect(
      lanePreview.lanes.map((lane) => `${lane.id}:${lane.orderIndex}`),
    ).toEqual(['lane-b:0', 'lane-a:1']);
    expect(cardPreview.cards.find((card) => card.id === 'card-pool')).toEqual(
      expect.objectContaining({ laneId: 'lane-a', orderIndex: 0 }),
    );
    expect(state.cards.find((card) => card.id === 'card-pool')).toEqual(
      expect.objectContaining({ laneId: null, orderIndex: 0 }),
    );
  });

  it('previews card moves at the end of the target lane', () => {
    const preview = applyCardMovePreview(buildState(), 'card-pool', 'lane-a');

    expect(preview.cards.find((card) => card.id === 'card-pool')).toEqual(
      expect.objectContaining({ laneId: 'lane-a', orderIndex: 2 }),
    );
  });
});
