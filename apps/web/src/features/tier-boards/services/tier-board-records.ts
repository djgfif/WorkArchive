import type {
  SyncOperation,
  TierBoardCardRecord,
  TierLaneRecord,
  TierBoardRecord,
  WorkRecord,
  WorkSyncStatus,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';
import { getWorkTypeLabel } from '@features/works';

import type {
  CreateBoardInput,
  CreateCardInput,
  CreateLaneInput,
  TierBoardExportDocument,
} from './tier-board.types';

export function nowIso() {
  return new Date().toISOString();
}

export function getNextSyncStatus(serverVersion: number): WorkSyncStatus {
  return serverVersion > 0 ? 'pending' : 'local-only';
}

export function getNextOrderIndex(
  records: ReadonlyArray<{ orderIndex: number }>,
) {
  return records.length === 0
    ? 0
    : Math.max(...records.map((record) => record.orderIndex)) + 1;
}

export function touchTierBoard(
  board: TierBoardRecord,
  now: string,
): TierBoardRecord {
  return {
    ...board,
    updatedAt: now,
    syncStatus: getNextSyncStatus(board.serverVersion),
  };
}

export function cloneBoard(
  board: TierBoardRecord,
  now: string,
): TierBoardRecord {
  const title = appI18n.t('tierBoards.copyTitle', { title: board.title });

  return {
    ...board,
    id: crypto.randomUUID(),
    slug: createSlug(title),
    title,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
  };
}

export function createSlug(title: string) {
  const normalized = title
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${normalized || 'tier-board'}-${crypto.randomUUID().slice(0, 8)}`;
}

export function createBoardRecord(
  input: CreateBoardInput,
  now: string,
): TierBoardRecord {
  const title = input.title?.trim() || appI18n.t('tierBoards.newTitle');

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

export function createLaneRecord(
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

export function createCardRecord(
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

export function createWorkSubtitle(work: WorkRecord) {
  return [
    getWorkTypeLabel(work.type),
    work.author,
    work.rating === null ? null : `★ ${work.rating.toFixed(1)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function prepareCardForExport(
  card: TierBoardCardRecord,
): TierBoardCardRecord {
  return {
    ...card,
    workId: null,
  };
}

export function assertExportDocument(value: unknown): TierBoardExportDocument {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (value as { format?: unknown }).format !== 'work-archive.tier-board'
  ) {
    throw new Error(appI18n.t('tierBoards.errors.invalidJson'));
  }

  return value as TierBoardExportDocument;
}

export function getRestoreOperation(record: {
  serverVersion?: number;
}): SyncOperation {
  return (record.serverVersion ?? 0) === 0 ? 'create' : 'update';
}

export function getRestoredSyncStatus(record: {
  serverVersion?: number;
}): WorkSyncStatus {
  return getNextSyncStatus(record.serverVersion ?? 0);
}
