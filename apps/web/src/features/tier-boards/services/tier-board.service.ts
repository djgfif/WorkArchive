import type {
  SyncOperation,
  TierBoardAssetRecord,
  TierBoardItemRecord,
  TierBoardItemSourceType,
  TierBoardLaneRecord,
  TierBoardLayout,
  TierBoardRecord,
  TierBoardVisibility,
  WorkRecord,
  WorkSyncStatus,
} from '@work-archive/shared-types';

import {
  syncQueueRepository,
  type SyncQueueRepository,
} from '../../sync/services/sync-queue.repository';
import { worksRepository, type WorksRepository } from '../../works/services/works.repository';
import {
  tierBoardRepository,
  type StoredTierBoardAssetRecord,
  type TierBoardEditorState,
  type TierBoardRepository,
} from './tier-board.repository';

const DEFAULT_LANES = [
  { label: 'S', color: '#ef4444' },
  { label: 'A', color: '#f97316' },
  { label: 'B', color: '#22c55e' },
  { label: 'C', color: '#38bdf8' },
  { label: 'D', color: '#94a3b8' },
] as const;

export const TIER_BOARD_TEMPLATES = [
  {
    label: 'S/A/B/C/D',
    lanes: DEFAULT_LANES,
  },
  {
    label: 'SS/S/A/B/C/D/F',
    lanes: [
      { label: 'SS', color: '#f43f5e' },
      { label: 'S', color: '#ef4444' },
      { label: 'A', color: '#f97316' },
      { label: 'B', color: '#22c55e' },
      { label: 'C', color: '#38bdf8' },
      { label: 'D', color: '#94a3b8' },
      { label: 'F', color: '#64748b' },
    ],
  },
  {
    label: '최애/좋음/무난/아쉬움',
    lanes: [
      { label: '최애', color: '#ec4899' },
      { label: '좋음', color: '#22c55e' },
      { label: '무난', color: '#38bdf8' },
      { label: '아쉬움', color: '#94a3b8' },
    ],
  },
  {
    label: '최강/상위/중간/하위',
    lanes: [
      { label: '최강', color: '#a855f7' },
      { label: '상위', color: '#f97316' },
      { label: '중간', color: '#22c55e' },
      { label: '하위', color: '#64748b' },
    ],
  },
] as const;

interface CreateBoardInput {
  description?: string;
  title?: string;
}

interface UpdateBoardInput {
  description?: string;
  layout?: TierBoardLayout;
  title?: string;
  visibility?: TierBoardVisibility;
}

interface CreateLaneInput {
  color?: string;
  description?: string;
  label: string;
}

interface UpdateLaneInput {
  color?: string;
  description?: string;
  label?: string;
}

interface CreateItemInput {
  imageUrl?: string;
  laneId?: string | null;
  note?: string;
  sourceType?: TierBoardItemSourceType;
  subtitle?: string;
  title: string;
}

interface UpdateItemInput {
  imageUrl?: string;
  note?: string;
  subtitle?: string;
  title?: string;
}

interface ImportIdMaps {
  boardIds: Map<string, string>;
  laneIds: Map<string, string>;
  itemIds: Map<string, string>;
}

export interface TierBoardExportDocument {
  assets: TierBoardAssetRecord[];
  board: TierBoardRecord;
  exportedAt: string;
  format: 'work-archive.tier-board';
  items: TierBoardItemRecord[];
  lanes: TierBoardLaneRecord[];
  version: 1;
}

function nowIso() {
  return new Date().toISOString();
}

function getNextSyncStatus(serverVersion: number): WorkSyncStatus {
  return serverVersion > 0 ? 'pending' : 'local-only';
}

function getNextOrderIndex(records: Array<{ orderIndex: number }>) {
  return records.length === 0
    ? 0
    : Math.max(...records.map((record) => record.orderIndex)) + 1;
}

function cloneBoard(board: TierBoardRecord, now: string): TierBoardRecord {
  return {
    ...board,
    id: crypto.randomUUID(),
    title: `${board.title} 복사본`,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
  };
}

function createBoardRecord(input: CreateBoardInput, now: string): TierBoardRecord {
  return {
    id: crypto.randomUUID(),
    title: input.title?.trim() || '새 티어보드',
    description: input.description?.trim() ?? '',
    layout: 'classic',
    visibility: 'private',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
  };
}

function createLaneRecord(
  boardId: string,
  input: CreateLaneInput,
  orderIndex: number,
  now: string,
): TierBoardLaneRecord {
  return {
    id: crypto.randomUUID(),
    boardId,
    label: input.label.trim(),
    description: input.description?.trim() ?? '',
    color: input.color ?? '#64748b',
    orderIndex,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
  };
}

function createItemRecord(
  boardId: string,
  input: CreateItemInput,
  orderIndex: number,
  now: string,
): TierBoardItemRecord {
  return {
    id: crypto.randomUUID(),
    boardId,
    laneId: input.laneId ?? null,
    sourceType: input.sourceType ?? 'custom',
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() ?? '',
    imageUrl: input.imageUrl?.trim() ?? '',
    note: input.note?.trim() ?? '',
    linkedWorkId: null,
    linkedCatalogTitleId: null,
    orderIndex,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
  };
}

function createWorkSubtitle(work: WorkRecord) {
  return [
    work.type,
    work.author,
    work.rating === null ? null : `★ ${work.rating.toFixed(1)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function assertExportDocument(value: unknown): TierBoardExportDocument {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (value as { format?: unknown }).format !== 'work-archive.tier-board'
  ) {
    throw new Error('티어보드 JSON 형식이 아닙니다.');
  }

  return value as TierBoardExportDocument;
}

export class TierBoardService {
  constructor(
    private readonly repository: TierBoardRepository = tierBoardRepository,
    private readonly queueRepository: SyncQueueRepository = syncQueueRepository,
    private readonly worksRepo: WorksRepository = worksRepository,
  ) {}

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
    const lanes = DEFAULT_LANES.map((lane, index) =>
      createLaneRecord(board.id, lane, index, now),
    );
    const db = this.repository.getDbInstance();

    await db.transaction('rw', db.tierBoards, db.tierBoardLanes, async () => {
      await db.tierBoards.add(board);
      await db.tierBoardLanes.bulkAdd(lanes);
    });
    await this.enqueueBoard(board, 'create');
    await Promise.all(lanes.map((lane) => this.enqueueLane(lane, 'create')));

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
    await this.enqueueBoard(updated, 'update');

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
    const lanes = state.lanes.map<TierBoardLaneRecord>((lane) => ({
      ...lane,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(lane.serverVersion),
    }));
    const items = state.items.map<TierBoardItemRecord>((item) => ({
      ...item,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(item.serverVersion),
    }));
    const assets = state.assets.map<StoredTierBoardAssetRecord>((asset) => ({
      ...asset,
      deletedAt: now,
      updatedAt: now,
    }));
    const db = this.repository.getDbInstance();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierBoardLanes,
      db.tierBoardItems,
      db.tierBoardAssets,
      async () => {
        await db.tierBoards.put(board);
        await db.tierBoardLanes.bulkPut(lanes);
        await db.tierBoardItems.bulkPut(items);
        await db.tierBoardAssets.bulkPut(assets);
      },
    );
    await this.enqueueBoard(board, 'delete');
    await Promise.all([
      ...lanes.map((lane) => this.enqueueLane(lane, 'delete')),
      ...items.map((item) => this.enqueueItem(item, 'delete')),
      ...assets.map((asset) => this.enqueueAsset(asset, 'delete')),
    ]);

    return state;
  }

  async restoreBoardSnapshot(state: TierBoardEditorState) {
    const db = this.repository.getDbInstance();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierBoardLanes,
      db.tierBoardItems,
      db.tierBoardAssets,
      async () => {
        await db.tierBoards.put({
          ...state.board,
          deletedAt: null,
          updatedAt: nowIso(),
        });
        await db.tierBoardLanes.bulkPut(
          state.lanes.map((lane) => ({ ...lane, deletedAt: null })),
        );
        await db.tierBoardItems.bulkPut(
          state.items.map((item) => ({ ...item, deletedAt: null })),
        );
        await db.tierBoardAssets.bulkPut(
          state.assets.map((asset) => ({ ...asset, deletedAt: null })),
        );
      },
    );
  }

  async duplicateBoard(id: string) {
    const state = await this.requireEditorState(id);
    const now = nowIso();
    const board = cloneBoard(state.board, now);
    const laneIdMap = new Map<string, string>();
    const itemIdMap = new Map<string, string>();
    const lanes = state.lanes.map<TierBoardLaneRecord>((lane) => {
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
    const items = state.items.map<TierBoardItemRecord>((item) => {
      const nextId = crypto.randomUUID();
      itemIdMap.set(item.id, nextId);

      return {
        ...item,
        id: nextId,
        boardId: board.id,
        laneId: item.laneId ? (laneIdMap.get(item.laneId) ?? null) : null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'local-only',
        serverVersion: 0,
      };
    });
    const assets = state.assets.map<StoredTierBoardAssetRecord>((asset) => {
      const id = crypto.randomUUID();

      return {
        ...asset,
        id,
        boardId: board.id,
        itemId: asset.itemId ? (itemIdMap.get(asset.itemId) ?? null) : null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        objectUrl:
          asset.storageType === 'local_blob'
            ? `indexeddb://tier-board-assets/${id}`
            : asset.objectUrl,
      };
    });
    const db = this.repository.getDbInstance();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierBoardLanes,
      db.tierBoardItems,
      db.tierBoardAssets,
      async () => {
        await db.tierBoards.add(board);
        await db.tierBoardLanes.bulkAdd(lanes);
        await db.tierBoardItems.bulkAdd(items);
        await db.tierBoardAssets.bulkAdd(assets);
      },
    );
    await this.enqueueBoard(board, 'create');
    await Promise.all([
      ...lanes.map((lane) => this.enqueueLane(lane, 'create')),
      ...items.map((item) => this.enqueueItem(item, 'create')),
      ...assets.map((asset) => this.enqueueAsset(asset, 'create')),
    ]);

    return board;
  }

  async createLane(boardId: string, input: CreateLaneInput) {
    const state = await this.requireEditorState(boardId);
    const lane = createLaneRecord(
      boardId,
      input,
      getNextOrderIndex(state.lanes),
      nowIso(),
    );

    await this.repository.putLane(lane);
    await this.touchBoard(boardId);
    await this.enqueueLane(lane, 'create');

    return lane;
  }

  async updateLane(id: string, input: UpdateLaneInput) {
    const lane = await this.requireLane(id);
    const updated: TierBoardLaneRecord = {
      ...lane,
      ...input,
      label: input.label?.trim() || lane.label,
      description: input.description ?? lane.description,
      updatedAt: nowIso(),
      syncStatus: getNextSyncStatus(lane.serverVersion),
    };

    await this.repository.putLane(updated);
    await this.touchBoard(updated.boardId);
    await this.enqueueLane(updated, 'update');

    return updated;
  }

  async reorderLane(boardId: string, laneIds: string[]) {
    const state = await this.requireEditorState(boardId);
    const lanesById = new Map(state.lanes.map((lane) => [lane.id, lane]));
    const now = nowIso();
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

    await this.repository.bulkPutLanes(lanes);
    await this.touchBoard(boardId);
    await Promise.all(lanes.map((lane) => this.enqueueLane(lane, 'update')));

    return lanes;
  }

  async deleteLane(id: string) {
    const lane = await this.requireLane(id);
    const state = await this.requireEditorState(lane.boardId);
    const now = nowIso();
    const deletedLane: TierBoardLaneRecord = {
      ...lane,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(lane.serverVersion),
    };
    const movedItems = state.items
      .filter((item) => item.laneId === id)
      .map<TierBoardItemRecord>((item, index) => ({
        ...item,
        laneId: null,
        orderIndex: getNextOrderIndex(
          state.items.filter((candidate) => candidate.laneId === null),
        ) + index,
        updatedAt: now,
        syncStatus: getNextSyncStatus(item.serverVersion),
      }));
    const db = this.repository.getDbInstance();

    await db.transaction('rw', db.tierBoardLanes, db.tierBoardItems, async () => {
      await db.tierBoardLanes.put(deletedLane);
      await db.tierBoardItems.bulkPut(movedItems);
    });
    await this.touchBoard(lane.boardId);
    await this.enqueueLane(deletedLane, 'delete');
    await Promise.all(movedItems.map((item) => this.enqueueItem(item, 'update')));

    return { items: movedItems, lane };
  }

  async createItem(boardId: string, input: CreateItemInput) {
    const state = await this.requireEditorState(boardId);
    const item = createItemRecord(
      boardId,
      input,
      getNextOrderIndex(
        state.items.filter((record) => (record.laneId ?? null) === (input.laneId ?? null)),
      ),
      nowIso(),
    );

    await this.repository.putItem(item);
    await this.touchBoard(boardId);
    await this.enqueueItem(item, 'create');

    return item;
  }

  async updateItem(id: string, input: UpdateItemInput) {
    const item = await this.requireItem(id);
    const updated: TierBoardItemRecord = {
      ...item,
      ...input,
      title: input.title?.trim() || item.title,
      subtitle: input.subtitle ?? item.subtitle,
      note: input.note ?? item.note,
      imageUrl: input.imageUrl ?? item.imageUrl,
      updatedAt: nowIso(),
      syncStatus: getNextSyncStatus(item.serverVersion),
    };

    await this.repository.putItem(updated);
    await this.touchBoard(item.boardId);
    await this.enqueueItem(updated, 'update');

    return updated;
  }

  async deleteItem(id: string) {
    const item = await this.requireItem(id);
    const deleted: TierBoardItemRecord = {
      ...item,
      deletedAt: nowIso(),
      syncStatus: getNextSyncStatus(item.serverVersion),
      updatedAt: nowIso(),
    };

    await this.repository.putItem(deleted);
    await this.touchBoard(item.boardId);
    await this.enqueueItem(deleted, 'delete');

    return item;
  }

  async restoreItemSnapshot(item: TierBoardItemRecord) {
    const restored: TierBoardItemRecord = {
      ...item,
      deletedAt: null,
      updatedAt: nowIso(),
      syncStatus: getNextSyncStatus(item.serverVersion),
    };

    await this.repository.putItem(restored);
    await this.enqueueItem(restored, item.serverVersion === 0 ? 'create' : 'update');

    return restored;
  }

  moveItemToLane(id: string, laneId: string) {
    return this.moveItem(id, laneId);
  }

  removeItemFromLane(id: string) {
    return this.moveItem(id, null);
  }

  async reorderItem(boardId: string, laneId: string | null, itemIds: string[]) {
    const state = await this.requireEditorState(boardId);
    const itemsById = new Map(state.items.map((item) => [item.id, item]));
    const now = nowIso();
    const items = itemIds.flatMap((id, index) => {
      const item = itemsById.get(id);

      return item
        ? [
            {
              ...item,
              laneId,
              orderIndex: index,
              updatedAt: now,
              syncStatus: getNextSyncStatus(item.serverVersion),
            },
          ]
        : [];
    });

    await this.repository.bulkPutItems(items);
    await this.touchBoard(boardId);
    await Promise.all(items.map((item) => this.enqueueItem(item, 'update')));

    return items;
  }

  async createItemFromWorkSnapshot(boardId: string, workId: string, laneId: string | null = null) {
    const work = await this.worksRepo.getById(workId);

    if (!work || work.deletedAt !== null) {
      throw new Error('가져올 작품을 찾을 수 없습니다.');
    }

    const state = await this.requireEditorState(boardId);
    const now = nowIso();
    const item: TierBoardItemRecord = {
      ...createItemRecord(
        boardId,
        {
          imageUrl: work.thumbnailUrl,
          laneId,
          note: work.shortReview,
          sourceType: 'work_ref',
          subtitle: createWorkSubtitle(work),
          title: work.title,
        },
        getNextOrderIndex(state.items.filter((record) => record.laneId === laneId)),
        now,
      ),
      linkedWorkId: work.id,
      linkedCatalogTitleId: work.catalogTitleId ?? null,
    };

    await this.repository.putItem(item);
    await this.touchBoard(boardId);
    await this.enqueueItem(item, 'create');

    return item;
  }

  createItemFromImageUrl(
    boardId: string,
    input: Omit<CreateItemInput, 'sourceType'>,
  ) {
    return this.createItem(boardId, {
      ...input,
      sourceType: 'url',
    });
  }

  async createItemFromUploadedImage(
    boardId: string,
    file: File,
    input: Omit<CreateItemInput, 'imageUrl' | 'sourceType'>,
  ) {
    const item = await this.createItem(boardId, {
      ...input,
      imageUrl: '',
      sourceType: 'image',
    });
    const assetId = crypto.randomUUID();
    const objectUrl = `indexeddb://tier-board-assets/${assetId}`;
    const asset: StoredTierBoardAssetRecord = {
      id: assetId,
      boardId,
      itemId: item.id,
      kind: 'image',
      storageType: 'local_blob',
      objectUrl,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
      blob: new Blob([await file.arrayBuffer()], { type: file.type }),
    };
    const updatedItem = await this.updateItem(item.id, { imageUrl: objectUrl });

    await this.repository.putAsset(asset);
    await this.enqueueAsset(asset, 'create');

    return { asset, item: updatedItem };
  }

  async exportBoardJson(boardId: string): Promise<TierBoardExportDocument> {
    const state = await this.requireEditorState(boardId);

    return {
      format: 'work-archive.tier-board',
      version: 1,
      exportedAt: nowIso(),
      board: state.board,
      lanes: state.lanes,
      items: state.items,
      assets: state.assets.map(({ blob: _blob, ...asset }) => asset),
    };
  }

  async importBoardJson(rawValue: string) {
    const parsed = assertExportDocument(JSON.parse(rawValue));
    const now = nowIso();
    const maps: ImportIdMaps = {
      boardIds: new Map([[parsed.board.id, crypto.randomUUID()]]),
      laneIds: new Map(),
      itemIds: new Map(),
    };
    const board: TierBoardRecord = {
      ...parsed.board,
      id: maps.boardIds.get(parsed.board.id)!,
      title: parsed.board.title || '가져온 티어보드',
      visibility: 'private',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    };
    const lanes = parsed.lanes.map<TierBoardLaneRecord>((lane) => {
      const id = crypto.randomUUID();
      maps.laneIds.set(lane.id, id);

      return {
        ...lane,
        id,
        boardId: board.id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'local-only',
        serverVersion: 0,
      };
    });
    const items = parsed.items.map<TierBoardItemRecord>((item) => {
      const id = crypto.randomUUID();
      maps.itemIds.set(item.id, id);

      return {
        ...item,
        id,
        boardId: board.id,
        laneId: item.laneId ? (maps.laneIds.get(item.laneId) ?? null) : null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'local-only',
        serverVersion: 0,
      };
    });
    const assets = parsed.assets.map<StoredTierBoardAssetRecord>((asset) => ({
      ...asset,
      id: crypto.randomUUID(),
      boardId: board.id,
      itemId: asset.itemId ? (maps.itemIds.get(asset.itemId) ?? null) : null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }));
    const db = this.repository.getDbInstance();

    await db.transaction(
      'rw',
      db.tierBoards,
      db.tierBoardLanes,
      db.tierBoardItems,
      db.tierBoardAssets,
      async () => {
        await db.tierBoards.add(board);
        await db.tierBoardLanes.bulkAdd(lanes);
        await db.tierBoardItems.bulkAdd(items);
        await db.tierBoardAssets.bulkAdd(assets);
      },
    );
    await this.enqueueBoard(board, 'create', 'tier_board_import');
    await Promise.all([
      ...lanes.map((lane) =>
        this.enqueueLane(lane, 'create', 'tier_board_import'),
      ),
      ...items.map((item) =>
        this.enqueueItem(item, 'create', 'tier_board_import'),
      ),
      ...assets.map((asset) =>
        this.enqueueAsset(asset, 'create', 'tier_board_import'),
      ),
    ]);

    return board;
  }

  async applyLaneTemplate(boardId: string, templateLabel: string) {
    const template =
      TIER_BOARD_TEMPLATES.find((candidate) => candidate.label === templateLabel) ??
      TIER_BOARD_TEMPLATES[0]!;
    const state = await this.requireEditorState(boardId);
    const now = nowIso();
    const deletedLanes = state.lanes.map<TierBoardLaneRecord>((lane) => ({
      ...lane,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(lane.serverVersion),
    }));
    const lanes = template.lanes.map((lane, index) =>
      createLaneRecord(boardId, lane, index, now),
    );
    const items = state.items.map<TierBoardItemRecord>((item) => ({
      ...item,
      laneId: null,
      updatedAt: now,
      syncStatus: getNextSyncStatus(item.serverVersion),
    }));
    const db = this.repository.getDbInstance();

    await db.transaction('rw', db.tierBoardLanes, db.tierBoardItems, async () => {
      await db.tierBoardLanes.bulkPut([...deletedLanes, ...lanes]);
      await db.tierBoardItems.bulkPut(items);
    });
    await this.touchBoard(boardId);
    await Promise.all([
      ...deletedLanes.map((lane) => this.enqueueLane(lane, 'delete')),
      ...lanes.map((lane) => this.enqueueLane(lane, 'create')),
      ...items.map((item) => this.enqueueItem(item, 'update')),
    ]);

    return lanes;
  }

  private async moveItem(id: string, laneId: string | null) {
    const item = await this.requireItem(id);
    const state = await this.requireEditorState(item.boardId);
    const moved: TierBoardItemRecord = {
      ...item,
      laneId,
      orderIndex: getNextOrderIndex(
        state.items.filter((record) => record.laneId === laneId && record.id !== id),
      ),
      updatedAt: nowIso(),
      syncStatus: getNextSyncStatus(item.serverVersion),
    };

    await this.repository.putItem(moved);
    await this.touchBoard(item.boardId);
    await this.enqueueItem(moved, 'update');

    return moved;
  }

  private async touchBoard(id: string) {
    const board = await this.requireBoard(id);
    const updated: TierBoardRecord = {
      ...board,
      updatedAt: nowIso(),
      syncStatus: getNextSyncStatus(board.serverVersion),
    };

    await this.repository.putBoard(updated);
    await this.enqueueBoard(updated, 'update');

    return updated;
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

  private async requireItem(id: string) {
    const item = await this.repository.getItemById(id);

    if (!item) {
      throw new Error('티어보드 항목을 찾을 수 없습니다.');
    }

    return item;
  }

  private enqueueBoard(
    board: TierBoardRecord,
    operation: SyncOperation,
    source: 'tier_board_update' | 'tier_board_import' = 'tier_board_update',
  ) {
    return this.queueRepository.enqueueEntityChange(
      'tier_board',
      board,
      operation,
      { ...board },
      source,
    );
  }

  private enqueueLane(
    lane: TierBoardLaneRecord,
    operation: SyncOperation,
    source: 'tier_board_update' | 'tier_board_import' = 'tier_board_update',
  ) {
    return this.queueRepository.enqueueEntityChange(
      'tier_board_lane',
      lane,
      operation,
      { ...lane },
      source,
    );
  }

  private enqueueItem(
    item: TierBoardItemRecord,
    operation: SyncOperation,
    source: 'tier_board_update' | 'tier_board_import' = 'tier_board_update',
  ) {
    return this.queueRepository.enqueueEntityChange(
      'tier_board_item',
      item,
      operation,
      { ...item },
      source,
    );
  }

  private enqueueAsset(
    asset: StoredTierBoardAssetRecord,
    operation: SyncOperation,
    source:
      | 'tier_board_asset_update'
      | 'tier_board_import' = 'tier_board_asset_update',
  ) {
    const { blob: _blob, ...payload } = asset;

    return this.queueRepository.enqueueEntityChange(
      'tier_board_asset',
      payload,
      operation,
      payload,
      source,
    );
  }
}

export const tierBoardService = new TierBoardService();
