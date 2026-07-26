import {
  closestCorners,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core';

import type { TierBoardCardRecord } from '@work-archive/shared-types';
import { downloadTextFile, downloadUrl } from '@shared/utils/download-file';
import type { TierBoardEditorState } from '../services/tier-board.repository';

export const POOL_ID = 'pool';
export const LANE_COLORS = [
  '#ef4444',
  '#f97316',
  '#facc15',
  '#22c55e',
  '#38bdf8',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#64748b',
];

export function downloadText(filename: string, text: string) {
  downloadTextFile(filename, 'application/json', text);
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  downloadUrl(filename, dataUrl);
}

export function getLaneContainerId(laneId: string) {
  return `lane-drop:${laneId}`;
}

export function getPoolContainerId() {
  return 'pool-drop';
}

export function getLaneSortableId(laneId: string) {
  return `lane:${laneId}`;
}

export function getCardSortableId(cardId: string) {
  return `card:${cardId}`;
}

export function parseLaneSortableId(id: string) {
  return id.startsWith('lane:') ? id.slice(5) : null;
}

export function parseCardSortableId(id: string) {
  return id.startsWith('card:') ? id.slice(5) : null;
}

export function parseDropLaneId(id: string) {
  if (id === POOL_ID || id === getPoolContainerId()) return null;
  if (id.startsWith('lane-drop:')) return id.slice(10);
  if (id.startsWith('lane:')) return id.slice(5);

  return undefined;
}

function isCardDropTargetId(id: string) {
  return (
    id === getPoolContainerId() ||
    id.startsWith('lane-drop:') ||
    id.startsWith('card:')
  );
}

function isLaneDragId(id: string | null) {
  return id?.startsWith('lane:') ?? false;
}

export const tierBoardCollisionDetection: CollisionDetection = (args) => {
  const activeId = String(args.active.id);

  if (isLaneDragId(activeId)) {
    return closestCorners(args);
  }

  const pointerCollisions = pointerWithin(args);
  const pointerCardTargets = pointerCollisions.filter((collision) =>
    isCardDropTargetId(String(collision.id)),
  );

  if (pointerCardTargets.length > 0) {
    return pointerCardTargets;
  }

  const intersectingTargets = rectIntersection(args).filter((collision) =>
    isCardDropTargetId(String(collision.id)),
  );

  if (intersectingTargets.length > 0) {
    return intersectingTargets;
  }

  return closestCorners(args);
};

export function getCardsForLane(
  cards: TierBoardCardRecord[],
  laneId: string | null,
) {
  return cards
    .filter((card) => card.laneId === laneId)
    .sort((left, right) => left.orderIndex - right.orderIndex);
}

export function applyLaneOrderPreview(
  state: TierBoardEditorState,
  laneIds: string[],
): TierBoardEditorState {
  const orderById = new Map(laneIds.map((id, index) => [id, index]));

  return {
    ...state,
    lanes: state.lanes
      .map((lane) => ({
        ...lane,
        orderIndex: orderById.get(lane.id) ?? lane.orderIndex,
      }))
      .sort((left, right) => left.orderIndex - right.orderIndex),
  };
}

export function applyCardOrderPreview(
  state: TierBoardEditorState,
  cardId: string,
  laneId: string | null,
  cardIds: string[],
): TierBoardEditorState {
  const orderById = new Map(cardIds.map((id, index) => [id, index]));
  const fallbackOrder = cardIds.length;

  return {
    ...state,
    cards: state.cards.map((card) => {
      if (card.id === cardId || orderById.has(card.id)) {
        return {
          ...card,
          laneId,
          orderIndex: orderById.get(card.id) ?? fallbackOrder,
        };
      }

      return card;
    }),
  };
}

export function applyCardMovePreview(
  state: TierBoardEditorState,
  cardId: string,
  laneId: string | null,
): TierBoardEditorState {
  const nextOrderIndex = getCardsForLane(state.cards, laneId).filter(
    (card) => card.id !== cardId,
  ).length;

  return {
    ...state,
    cards: state.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            laneId,
            orderIndex: nextOrderIndex,
          }
        : card,
    ),
  };
}
