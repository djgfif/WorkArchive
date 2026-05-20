import Dexie, { type Table, type Transaction } from 'dexie';

import type {
  AppMetaRecord,
  ContributorRecord,
  ContributorEntityType,
  SeriesKind,
  SeriesRecord,
  SyncQueueItemRecord,
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkContributorRecord,
  WorkContributorRole,
  WorkRecord,
  WorkSeriesLinkRecord,
  WorkRelationRecord,
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
type LegacyReleaseRecord = Omit<UserReleaseRecord, 'status'> & { status: string };

const DEFAULT_DB_NAME = 'work-archive-db-guest';

export type ArchiveScope =
  | {
      kind: 'guest';
    }
  | {
      kind: 'user';
      userId: string;
    };

const knownDatabaseNames = new Set<string>();
const knownDatabaseInstances = new Set<WorkArchiveDatabase>();

export class WorkArchiveDatabase extends Dexie {
  works!: Table<WorkRecord, string>;
  releaseRecords!: Table<UserReleaseRecord, string>;
  timelineEntries!: Table<TimelineEntryRecord, string>;
  series!: Table<SeriesRecord, string>;
  workSeriesLinks!: Table<WorkSeriesLinkRecord, string>;
  contributors!: Table<ContributorRecord, string>;
  workContributors!: Table<WorkContributorRecord, string>;
  workRelations!: Table<WorkRelationRecord, string>;
  syncQueue!: Table<SyncQueueItemRecord, string>;
  appMeta!: Table<AppMetaRecord, string>;

  constructor(name = 'work-archive-db') {
    super(name);

    this.version(1).stores({
      works:
        'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus',
    });

    this.version(2).stores({
      works:
        'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus',
      syncQueue:
        'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
      appMeta: 'key',
    });

    this.version(3).stores({
      works:
        'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus',
      releaseRecords:
        'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
      syncQueue:
        'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
      appMeta: 'key',
    });

    this.version(4)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table<WorkRecord, string>('works')
          .toCollection()
          .modify((work) => {
            if (!Array.isArray(work.personalTags)) {
              work.personalTags = [];
            }
          }),
      );

    this.version(5)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table<WorkRecord, string>('works')
          .toCollection()
          .modify((work) => {
            work.startedAt ??= null;
            work.completedAt ??= null;
            work.droppedAt ??= null;
            work.lastConsumedAt ??= null;
          }),
      );

    this.version(6)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table<SyncQueueItemRecord, string>('syncQueue')
          .toCollection()
          .modify((item) => {
            item.source ??= 'unknown';
          }),
      );

    this.version(7)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus, _deletedAtScope, *personalTags, [deletedAt+updatedAt], [deletedAt+status], [deletedAt+type], [_deletedAtScope+updatedAt], [_deletedAtScope+status], [_deletedAtScope+type]',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table<WorkRecord & { _deletedAtScope?: string }, string>('works')
          .toCollection()
          .modify((work) => {
            work._deletedAtScope =
              work.deletedAt === null ? 'active' : 'deleted';
          }),
      );

    this.version(8).stores({
      works:
        'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus, _deletedAtScope, *personalTags, [deletedAt+updatedAt], [deletedAt+status], [deletedAt+type], [_deletedAtScope+updatedAt], [_deletedAtScope+status], [_deletedAtScope+type]',
      releaseRecords:
        'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
      timelineEntries:
        'id, workId, type, occurredAt, deletedAt, [workId+occurredAt], [deletedAt+occurredAt]',
      syncQueue:
        'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
      appMeta: 'key',
    });

    this.version(9)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus, _deletedAtScope, *personalTags, [deletedAt+updatedAt], [deletedAt+status], [deletedAt+type], [_deletedAtScope+updatedAt], [_deletedAtScope+status], [_deletedAtScope+type]',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        timelineEntries:
          'id, workId, type, occurredAt, deletedAt, syncStatus, [workId+occurredAt], [deletedAt+occurredAt]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table<TimelineEntryRecord, string>('timelineEntries')
          .toCollection()
          .modify((entry) => {
            entry.syncStatus ??= 'local-only';
            entry.serverVersion ??= 0;
          }),
      );

    this.version(10)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus, _deletedAtScope, *personalTags, [deletedAt+updatedAt], [deletedAt+status], [deletedAt+type], [_deletedAtScope+updatedAt], [_deletedAtScope+status], [_deletedAtScope+type]',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        timelineEntries:
          'id, workId, type, occurredAt, deletedAt, syncStatus, [workId+occurredAt], [deletedAt+occurredAt]',
        series:
          'id, kind, normalizedTitle, parentId, updatedAt, deletedAt, syncStatus, [kind+normalizedTitle]',
        workSeriesLinks:
          'id, workId, seriesId, role, updatedAt, deletedAt, syncStatus, [workId+seriesId+role], [workId+deletedAt], [seriesId+deletedAt]',
        contributors:
          'id, entityType, normalizedName, updatedAt, deletedAt, syncStatus, [entityType+normalizedName]',
        workContributors:
          'id, workId, contributorId, role, updatedAt, deletedAt, syncStatus, [workId+contributorId+role], [workId+deletedAt], [contributorId+deletedAt]',
        workRelations:
          'id, sourceWorkId, targetWorkId, relationType, updatedAt, deletedAt, syncStatus, [sourceWorkId+targetWorkId+relationType], [sourceWorkId+deletedAt], [targetWorkId+deletedAt]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) => migratePrefixedTagsToGraph(transaction));

    this.version(11)
      .stores({
        works:
          'id, type, title, author, status, rating, updatedAt, deletedAt, syncStatus, _deletedAtScope, *personalTags, [deletedAt+updatedAt], [deletedAt+status], [deletedAt+type], [_deletedAtScope+updatedAt], [_deletedAtScope+status], [_deletedAtScope+type]',
        releaseRecords:
          'id, userWorkRecordId, catalogReleaseId, status, updatedAt, deletedAt, syncStatus, [userWorkRecordId+catalogReleaseId]',
        timelineEntries:
          'id, workId, type, occurredAt, deletedAt, syncStatus, [workId+occurredAt], [deletedAt+occurredAt]',
        series:
          'id, kind, normalizedTitle, parentId, updatedAt, deletedAt, syncStatus, [kind+normalizedTitle]',
        workSeriesLinks:
          'id, workId, seriesId, role, updatedAt, deletedAt, syncStatus, [workId+seriesId+role], [workId+deletedAt], [seriesId+deletedAt]',
        contributors:
          'id, entityType, normalizedName, updatedAt, deletedAt, syncStatus, [entityType+normalizedName]',
        workContributors:
          'id, workId, contributorId, role, updatedAt, deletedAt, syncStatus, [workId+contributorId+role], [workId+deletedAt], [contributorId+deletedAt]',
        workRelations:
          'id, sourceWorkId, targetWorkId, relationType, updatedAt, deletedAt, syncStatus, [sourceWorkId+targetWorkId+relationType], [sourceWorkId+deletedAt], [targetWorkId+deletedAt]',
        syncQueue:
          'id, entityType, entityId, operation, createdAt, retryCount, [entityType+entityId]',
        appMeta: 'key',
      })
      .upgrade((transaction) => migratePausedStatusToDropped(transaction));
  }
}

const GRAPH_TAG_KINDS = new Set([
  'series',
  'universe',
  'creator',
  'studio',
  'publisher',
  'platform',
] satisfies GraphTagKind[]);

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

function createQueueItem<TPayload extends WorkRecord | SeriesRecord | WorkSeriesLinkRecord | ContributorRecord | WorkContributorRecord>(
  entityType: SyncQueueItemRecord<TPayload>['entityType'],
  payload: TPayload,
  createdAt: string,
): SyncQueueItemRecord<TPayload> {
  return {
    id: crypto.randomUUID(),
    entityType,
    entityId: payload.id,
    operation: payload.serverVersion === 0 ? 'create' : 'update',
    payload,
    source: 'archive_migration',
    createdAt,
    retryCount: 0,
    lastError: null,
    conflict: null,
  };
}

async function replaceQueuedEntity<TPayload extends WorkRecord | SeriesRecord | WorkSeriesLinkRecord | ContributorRecord | WorkContributorRecord>(
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

async function migratePrefixedTagsToGraph(transaction: Transaction) {
  const worksTable = transaction.table<WorkRecord & { _deletedAtScope?: string }, string>('works');
  const seriesTable = transaction.table<SeriesRecord, string>('series');
  const workSeriesLinksTable = transaction.table<WorkSeriesLinkRecord, string>('workSeriesLinks');
  const contributorsTable = transaction.table<ContributorRecord, string>('contributors');
  const workContributorsTable = transaction.table<WorkContributorRecord, string>('workContributors');
  const syncQueueTable = transaction.table<SyncQueueItemRecord, string>('syncQueue');
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

async function migratePausedStatusToDropped(transaction: Transaction) {
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
    .table<
      SyncQueueItemRecord & { payload?: { status?: string } },
      string
    >('syncQueue')
    .toCollection()
    .modify((item) => {
      if (
        (item.entityType === 'work' || item.entityType === 'release_record') &&
        item.payload?.status === 'paused'
      ) {
        item.payload.status = 'dropped';
      }
    });
}

function registerDatabaseName(name: string) {
  knownDatabaseNames.add(name);

  return name;
}

export function getWorkArchiveDbName(scope: ArchiveScope) {
  return scope.kind === 'guest'
    ? DEFAULT_DB_NAME
    : `work-archive-db-user-${scope.userId}`;
}

export function createWorkArchiveDb(name = DEFAULT_DB_NAME) {
  const database = new WorkArchiveDatabase(registerDatabaseName(name));

  knownDatabaseInstances.add(database);

  return database;
}

class WorkArchiveDbManager {
  private currentScope: ArchiveScope = {
    kind: 'guest',
  };

  private currentDb = createWorkArchiveDb();

  getCurrentDb() {
    return this.currentDb;
  }

  getCurrentScopeKey() {
    return getWorkArchiveDbName(this.currentScope);
  }

  switchToGuest() {
    this.switchScope({
      kind: 'guest',
    });
  }

  switchToUser(userId: string) {
    this.switchScope({
      kind: 'user',
      userId,
    });
  }

  reset() {
    this.currentDb.close();
    this.currentScope = {
      kind: 'guest',
    };
    this.currentDb = createWorkArchiveDb();
  }

  private switchScope(nextScope: ArchiveScope) {
    const nextDatabaseName = getWorkArchiveDbName(nextScope);

    if (this.currentDb.name === nextDatabaseName) {
      this.currentScope = nextScope;

      return;
    }

    this.currentDb.close();
    this.currentScope = nextScope;
    this.currentDb = createWorkArchiveDb(nextDatabaseName);
  }
}

export const workArchiveDbManager = new WorkArchiveDbManager();

export function getWorkArchiveDb() {
  return workArchiveDbManager.getCurrentDb();
}

export async function clearWorkArchiveDb(db = getWorkArchiveDb()) {
  await db.transaction(
    'rw',
    [
      db.works,
      db.releaseRecords,
      db.timelineEntries,
      db.series,
      db.workSeriesLinks,
      db.contributors,
      db.workContributors,
      db.workRelations,
      db.syncQueue,
      db.appMeta,
    ],
    async () => {
      await db.works.clear();
      await db.releaseRecords.clear();
      await db.timelineEntries.clear();
      await db.series.clear();
      await db.workSeriesLinks.clear();
      await db.contributors.clear();
      await db.workContributors.clear();
      await db.workRelations.clear();
      await db.syncQueue.clear();
      await db.appMeta.clear();
    },
  );
}

export async function resetWorkArchiveStorage() {
  const databaseNames = [...knownDatabaseNames];

  for (const database of knownDatabaseInstances) {
    database.close();
  }

  for (const databaseName of databaseNames) {
    const database = new WorkArchiveDatabase(databaseName);

    database.close();
    await database.delete();
  }

  knownDatabaseNames.clear();
  knownDatabaseInstances.clear();
  workArchiveDbManager.reset();
}
