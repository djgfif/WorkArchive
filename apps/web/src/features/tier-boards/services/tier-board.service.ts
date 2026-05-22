import type {
  SyncOperation,
  TierBoardAssetRecord,
  TierBoardCardRecord,
  TierBoardCardSourceType,
  TierLaneRecord,
  TierBoardType,
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
  { title: 'S', colorToken: '#ef4444' },
  { title: 'A', colorToken: '#f97316' },
  { title: 'B', colorToken: '#22c55e' },
  { title: 'C', colorToken: '#38bdf8' },
  { title: 'D', colorToken: '#94a3b8' },
] as const;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const SUPPORTED_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const localAssetDataUrlCache = new Map<string, string>();

type TierBoardExportAsset = TierBoardAssetRecord & {
  dataUrl?: string;
};

export const TIER_BOARD_TEMPLATES = [
  {
    title: 'S/A/B/C/D',
    lanes: DEFAULT_LANES,
  },
  {
    title: 'SS/S/A/B/C/D/F',
    lanes: [
      { title: 'SS', colorToken: '#f43f5e' },
      { title: 'S', colorToken: '#ef4444' },
      { title: 'A', colorToken: '#f97316' },
      { title: 'B', colorToken: '#22c55e' },
      { title: 'C', colorToken: '#38bdf8' },
      { title: 'D', colorToken: '#94a3b8' },
      { title: 'F', colorToken: '#64748b' },
    ],
  },
  {
    title: '최애/좋음/무난/아쉬움',
    lanes: [
      { title: '최애', colorToken: '#ec4899' },
      { title: '좋음', colorToken: '#22c55e' },
      { title: '무난', colorToken: '#38bdf8' },
      { title: '아쉬움', colorToken: '#94a3b8' },
    ],
  },
  {
    title: '최강/상위/중위/하위',
    lanes: [
      { title: '최강', colorToken: '#a855f7' },
      { title: '상위', colorToken: '#f97316' },
      { title: '중위', colorToken: '#22c55e' },
      { title: '하위', colorToken: '#64748b' },
    ],
  },
  {
    title: '빈 보드',
    lanes: [],
  },
] as const;

interface CreateBoardInput {
  boardType?: TierBoardType;
  description?: string;
  templateTitle?: string;
  title?: string;
}

interface UpdateBoardInput {
  boardType?: TierBoardType;
  coverImageUrl?: string;
  description?: string;
  title?: string;
  visibility?: TierBoardVisibility;
}

interface CreateLaneInput {
  colorToken?: string;
  description?: string;
  title: string;
}

interface UpdateLaneInput {
  colorToken?: string;
  description?: string;
  title?: string;
}

interface CreateCardInput {
  imageUrl?: string;
  laneId?: string | null;
  note?: string;
  cardSourceType?: TierBoardCardSourceType;
  subtitle?: string;
  title: string;
}

interface UpdateCardInput {
  imageUrl?: string;
  note?: string;
  subtitle?: string;
  title?: string;
}

interface ImportIdMaps {
  boardIds: Map<string, string>;
  laneIds: Map<string, string>;
  cardIds: Map<string, string>;
}

export interface TierBoardExportDocument {
  assets: TierBoardExportAsset[];
  board: TierBoardRecord;
  exportedAt: string;
  format: 'work-archive.tier-board';
  cards: TierBoardCardRecord[];
  lanes: TierLaneRecord[];
  version: 1;
}

export interface TierLaneDeleteSnapshot {
  cards: TierBoardCardRecord[];
  lane: TierLaneRecord;
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
    slug: createSlug(`${board.title} 복사본`),
    title: `${board.title} 복사본`,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
  };
}

function createSlug(title: string) {
  const normalized = title
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${normalized || 'tier-board'}-${crypto.randomUUID().slice(0, 8)}`;
}

function createBoardRecord(input: CreateBoardInput, now: string): TierBoardRecord {
  const title = input.title?.trim() || '새 티어보드';

  return {
    id: crypto.randomUUID(),
    title,
    description: input.description?.trim() ?? '',
    slug: createSlug(title),
    boardType: input.boardType ?? 'classic_tier',
    visibility: 'private',
    coverImageUrl: '',
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
): TierLaneRecord {
  return {
    id: crypto.randomUUID(),
    boardId,
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    colorToken: input.colorToken ?? '#64748b',
    orderIndex,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
  };
}

function createCardRecord(
  boardId: string,
  input: CreateCardInput,
  orderIndex: number,
  now: string,
): TierBoardCardRecord {
  return {
    id: crypto.randomUUID(),
    boardId,
    laneId: input.laneId ?? null,
    cardSourceType: input.cardSourceType ?? 'custom',
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() ?? '',
    imageUrl: input.imageUrl?.trim() ?? '',
    note: input.note?.trim() ?? '',
    workId: null,
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

function prepareCardForExport(card: TierBoardCardRecord): TierBoardCardRecord {
  return {
    ...card,
    workId: null,
  };
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

function blobToDataUrl(blob: Blob) {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer);
      const base64 = bytesToBase64(bytes);

      return `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
    });
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error('이미지 데이터를 읽지 못했습니다.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('이미지 데이터를 읽지 못했습니다.'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

function bytesToBase64(bytes: Uint8Array) {
  const bufferCtor = (globalThis as typeof globalThis & {
    Buffer?: { from(input: Uint8Array): { toString(encoding: 'base64'): string } };
  }).Buffer;

  if (bufferCtor) {
    return bufferCtor.from(bytes).toString('base64');
  }

  let binary = '';

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }

  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const bufferCtor = (globalThis as typeof globalThis & {
    Buffer?: { from(input: string, encoding: 'base64'): Uint8Array };
  }).Buffer;

  if (bufferCtor) {
    return new Uint8Array(bufferCtor.from(base64, 'base64'));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function dataUrlToBlob(dataUrl: string) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);

  if (!match) {
    throw new Error('지원하지 않는 이미지 데이터 형식입니다.');
  }

  const mimeType = match[1];
  const base64 = match[2];

  if (!mimeType || !base64 || !SUPPORTED_UPLOAD_MIME_TYPES.has(mimeType)) {
    throw new Error('지원하지 않는 이미지 MIME 타입입니다.');
  }

  const bytes = base64ToBytes(base64);

  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('이미지 파일은 5MB 이하만 가져올 수 있습니다.');
  }

  return new Blob([bytes], { type: mimeType });
}

async function fileToBlob(file: File) {
  if (typeof file.arrayBuffer === 'function') {
    return new Blob([await file.arrayBuffer()], { type: file.type });
  }

  return new Promise<Blob>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error('이미지 파일을 읽지 못했습니다.'));
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error('이미지 파일을 읽지 못했습니다.'));
        return;
      }
      resolve(new Blob([reader.result], { type: file.type }));
    };
    reader.readAsArrayBuffer(file);
  });
}

function getRestoreOperation(record: { serverVersion?: number }): SyncOperation {
  return (record.serverVersion ?? 0) === 0 ? 'create' : 'update';
}

function getRestoredSyncStatus(record: { serverVersion?: number }): WorkSyncStatus {
  return getNextSyncStatus(record.serverVersion ?? 0);
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
    const template =
      TIER_BOARD_TEMPLATES.find((candidate) => candidate.title === input.templateTitle) ??
      TIER_BOARD_TEMPLATES[0]!;
    const lanes = template.lanes.map((lane, index) =>
      createLaneRecord(board.id, lane, index, now),
    );
    const db = this.repository.getDbInstance();

    await db.transaction('rw', db.tierBoards, db.tierLanes, db.syncQueue, async () => {
      await db.tierBoards.add(board);
      await db.tierLanes.bulkAdd(lanes);
      await this.enqueueBoardInOpenTransaction(board, 'create', 'tier_board_create');
      for (const lane of lanes) {
        await this.enqueueLaneInOpenTransaction(lane, 'create', 'tier_board_create');
      }
    });

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
        await this.enqueueBoardInOpenTransaction(board, 'delete');
        for (const lane of lanes) {
          await this.enqueueLaneInOpenTransaction(lane, 'delete');
        }
        for (const card of cards) {
          await this.enqueueCardInOpenTransaction(card, 'delete');
        }
        for (const asset of assets) {
          await this.enqueueAssetInOpenTransaction(asset, 'delete');
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
        await this.enqueueBoardInOpenTransaction(board, getRestoreOperation(board));
        for (const lane of lanes) {
          await this.enqueueLaneInOpenTransaction(lane, getRestoreOperation(lane));
        }
        for (const card of cards) {
          await this.enqueueCardInOpenTransaction(card, getRestoreOperation(card));
        }
        for (const asset of assets) {
          await this.enqueueAssetInOpenTransaction(asset, 'create');
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
          ? `indexeddb://tier-board-assets/${id}`
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
        await this.enqueueBoardInOpenTransaction(board, 'create');
        for (const lane of lanes) {
          await this.enqueueLaneInOpenTransaction(lane, 'create');
        }
        for (const card of normalizedCards) {
          await this.enqueueCardInOpenTransaction(card, 'create');
        }
        for (const asset of assets) {
          await this.enqueueAssetInOpenTransaction(asset, 'create');
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
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
    const db = this.repository.getDbInstance();

    await db.transaction('rw', db.tierBoards, db.tierLanes, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierLanes.put(lane);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      await this.enqueueLaneInOpenTransaction(lane, 'create');
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
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
    const db = this.repository.getDbInstance();

    await db.transaction('rw', db.tierBoards, db.tierLanes, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierLanes.put(updated);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      await this.enqueueLaneInOpenTransaction(updated, 'update');
    });

    return updated;
  }

  async reorderLane(boardId: string, laneIds: string[]) {
    const state = await this.requireEditorState(boardId);
    const lanesById = new Map(state.lanes.map((lane) => [lane.id, lane]));
    const now = nowIso();
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
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

    await db.transaction('rw', db.tierBoards, db.tierLanes, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierLanes.bulkPut(lanes);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      for (const lane of lanes) {
        await this.enqueueLaneInOpenTransaction(lane, 'update');
      }
    });

    return lanes;
  }

  async deleteLane(id: string) {
    const lane = await this.requireLane(id);
    const state = await this.requireEditorState(lane.boardId);
    const now = nowIso();
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
    const deletedLane: TierLaneRecord = {
      ...lane,
      deletedAt: now,
      updatedAt: now,
      syncStatus: getNextSyncStatus(lane.serverVersion),
    };
    const laneCards = state.cards.filter((card) => card.laneId === id);
    const movedCards = laneCards
      .map<TierBoardCardRecord>((card, index) => ({
        ...card,
        laneId: null,
        orderIndex: getNextOrderIndex(
          state.cards.filter((candidate) => candidate.laneId === null),
        ) + index,
        updatedAt: now,
        syncStatus: getNextSyncStatus(card.serverVersion),
      }));
    const db = this.repository.getDbInstance();

    await db.transaction('rw', db.tierBoards, db.tierLanes, db.tierBoardCards, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierLanes.put(deletedLane);
      await db.tierBoardCards.bulkPut(movedCards);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      await this.enqueueLaneInOpenTransaction(deletedLane, 'delete');
      for (const card of movedCards) {
        await this.enqueueCardInOpenTransaction(card, 'update');
      }
    });

    return { cards: laneCards, lane } satisfies TierLaneDeleteSnapshot;
  }

  async restoreLaneDeleteSnapshot(snapshot: TierLaneDeleteSnapshot) {
    const now = nowIso();
    const state = await this.requireEditorState(snapshot.lane.boardId);
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
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

    await db.transaction('rw', db.tierBoards, db.tierLanes, db.tierBoardCards, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierLanes.put(lane);
      await db.tierBoardCards.bulkPut(cards);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      await this.enqueueLaneInOpenTransaction(lane, getRestoreOperation(lane));
      for (const card of cards) {
        await this.enqueueCardInOpenTransaction(card, getRestoreOperation(card));
      }
    });

    return { cards, lane };
  }

  async createCard(boardId: string, input: CreateCardInput) {
    const state = await this.requireEditorState(boardId);
    const now = nowIso();
    const card = createCardRecord(
      boardId,
      input,
      getNextOrderIndex(
        state.cards.filter((record) => (record.laneId ?? null) === (input.laneId ?? null)),
      ),
      now,
    );
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
    const db = this.repository.getDbInstance();

    await db.transaction('rw', db.tierBoards, db.tierBoardCards, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierBoardCards.put(card);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      await this.enqueueCardInOpenTransaction(card, 'create');
    });

    return card;
  }

  createCustomTextCard(boardId: string, input: Omit<CreateCardInput, 'cardSourceType' | 'imageUrl'>) {
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
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
    const db = this.repository.getDbInstance();

    await db.transaction('rw', db.tierBoards, db.tierBoardCards, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierBoardCards.put(updated);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      await this.enqueueCardInOpenTransaction(updated, 'update');
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
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
    const db = this.repository.getDbInstance();

    await db.transaction('rw', db.tierBoards, db.tierBoardCards, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierBoardCards.put(deleted);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      await this.enqueueCardInOpenTransaction(deleted, 'delete');
    });

    return card;
  }

  async duplicateCard(id: string) {
    const source = await this.requireCard(id);
    const state = await this.requireEditorState(source.boardId);
    const now = nowIso();
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
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

    await db.transaction('rw', db.tierBoards, db.tierBoardCards, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierBoardCards.put(card);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      await this.enqueueCardInOpenTransaction(card, 'create');
    });

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
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
    const db = this.repository.getDbInstance();

    await db.transaction('rw', db.tierBoards, db.tierBoardCards, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierBoardCards.put(restored);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      await this.enqueueCardInOpenTransaction(restored, getRestoreOperation(restored));
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
    const cardsById = new Map(state.cards.map((card) => [card.id, card]));
    const now = nowIso();
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
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

    await db.transaction('rw', db.tierBoards, db.tierBoardCards, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierBoardCards.bulkPut(cards);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      for (const card of cards) {
        await this.enqueueCardInOpenTransaction(card, 'update');
      }
    });

    return cards;
  }

  async createCardFromWorkSnapshot(boardId: string, workId: string, laneId: string | null = null) {
    const work = await this.worksRepo.getById(workId);

    if (!work || work.deletedAt !== null) {
      throw new Error('가져올 작품을 찾을 수 없습니다.');
    }

    const state = await this.requireEditorState(boardId);
    const now = nowIso();
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
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
        getNextOrderIndex(state.cards.filter((record) => record.laneId === laneId)),
        now,
      ),
      workId: work.id,
    };
    const db = this.repository.getDbInstance();

    await db.transaction('rw', db.tierBoards, db.tierBoardCards, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierBoardCards.put(card);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      await this.enqueueCardInOpenTransaction(card, 'create');
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
    if (!SUPPORTED_UPLOAD_MIME_TYPES.has(file.type)) {
      throw new Error('jpg, jpeg, png, webp 이미지만 업로드할 수 있습니다.');
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error('이미지 파일은 5MB 이하만 업로드할 수 있습니다.');
    }

    const state = await this.requireEditorState(boardId);
    const now = nowIso();
    const assetId = crypto.randomUUID();
    const objectUrl = `indexeddb://tier-board-assets/${assetId}`;
    const blob = await fileToBlob(file);
    const dataUrl = await blobToDataUrl(blob);
    localAssetDataUrlCache.set(assetId, dataUrl);
    const card: TierBoardCardRecord = createCardRecord(
      boardId,
      {
        ...input,
        imageUrl: objectUrl,
        cardSourceType: 'image_upload',
      },
      getNextOrderIndex(
        state.cards.filter((record) => (record.laneId ?? null) === (input.laneId ?? null)),
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
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
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
        await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
        await this.enqueueCardInOpenTransaction(card, 'create');
        await this.enqueueAssetInOpenTransaction(asset, 'create');
      },
    );

    return { asset, card };
  }

  async exportBoardJson(boardId: string): Promise<TierBoardExportDocument> {
    const state = await this.requireEditorState(boardId);
    const assets = await Promise.all(
      state.assets.map<Promise<TierBoardExportAsset>>(async ({ blob, dataUrl, ...asset }) => {
        const cachedDataUrl = dataUrl ?? localAssetDataUrlCache.get(asset.id);

        if (asset.storageType !== 'local_blob' || !blob || asset.sizeBytes > MAX_UPLOAD_BYTES) {
          return cachedDataUrl && asset.storageType === 'local_blob' && asset.sizeBytes <= MAX_UPLOAD_BYTES
            ? { ...asset, dataUrl: cachedDataUrl }
            : asset;
        }

        try {
          const nextDataUrl = await blobToDataUrl(blob);
          localAssetDataUrlCache.set(asset.id, nextDataUrl);

          return {
            ...asset,
            dataUrl: nextDataUrl,
          };
        } catch {
          return cachedDataUrl ? { ...asset, dataUrl: cachedDataUrl } : asset;
        }
      }),
    );

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
    const maps: ImportIdMaps = {
      boardIds: new Map([[parsed.board.id, crypto.randomUUID()]]),
      laneIds: new Map(),
      cardIds: new Map(),
    };
    const board: TierBoardRecord = {
      ...parsed.board,
      id: maps.boardIds.get(parsed.board.id)!,
      title: parsed.board.title || '가져온 티어보드',
      slug: createSlug(parsed.board.title || '가져온 티어보드'),
      visibility: 'private',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    };
    const lanes = parsed.lanes.map<TierLaneRecord>((lane) => {
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
    const cards = parsed.cards.map<TierBoardCardRecord>((card) => {
      const id = crypto.randomUUID();
      maps.cardIds.set(card.id, id);

      return {
        ...card,
        id,
        boardId: board.id,
        laneId: card.laneId ? (maps.laneIds.get(card.laneId) ?? null) : null,
        workId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'local-only',
        serverVersion: 0,
      };
    });
    const cardImageUrlByOldCardId = new Map(parsed.cards.map((card) => [card.id, card.imageUrl]));
    const localAssetUrlRemaps = new Map<string, string>();
    const localAssetMissingUrls = new Set<string>();
    const assets = parsed.assets.map<StoredTierBoardAssetRecord>((asset) => {
      const { dataUrl, ...assetRecord } = asset;
      const id = crypto.randomUUID();
      const objectUrl =
        assetRecord.storageType === 'local_blob'
          ? `indexeddb://tier-board-assets/${id}`
          : assetRecord.objectUrl;
      let blob: Blob | null = null;

      if (assetRecord.storageType === 'local_blob' && dataUrl) {
        try {
          blob = dataUrlToBlob(dataUrl);
          localAssetUrlRemaps.set(assetRecord.objectUrl, objectUrl);
        } catch {
          localAssetMissingUrls.add(assetRecord.objectUrl);
        }
      } else if (assetRecord.storageType === 'local_blob') {
        localAssetMissingUrls.add(assetRecord.objectUrl);
      }

      const importedAsset: StoredTierBoardAssetRecord = {
        ...assetRecord,
        id,
        boardId: board.id,
        cardId: assetRecord.cardId ? (maps.cardIds.get(assetRecord.cardId) ?? null) : null,
        objectUrl: assetRecord.storageType === 'local_blob' && !blob ? '' : objectUrl,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        blob,
      };

      if (blob && dataUrl) {
        importedAsset.dataUrl = dataUrl;
        localAssetDataUrlCache.set(id, dataUrl);
      }

      return importedAsset;
    });
    const normalizedCards = cards.map<TierBoardCardRecord>((card) => {
      const oldCardId = [...maps.cardIds.entries()].find(([, nextId]) => nextId === card.id)?.[0];
      const oldImageUrl = oldCardId ? cardImageUrlByOldCardId.get(oldCardId) : card.imageUrl;

      if (oldImageUrl && localAssetUrlRemaps.has(oldImageUrl)) {
        return {
          ...card,
          imageUrl: localAssetUrlRemaps.get(oldImageUrl)!,
        };
      }

      if (oldImageUrl && localAssetMissingUrls.has(oldImageUrl)) {
        return {
          ...card,
          imageUrl: '',
        };
      }

      return card;
    });
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
        await this.enqueueBoardInOpenTransaction(board, 'create', 'tier_board_import');
        for (const lane of lanes) {
          await this.enqueueLaneInOpenTransaction(lane, 'create', 'tier_board_import');
        }
        for (const card of normalizedCards) {
          await this.enqueueCardInOpenTransaction(card, 'create', 'tier_board_import');
        }
        for (const asset of assets) {
          await this.enqueueAssetInOpenTransaction(asset, 'create', 'tier_board_import');
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
    const template =
      TIER_BOARD_TEMPLATES.find((candidate) => candidate.title === templateLabel) ??
      TIER_BOARD_TEMPLATES[0]!;
    const state = await this.requireEditorState(boardId);
    const now = nowIso();
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
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

    await db.transaction('rw', db.tierBoards, db.tierLanes, db.tierBoardCards, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierLanes.bulkPut([...deletedLanes, ...lanes]);
      await db.tierBoardCards.bulkPut(cards);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      for (const lane of deletedLanes) {
        await this.enqueueLaneInOpenTransaction(lane, 'delete');
      }
      for (const lane of lanes) {
        await this.enqueueLaneInOpenTransaction(lane, 'create');
      }
      for (const card of cards) {
        await this.enqueueCardInOpenTransaction(card, 'update');
      }
    });

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
        state.cards.filter((record) => record.laneId === laneId && record.id !== id),
      ),
      updatedAt: now,
      syncStatus: getNextSyncStatus(card.serverVersion),
    };
    const touchedBoard: TierBoardRecord = {
      ...state.board,
      updatedAt: now,
      syncStatus: getNextSyncStatus(state.board.serverVersion),
    };
    const db = this.repository.getDbInstance();

    await db.transaction('rw', db.tierBoards, db.tierBoardCards, db.syncQueue, async () => {
      await db.tierBoards.put(touchedBoard);
      await db.tierBoardCards.put(moved);
      await this.enqueueBoardInOpenTransaction(touchedBoard, 'update');
      await this.enqueueCardInOpenTransaction(moved, 'update');
    });

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

  private async requireCard(id: string) {
    const card = await this.repository.getCardById(id);

    if (!card) {
      throw new Error('티어보드 항목을 찾을 수 없습니다.');
    }

    return card;
  }

  private enqueueBoard(
    board: TierBoardRecord,
    operation: SyncOperation,
    source:
      | 'tier_board_create'
      | 'tier_board_update'
      | 'tier_board_import'
      | 'tier_board_migration' = 'tier_board_update',
  ) {
    return this.queueRepository.enqueueEntityChange(
      'tier_board',
      board,
      operation,
      { ...board },
      source,
    );
  }

  private enqueueBoardInOpenTransaction(
    board: TierBoardRecord,
    operation: SyncOperation,
    source:
      | 'tier_board_create'
      | 'tier_board_update'
      | 'tier_board_import'
      | 'tier_board_migration' = 'tier_board_update',
  ) {
    return this.queueRepository.enqueueEntityChangeInOpenTransaction(
      'tier_board',
      board,
      operation,
      { ...board },
      source,
    );
  }

  private enqueueLane(
    lane: TierLaneRecord,
    operation: SyncOperation,
    source:
      | 'tier_board_create'
      | 'tier_board_update'
      | 'tier_board_import'
      | 'tier_board_migration' = 'tier_board_update',
  ) {
    return this.queueRepository.enqueueEntityChange(
      'tier_lane',
      lane,
      operation,
      { ...lane },
      source,
    );
  }

  private enqueueLaneInOpenTransaction(
    lane: TierLaneRecord,
    operation: SyncOperation,
    source:
      | 'tier_board_create'
      | 'tier_board_update'
      | 'tier_board_import'
      | 'tier_board_migration' = 'tier_board_update',
  ) {
    return this.queueRepository.enqueueEntityChangeInOpenTransaction(
      'tier_lane',
      lane,
      operation,
      { ...lane },
      source,
    );
  }

  private enqueueCard(
    card: TierBoardCardRecord,
    operation: SyncOperation,
    source:
      | 'tier_board_create'
      | 'tier_board_update'
      | 'tier_board_import'
      | 'tier_board_migration' = 'tier_board_update',
  ) {
    return this.queueRepository.enqueueEntityChange(
      'tier_board_card',
      card,
      operation,
      { ...card },
      source,
    );
  }

  private enqueueCardInOpenTransaction(
    card: TierBoardCardRecord,
    operation: SyncOperation,
    source:
      | 'tier_board_create'
      | 'tier_board_update'
      | 'tier_board_import'
      | 'tier_board_migration' = 'tier_board_update',
  ) {
    return this.queueRepository.enqueueEntityChangeInOpenTransaction(
      'tier_board_card',
      card,
      operation,
      { ...card },
      source,
    );
  }

  private enqueueAsset(
    asset: StoredTierBoardAssetRecord,
    operation: SyncOperation,
    source:
      | 'tier_board_asset_update'
      | 'tier_board_create'
      | 'tier_board_migration'
      | 'tier_board_import' = 'tier_board_asset_update',
  ) {
    const { blob: _blob, dataUrl: _dataUrl, ...payload } = asset;

    return this.queueRepository.enqueueEntityChange(
      'tier_board_asset',
      payload,
      operation,
      payload,
      source,
    );
  }

  private enqueueAssetInOpenTransaction(
    asset: StoredTierBoardAssetRecord,
    operation: SyncOperation,
    source:
      | 'tier_board_asset_update'
      | 'tier_board_create'
      | 'tier_board_migration'
      | 'tier_board_import' = 'tier_board_asset_update',
  ) {
    const { blob: _blob, dataUrl: _dataUrl, ...payload } = asset;

    return this.queueRepository.enqueueEntityChangeInOpenTransaction(
      'tier_board_asset',
      payload,
      operation,
      payload,
      source,
    );
  }
}

export const tierBoardService = new TierBoardService();
