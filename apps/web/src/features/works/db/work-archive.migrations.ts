import type { Table, Transaction } from 'dexie';

import type {
  ContributorEntityType,
  ContributorRecord,
  SeriesKind,
  SeriesRecord,
  SyncQueueItemRecord,
  SyncQueuePayload,
  TierBoardAssetRecord,
  TierBoardCardRecord,
  TierBoardRecord,
  TierLaneRecord,
  UserReleaseRecord,
  WorkContributorRecord,
  WorkContributorRole,
  WorkRecord,
  WorkSeriesLinkRecord,
} from '@work-archive/shared-types';

type GraphTagKind =
  | 'series'
  | 'universe'
  | 'creator'
  | 'studio'
  | 'publisher'
  | 'platform';

interface ParsedMigrationGraphTag {
  kind: GraphTagKind;
  value: string;
}

type LegacyWorkRecord = Omit<WorkRecord, 'status'> & { status: string };
type LegacyReleaseRecord = Omit<UserReleaseRecord, 'status'> & {
  status: string;
};
type LegacyTierWorkRecord = WorkRecord & { tier?: string | null };

export type StoredTierBoardAssetRecord = TierBoardAssetRecord & {
  blob?: Blob | null;
  dataUrl?: string;
};

const GRAPH_TAG_KINDS = new Set([
  'series',
  'universe',
  'creator',
  'studio',
  'publisher',
  'platform',
] satisfies GraphTagKind[]);

const DEFAULT_TIER_BOARD_LANES = [
  { title: 'S', colorToken: '#f97373' },
  { title: 'A', colorToken: '#f59e0b' },
  { title: 'B', colorToken: '#22c55e' },
  { title: 'C', colorToken: '#38bdf8' },
  { title: 'D', colorToken: '#94a3b8' },
] as const;

function normalizeGraphValue(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function normalizeGraphKey(value: string) {
  return normalizeGraphValue(value).toLowerCase();
}

function parseGraphTag(tag: string): ParsedMigrationGraphTag | null {
  const separatorIndex = tag.indexOf(':');

  if (separatorIndex <= 0) {
    return null;
  }

  const kind = tag.slice(0, separatorIndex).trim().toLowerCase();
  const value = normalizeGraphValue(tag.slice(separatorIndex + 1));

  if (!GRAPH_TAG_KINDS.has(kind as GraphTagKind) || !value) {
    return null;
  }

  return {
    kind: kind as GraphTagKind,
    value,
  };
}

function mapGraphTagToSeriesKind(kind: GraphTagKind): SeriesKind | null {
  if (kind === 'series') {
    return 'series';
  }

  if (kind === 'universe') {
    return 'universe';
  }

  return null;
}

function mapGraphTagToContributor(kind: GraphTagKind): {
  entityType: ContributorEntityType;
  role: WorkContributorRole;
} | null {
  switch (kind) {
    case 'creator':
      return { entityType: 'person', role: 'original_creator' };
    case 'studio':
      return { entityType: 'organization', role: 'studio' };
    case 'publisher':
      return { entityType: 'organization', role: 'publisher' };
    case 'platform':
      return { entityType: 'organization', role: 'platform' };
    default:
      return null;
  }
}

function getPayloadServerVersion(payload: SyncQueuePayload) {
  return 'serverVersion' in payload ? payload.serverVersion : 0;
}

function createQueueItem<TPayload extends SyncQueuePayload>(
  entityType: SyncQueueItemRecord<TPayload>['entityType'],
  payload: TPayload,
  createdAt: string,
): SyncQueueItemRecord<TPayload> {
  return {
    id: crypto.randomUUID(),
    clientMutationId: crypto.randomUUID(),
    entityType,
    entityId: payload.id,
    operation: getPayloadServerVersion(payload) === 0 ? 'create' : 'update',
    payload,
    source: 'archive_migration',
    createdAt,
    retryCount: 0,
    nextRetryAt: null,
    lastError: null,
    conflict: null,
  };
}

async function replaceQueuedEntity<TPayload extends SyncQueuePayload>(
  syncQueue: Table<SyncQueueItemRecord, string>,
  queueItem: SyncQueueItemRecord<TPayload>,
) {
  const existingItems = await syncQueue
    .where('[entityType+entityId]')
    .equals([queueItem.entityType, queueItem.entityId])
    .toArray();

  if (existingItems.length > 0) {
    await syncQueue.bulkDelete(existingItems.map((item) => item.id));
  }

  await syncQueue.add(queueItem);
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

function createTierBoardRecord(
  title: string,
  description: string,
  now: string,
): TierBoardRecord {
  return {
    id: crypto.randomUUID(),
    title,
    description,
    slug: createSlug(title),
    boardType: 'classic_tier',
    visibility: 'private',
    coverImageUrl: '',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
  };
}

function createDefaultTierBoardLanes(
  boardId: string,
  now: string,
): TierLaneRecord[] {
  return DEFAULT_TIER_BOARD_LANES.map((lane, index) => ({
    id: crypto.randomUUID(),
    boardId,
    title: lane.title,
    description: '',
    colorToken: lane.colorToken,
    orderIndex: index,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
  }));
}

function buildWorkSnapshotSubtitle(work: LegacyTierWorkRecord) {
  return [
    work.type,
    work.author,
    work.rating === null || work.rating === undefined
      ? null
      : `★ ${work.rating.toFixed(1)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function stripLegacyTier<TRecord extends Record<string, unknown>>(
  record: TRecord,
) {
  const { tier: _tier, ...rest } = record;

  return rest as Omit<TRecord, 'tier'>;
}

export async function migrateTierBoards(transaction: Transaction) {
  const worksTable = transaction.table<
    LegacyTierWorkRecord & { _deletedAtScope?: string },
    string
  >('works');
  const tierBoardsTable = transaction.table<TierBoardRecord, string>(
    'tierBoards',
  );
  const tierLanesTable = transaction.table<TierLaneRecord, string>('tierLanes');
  const tierBoardCardsTable = transaction.table<TierBoardCardRecord, string>(
    'tierBoardCards',
  );
  const syncQueueTable = transaction.table<SyncQueueItemRecord, string>(
    'syncQueue',
  );
  const now = new Date().toISOString();
  const defaultBoard = createTierBoardRecord(
    '내 첫 티어보드',
    '자유롭게 카드를 추가하고 원하는 기준으로 정리하세요.',
    now,
  );
  const defaultLanes = createDefaultTierBoardLanes(defaultBoard.id, now);

  await tierBoardsTable.add(defaultBoard);
  await tierLanesTable.bulkAdd(defaultLanes);
  await replaceQueuedEntity(
    syncQueueTable,
    createQueueItem('tier_board', defaultBoard, now),
  );
  for (const lane of defaultLanes) {
    await replaceQueuedEntity(
      syncQueueTable,
      createQueueItem('tier_lane', lane, now),
    );
  }

  const works = await worksTable.toArray();
  const tieredWorks = works.filter(
    (work) =>
      work.deletedAt === null && typeof work.tier === 'string' && work.tier,
  );

  if (tieredWorks.length > 0) {
    const legacyBoard = createTierBoardRecord(
      'Legacy 작품 티어보드',
      '기존 작품 tier 값을 독립 티어보드 카드 snapshot으로 변환했습니다.',
      now,
    );
    const legacyLabels = Array.from(
      new Set(tieredWorks.map((work) => work.tier).filter(Boolean) as string[]),
    );
    const legacyLanes = legacyLabels.map<TierLaneRecord>((label, index) => {
      const defaultLane = DEFAULT_TIER_BOARD_LANES.find(
        (lane) => lane.title === label,
      );

      return {
        id: crypto.randomUUID(),
        boardId: legacyBoard.id,
        title: label,
        description: '',
        colorToken: defaultLane?.colorToken ?? '#64748b',
        orderIndex: index,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'local-only',
        serverVersion: 0,
      };
    });
    const laneByLabel = new Map(legacyLanes.map((lane) => [lane.title, lane]));
    const orderByLane = new Map<string, number>();
    const legacyItems = tieredWorks.map<TierBoardCardRecord>((work) => {
      const label = work.tier ?? '';
      const orderIndex = orderByLane.get(label) ?? 0;

      orderByLane.set(label, orderIndex + 1);

      return {
        id: crypto.randomUUID(),
        boardId: legacyBoard.id,
        laneId: laneByLabel.get(label)?.id ?? null,
        cardSourceType: 'library_work',
        title: work.title,
        subtitle: buildWorkSnapshotSubtitle(work),
        imageUrl: work.thumbnailUrl,
        note: work.shortReview || work.review,
        workId: work.id,
        orderIndex,
        createdAt: work.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'local-only',
        serverVersion: 0,
      };
    });

    await tierBoardsTable.add(legacyBoard);
    await tierLanesTable.bulkAdd(legacyLanes);
    await tierBoardCardsTable.bulkAdd(legacyItems);
    await replaceQueuedEntity(
      syncQueueTable,
      createQueueItem('tier_board', legacyBoard, now),
    );
    for (const lane of legacyLanes) {
      await replaceQueuedEntity(
        syncQueueTable,
        createQueueItem('tier_lane', lane, now),
      );
    }
    for (const card of legacyItems) {
      await replaceQueuedEntity(
        syncQueueTable,
        createQueueItem('tier_board_card', card, now),
      );
    }
  }

  await worksTable.toCollection().modify((work) => {
    delete work.tier;
  });
  await syncQueueTable.toCollection().modify((item) => {
    if (item.entityType === 'work' && item.payload && 'tier' in item.payload) {
      item.payload = stripLegacyTier(
        item.payload as Record<string, unknown>,
      ) as unknown as SyncQueuePayload;
    }
  });
}

function normalizeTierBoardRecord(
  board: Partial<TierBoardRecord> & {
    id: string;
    layout?: string;
  },
): TierBoardRecord {
  const title = board.title?.trim() || '티어보드';

  return {
    id: board.id,
    title,
    description: board.description ?? '',
    slug: board.slug || createSlug(title),
    boardType: board.boardType ?? 'classic_tier',
    visibility:
      board.visibility === 'exported' || board.visibility === 'link_only'
        ? board.visibility
        : 'private',
    coverImageUrl: board.coverImageUrl ?? '',
    createdAt: board.createdAt ?? new Date().toISOString(),
    updatedAt: board.updatedAt ?? new Date().toISOString(),
    deletedAt: board.deletedAt ?? null,
    syncStatus: board.syncStatus ?? 'local-only',
    serverVersion: board.serverVersion ?? 0,
  };
}

function normalizeTierLaneRecord(
  lane: Partial<TierLaneRecord> & {
    id: string;
    label?: string;
    color?: string;
  },
): TierLaneRecord {
  return {
    id: lane.id,
    boardId: lane.boardId ?? '',
    title: lane.title ?? lane.label ?? 'Lane',
    description: lane.description ?? '',
    colorToken: lane.colorToken ?? lane.color ?? '#64748b',
    orderIndex: lane.orderIndex ?? 0,
    createdAt: lane.createdAt ?? new Date().toISOString(),
    updatedAt: lane.updatedAt ?? new Date().toISOString(),
    deletedAt: lane.deletedAt ?? null,
    syncStatus: lane.syncStatus ?? 'local-only',
    serverVersion: lane.serverVersion ?? 0,
  };
}

function normalizeTierBoardCardRecord(
  card: Partial<TierBoardCardRecord> & {
    id: string;
    sourceType?: string;
    linkedWorkId?: string | null;
  },
): TierBoardCardRecord {
  const sourceMap: Record<string, TierBoardCardRecord['cardSourceType']> = {
    custom: 'custom',
    image: 'image_upload',
    image_upload: 'image_upload',
    url: 'image_url',
    image_url: 'image_url',
    work_ref: 'library_work',
    library_work: 'library_work',
  };

  return {
    id: card.id,
    boardId: card.boardId ?? '',
    laneId: card.laneId ?? null,
    orderIndex: card.orderIndex ?? 0,
    cardSourceType:
      card.cardSourceType ?? sourceMap[card.sourceType ?? 'custom'] ?? 'custom',
    workId: card.workId ?? card.linkedWorkId ?? null,
    title: card.title ?? '',
    subtitle: card.subtitle ?? '',
    imageUrl: card.imageUrl ?? '',
    note: card.note ?? '',
    createdAt: card.createdAt ?? new Date().toISOString(),
    updatedAt: card.updatedAt ?? new Date().toISOString(),
    deletedAt: card.deletedAt ?? null,
    syncStatus: card.syncStatus ?? 'local-only',
    serverVersion: card.serverVersion ?? 0,
  };
}

function normalizeTierBoardAssetRecord(
  asset: Partial<StoredTierBoardAssetRecord> & {
    id: string;
    itemId?: string | null;
  },
): StoredTierBoardAssetRecord {
  return {
    id: asset.id,
    boardId: asset.boardId ?? '',
    cardId: asset.cardId ?? asset.itemId ?? null,
    kind: 'image',
    storageType: asset.storageType ?? 'remote_url',
    objectUrl: asset.objectUrl ?? '',
    originalName: asset.originalName ?? '',
    mimeType: asset.mimeType ?? '',
    sizeBytes: asset.sizeBytes ?? 0,
    createdAt: asset.createdAt ?? new Date().toISOString(),
    updatedAt: asset.updatedAt ?? new Date().toISOString(),
    deletedAt: asset.deletedAt ?? null,
    blob: asset.blob ?? null,
  };
}

export async function migrateTierBoardDraftSchema(transaction: Transaction) {
  const tierBoardsTable = transaction.table<TierBoardRecord, string>(
    'tierBoards',
  );
  const tierLanesTable = transaction.table<TierLaneRecord, string>('tierLanes');
  const tierBoardCardsTable = transaction.table<TierBoardCardRecord, string>(
    'tierBoardCards',
  );
  const tierBoardAssetsTable = transaction.table<
    StoredTierBoardAssetRecord,
    string
  >('tierBoardAssets');
  const syncQueueTable = transaction.table<SyncQueueItemRecord, string>(
    'syncQueue',
  );

  const boards = (await tierBoardsTable.toArray()).map((board) =>
    normalizeTierBoardRecord(board),
  );
  if (boards.length > 0) {
    await tierBoardsTable.bulkPut(boards);
  }

  if ((await tierLanesTable.count()) === 0) {
    const legacyLanes = await transaction
      .table<Record<string, unknown>, string>('tierBoardLanes')
      .toArray()
      .catch(() => []);
    if (legacyLanes.length > 0) {
      await tierLanesTable.bulkPut(
        legacyLanes.map((lane) =>
          normalizeTierLaneRecord(
            lane as Parameters<typeof normalizeTierLaneRecord>[0],
          ),
        ),
      );
    }
  } else {
    const lanes = (await tierLanesTable.toArray()).map((lane) =>
      normalizeTierLaneRecord(lane),
    );
    await tierLanesTable.bulkPut(lanes);
  }

  if ((await tierBoardCardsTable.count()) === 0) {
    const legacyCards = await transaction
      .table<Record<string, unknown>, string>('tierBoardItems')
      .toArray()
      .catch(() => []);
    if (legacyCards.length > 0) {
      await tierBoardCardsTable.bulkPut(
        legacyCards.map((card) =>
          normalizeTierBoardCardRecord(
            card as Parameters<typeof normalizeTierBoardCardRecord>[0],
          ),
        ),
      );
    }
  } else {
    const cards = (await tierBoardCardsTable.toArray()).map((card) =>
      normalizeTierBoardCardRecord(card),
    );
    await tierBoardCardsTable.bulkPut(cards);
  }

  const assets = (await tierBoardAssetsTable.toArray()).map((asset) =>
    normalizeTierBoardAssetRecord(asset),
  );
  if (assets.length > 0) {
    await tierBoardAssetsTable.bulkPut(assets);
  }

  await syncQueueTable.toCollection().modify((queueItem) => {
    const entityType = queueItem.entityType as string;

    if (entityType === 'tier_board_lane') {
      queueItem.entityType = 'tier_lane';
      queueItem.payload = normalizeTierLaneRecord(
        queueItem.payload as Parameters<typeof normalizeTierLaneRecord>[0],
      ) as unknown as SyncQueuePayload;
    } else if (entityType === 'tier_board_item') {
      queueItem.entityType = 'tier_board_card';
      queueItem.payload = normalizeTierBoardCardRecord(
        queueItem.payload as Parameters<typeof normalizeTierBoardCardRecord>[0],
      ) as unknown as SyncQueuePayload;
    } else if (queueItem.entityType === 'tier_board') {
      queueItem.payload = normalizeTierBoardRecord(
        queueItem.payload as Parameters<typeof normalizeTierBoardRecord>[0],
      ) as unknown as SyncQueuePayload;
    } else if (queueItem.entityType === 'tier_board_asset') {
      queueItem.payload = normalizeTierBoardAssetRecord(
        queueItem.payload as Parameters<typeof normalizeTierBoardAssetRecord>[0],
      ) as unknown as SyncQueuePayload;
    }
  });
}

export async function migratePrefixedTagsToGraph(transaction: Transaction) {
  const worksTable = transaction.table<
    WorkRecord & { _deletedAtScope?: string },
    string
  >('works');
  const seriesTable = transaction.table<SeriesRecord, string>('series');
  const workSeriesLinksTable = transaction.table<WorkSeriesLinkRecord, string>(
    'workSeriesLinks',
  );
  const contributorsTable = transaction.table<ContributorRecord, string>(
    'contributors',
  );
  const workContributorsTable = transaction.table<
    WorkContributorRecord,
    string
  >('workContributors');
  const syncQueueTable = transaction.table<SyncQueueItemRecord, string>(
    'syncQueue',
  );
  const works = await worksTable.toArray();
  const now = new Date().toISOString();
  const seriesByKey = new Map<string, SeriesRecord>();
  const contributorsByKey = new Map<string, ContributorRecord>();
  const workSeriesLinkKeys = new Set<string>();
  const workContributorLinkKeys = new Set<string>();

  for (const work of works) {
    const tags: string[] = Array.isArray(work.personalTags)
      ? work.personalTags
      : [];
    const graphTags = tags
      .map(parseGraphTag)
      .filter((tag): tag is ParsedMigrationGraphTag => tag !== null);

    if (graphTags.length === 0) {
      continue;
    }

    const personalTags = tags.filter((tag) => parseGraphTag(tag) === null);
    const updatedWork: WorkRecord & { _deletedAtScope?: string } = {
      ...work,
      personalTags,
      syncStatus: work.serverVersion > 0 ? 'pending' : 'local-only',
      updatedAt: now,
    };

    await worksTable.put(updatedWork);
    await replaceQueuedEntity(
      syncQueueTable,
      createQueueItem('work', updatedWork, now),
    );

    for (const graphTag of graphTags) {
      const seriesKind = mapGraphTagToSeriesKind(graphTag.kind);

      if (seriesKind) {
        const normalizedTitle = normalizeGraphKey(graphTag.value);
        const seriesKey = `${seriesKind}:${normalizedTitle}`;
        let series = seriesByKey.get(seriesKey);

        if (!series) {
          series = {
            id: crypto.randomUUID(),
            title: graphTag.value,
            normalizedTitle,
            aliases: [],
            kind: seriesKind,
            parentId: null,
            description: '',
            thumbnailUrl: '',
            createdAt: work.createdAt ?? now,
            updatedAt: now,
            deletedAt: null,
            syncStatus: 'local-only',
            serverVersion: 0,
          };
          seriesByKey.set(seriesKey, series);
          await seriesTable.add(series);
          await replaceQueuedEntity(
            syncQueueTable,
            createQueueItem('series', series, now),
          );
        }

        const linkKey = `${work.id}:${series.id}:main`;

        if (!workSeriesLinkKeys.has(linkKey)) {
          workSeriesLinkKeys.add(linkKey);
          const link: WorkSeriesLinkRecord = {
            id: crypto.randomUUID(),
            workId: work.id,
            seriesId: series.id,
            role: 'main',
            orderIndex: null,
            orderLabel: '',
            createdAt: work.createdAt ?? now,
            updatedAt: now,
            deletedAt: null,
            syncStatus: 'local-only',
            serverVersion: 0,
          };

          await workSeriesLinksTable.add(link);
          await replaceQueuedEntity(
            syncQueueTable,
            createQueueItem('work_series_link', link, now),
          );
        }

        continue;
      }

      const contributorMapping = mapGraphTagToContributor(graphTag.kind);

      if (!contributorMapping) {
        continue;
      }

      const normalizedName = normalizeGraphKey(graphTag.value);
      const contributorKey = `${contributorMapping.entityType}:${normalizedName}`;
      let contributor = contributorsByKey.get(contributorKey);

      if (!contributor) {
        contributor = {
          id: crypto.randomUUID(),
          name: graphTag.value,
          normalizedName,
          aliases: [],
          entityType: contributorMapping.entityType,
          createdAt: work.createdAt ?? now,
          updatedAt: now,
          deletedAt: null,
          syncStatus: 'local-only',
          serverVersion: 0,
        };
        contributorsByKey.set(contributorKey, contributor);
        await contributorsTable.add(contributor);
        await replaceQueuedEntity(
          syncQueueTable,
          createQueueItem('contributor', contributor, now),
        );
      }

      const linkKey = `${work.id}:${contributor.id}:${contributorMapping.role}`;

      if (workContributorLinkKeys.has(linkKey)) {
        continue;
      }

      workContributorLinkKeys.add(linkKey);
      const link: WorkContributorRecord = {
        id: crypto.randomUUID(),
        workId: work.id,
        contributorId: contributor.id,
        role: contributorMapping.role,
        displayOrder: 0,
        createdAt: work.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'local-only',
        serverVersion: 0,
      };

      await workContributorsTable.add(link);
      await replaceQueuedEntity(
        syncQueueTable,
        createQueueItem('work_contributor', link, now),
      );
    }
  }
}

export async function migratePausedStatusToDropped(transaction: Transaction) {
  await transaction
    .table<LegacyWorkRecord, string>('works')
    .toCollection()
    .modify((work) => {
      if (work.status === 'paused') {
        work.status = 'dropped';
      }
    });

  await transaction
    .table<LegacyReleaseRecord, string>('releaseRecords')
    .toCollection()
    .modify((record) => {
      if (record.status === 'paused') {
        record.status = 'dropped';
      }
    });

  await transaction
    .table<SyncQueueItemRecord & { payload?: { status?: string } }, string>(
      'syncQueue',
    )
    .toCollection()
    .modify((card) => {
      if (
        (card.entityType === 'work' || card.entityType === 'release_record') &&
        card.payload?.status === 'paused'
      ) {
        card.payload.status = 'dropped';
      }
    });
}
