import type {
  ContributorEntityType,
  ContributorRecord,
  SeriesKind,
  SeriesRecord,
  SyncEntityType,
  SyncQueueSource,
  WorkContributorRecord,
  WorkContributorRole,
  WorkRelationRecord,
  WorkRelationType,
  WorkSeriesLinkRecord,
  WorkSeriesRole,
  WorkSyncStatus,
} from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';
import {
  syncQueueRepository,
  type SyncQueueRepository,
} from '../../sync/services/sync-queue.repository';

type DatabaseResolver = () => WorkArchiveDatabase;

export interface WorkGraphSeriesInput {
  kind: SeriesKind;
  orderIndex?: number | null;
  orderLabel?: string;
  role?: WorkSeriesRole;
  title: string;
}

export interface WorkGraphContributorInput {
  displayOrder?: number;
  entityType: ContributorEntityType;
  name: string;
  role: WorkContributorRole;
}

export interface WorkGraphRelationInput {
  note?: string;
  relationType: WorkRelationType;
  targetWorkId: string;
}

export interface WorkGraphInput {
  contributors: WorkGraphContributorInput[];
  relations?: WorkGraphRelationInput[];
  series: WorkGraphSeriesInput[];
}

export interface WorkGraphSnapshot {
  contributors: ContributorRecord[];
  relations: WorkRelationRecord[];
  series: SeriesRecord[];
  workContributors: WorkContributorRecord[];
  workRelations: WorkRelationRecord[];
  workSeriesLinks: WorkSeriesLinkRecord[];
}

const MANAGED_SERIES_KINDS = new Set<SeriesKind>(['series', 'universe']);
const MANAGED_CONTRIBUTOR_ROLES = new Set<WorkContributorRole>([
  'original_creator',
  'studio',
  'publisher',
  'platform',
]);

function nowIso() {
  return new Date().toISOString();
}

export function normalizeGraphName(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export function normalizeGraphKey(value: string) {
  return normalizeGraphName(value).toLowerCase();
}

function isActive(record: { deletedAt: string | null }) {
  return record.deletedAt === null;
}

function getNextSyncStatus(serverVersion: number): WorkSyncStatus {
  return serverVersion > 0 ? 'pending' : 'local-only';
}

function dedupeByKey<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getKey(item);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

export class GraphRepository {
  constructor(
    private readonly getDb: DatabaseResolver = getWorkArchiveDb,
    private readonly queueRepository: SyncQueueRepository = syncQueueRepository,
  ) {}

  async listActiveGraph(): Promise<WorkGraphSnapshot> {
    const db = this.getDb();
    const [
      series,
      workSeriesLinks,
      contributors,
      workContributors,
      workRelations,
    ] = await Promise.all([
      db.series.toArray(),
      db.workSeriesLinks.toArray(),
      db.contributors.toArray(),
      db.workContributors.toArray(),
      db.workRelations.toArray(),
    ]);

    return {
      contributors: contributors.filter(isActive),
      relations: workRelations.filter(isActive),
      series: series.filter(isActive),
      workContributors: workContributors.filter(isActive),
      workRelations: workRelations.filter(isActive),
      workSeriesLinks: workSeriesLinks.filter(isActive),
    };
  }

  async getWorkGraph(workId: string): Promise<WorkGraphSnapshot> {
    const db = this.getDb();
    const [allWorkSeriesLinks, allWorkContributors, allWorkRelations] =
      await Promise.all([
        db.workSeriesLinks.toArray(),
        db.workContributors.toArray(),
        db.workRelations.toArray(),
      ]);
    const workSeriesLinks = allWorkSeriesLinks.filter(
      (link) => link.workId === workId && isActive(link),
    );
    const workContributors = allWorkContributors.filter(
      (link) => link.workId === workId && isActive(link),
    );
    const workRelations = allWorkRelations.filter(
      (relation) => relation.sourceWorkId === workId && isActive(relation),
    );
    const activeTargetRelations = allWorkRelations.filter(
      (relation) => relation.targetWorkId === workId && isActive(relation),
    );
    const [series, contributors] = await Promise.all([
      db.series.bulkGet(workSeriesLinks.map((link) => link.seriesId)),
      db.contributors.bulkGet(workContributors.map((link) => link.contributorId)),
    ]);

    return {
      contributors: contributors.filter((entry): entry is ContributorRecord =>
        Boolean(entry),
      ),
      relations: [...workRelations, ...activeTargetRelations],
      series: series.filter((entry): entry is SeriesRecord => Boolean(entry)),
      workContributors,
      workRelations,
      workSeriesLinks,
    };
  }

  async saveWorkGraph(
    workId: string,
    input: WorkGraphInput,
    source: SyncQueueSource,
  ) {
    const db = this.getDb();
    const timestamp = nowIso();

    return db.transaction(
      'rw',
      [
        db.series,
        db.workSeriesLinks,
        db.contributors,
        db.workContributors,
        db.workRelations,
        db.syncQueue,
      ],
      async () => {
        await this.replaceSeriesLinks(workId, input.series, source, timestamp);
        await this.replaceContributorLinks(
          workId,
          input.contributors,
          source,
          timestamp,
        );

        if (input.relations) {
          await this.replaceOutgoingRelations(
            workId,
            input.relations,
            source,
            timestamp,
          );
        }
      },
    );
  }

  async bulkPutSeries(records: SeriesRecord[]) {
    if (records.length > 0) {
      await this.getDb().series.bulkPut(records);
    }
  }

  async bulkPutContributors(records: ContributorRecord[]) {
    if (records.length > 0) {
      await this.getDb().contributors.bulkPut(records);
    }
  }

  async bulkPutWorkSeriesLinks(records: WorkSeriesLinkRecord[]) {
    if (records.length > 0) {
      await this.getDb().workSeriesLinks.bulkPut(records);
    }
  }

  async bulkPutWorkContributors(records: WorkContributorRecord[]) {
    if (records.length > 0) {
      await this.getDb().workContributors.bulkPut(records);
    }
  }

  async bulkPutWorkRelations(records: WorkRelationRecord[]) {
    if (records.length > 0) {
      await this.getDb().workRelations.bulkPut(records);
    }
  }

  async getEntity(entityType: SyncEntityType, id: string) {
    const db = this.getDb();

    if (entityType === 'series') return db.series.get(id);
    if (entityType === 'contributor') return db.contributors.get(id);
    if (entityType === 'work_series_link') return db.workSeriesLinks.get(id);
    if (entityType === 'work_contributor') return db.workContributors.get(id);
    if (entityType === 'work_relation') return db.workRelations.get(id);

    return null;
  }

  async putEntity(
    entity:
      | SeriesRecord
      | ContributorRecord
      | WorkSeriesLinkRecord
      | WorkContributorRecord
      | WorkRelationRecord,
  ) {
    const db = this.getDb();

    if ('normalizedTitle' in entity) return db.series.put(entity);
    if ('normalizedName' in entity) return db.contributors.put(entity);
    if ('seriesId' in entity) return db.workSeriesLinks.put(entity);
    if ('contributorId' in entity) return db.workContributors.put(entity);

    return db.workRelations.put(entity);
  }

  async markSyncStatus(
    entityType: SyncEntityType,
    id: string,
    syncStatus: WorkSyncStatus,
  ) {
    const entity = await this.getEntity(entityType, id);

    if (!entity || entity.syncStatus === syncStatus) {
      return;
    }

    await this.putEntity({
      ...entity,
      syncStatus,
    } as never);
  }

  private async replaceSeriesLinks(
    workId: string,
    input: WorkGraphSeriesInput[],
    source: SyncQueueSource,
    timestamp: string,
  ) {
    const db = this.getDb();
    const normalizedInput = dedupeByKey(
      input
        .map((entry) => ({
          ...entry,
          role: entry.role ?? 'main',
          title: normalizeGraphName(entry.title),
        }))
        .filter((entry) => entry.title),
      (entry) => `${entry.kind}:${normalizeGraphKey(entry.title)}:${entry.role}`,
    );
    const desiredLinks = new Set<string>();

    for (const entry of normalizedInput) {
      const series = await this.findOrCreateSeries(entry, source, timestamp);
      const linkKey = `${series.id}:${entry.role}`;

      desiredLinks.add(linkKey);
      const existing = (await db.workSeriesLinks.toArray()).find(
        (link) =>
          link.workId === workId &&
          link.seriesId === series.id &&
          link.role === entry.role,
      );
      const nextLink: WorkSeriesLinkRecord = existing
        ? {
            ...existing,
            orderIndex: entry.orderIndex ?? null,
            orderLabel: entry.orderLabel?.trim() ?? '',
            deletedAt: null,
            syncStatus: getNextSyncStatus(existing.serverVersion),
            updatedAt: timestamp,
          }
        : {
            id: crypto.randomUUID(),
            workId,
            seriesId: series.id,
            role: entry.role,
            orderIndex: entry.orderIndex ?? null,
            orderLabel: entry.orderLabel?.trim() ?? '',
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
            syncStatus: 'local-only',
            serverVersion: 0,
          };

      await db.workSeriesLinks.put(nextLink);
      await this.queueRepository.enqueueEntityChange(
        'work_series_link',
        nextLink,
        existing ? 'update' : 'create',
        nextLink,
        source,
      );
    }

    const existingLinks = (await db.workSeriesLinks.toArray()).filter(
      (link) => link.workId === workId && isActive(link),
    );
    const linkedSeries = await db.series.bulkGet(
      existingLinks.map((link) => link.seriesId),
    );
    const seriesById = new Map(
      linkedSeries
        .filter((entry): entry is SeriesRecord => Boolean(entry))
        .map((entry) => [entry.id, entry]),
    );

    for (const link of existingLinks) {
      const series = seriesById.get(link.seriesId);

      if (!series || !MANAGED_SERIES_KINDS.has(series.kind)) {
        continue;
      }

      if (desiredLinks.has(`${link.seriesId}:${link.role}`)) {
        continue;
      }

      const deletedLink: WorkSeriesLinkRecord = {
        ...link,
        deletedAt: timestamp,
        syncStatus: getNextSyncStatus(link.serverVersion),
        updatedAt: timestamp,
      };

      await db.workSeriesLinks.put(deletedLink);
      await this.queueRepository.enqueueEntityChange(
        'work_series_link',
        deletedLink,
        'delete',
        deletedLink,
        source,
      );
    }
  }

  private async findOrCreateSeries(
    input: WorkGraphSeriesInput,
    source: SyncQueueSource,
    timestamp: string,
  ) {
    const db = this.getDb();
    const normalizedTitle = normalizeGraphKey(input.title);
    const existing = (await db.series.toArray()).find(
      (series) =>
        series.kind === input.kind && series.normalizedTitle === normalizedTitle,
    );

    if (existing) {
      if (isActive(existing)) {
        return existing;
      }

      const restored: SeriesRecord = {
        ...existing,
        deletedAt: null,
        syncStatus: getNextSyncStatus(existing.serverVersion),
        updatedAt: timestamp,
      };

      await db.series.put(restored);
      await this.queueRepository.enqueueEntityChange(
        'series',
        restored,
        'update',
        restored,
        source,
      );

      return restored;
    }

    const series: SeriesRecord = {
      id: crypto.randomUUID(),
      title: input.title,
      normalizedTitle,
      aliases: [],
      kind: input.kind,
      parentId: null,
      description: '',
      thumbnailUrl: '',
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    };

    await db.series.add(series);
    await this.queueRepository.enqueueEntityChange(
      'series',
      series,
      'create',
      series,
      source,
    );

    return series;
  }

  private async replaceContributorLinks(
    workId: string,
    input: WorkGraphContributorInput[],
    source: SyncQueueSource,
    timestamp: string,
  ) {
    const db = this.getDb();
    const normalizedInput = dedupeByKey(
      input
        .map((entry) => ({
          ...entry,
          name: normalizeGraphName(entry.name),
        }))
        .filter((entry) => entry.name),
      (entry) =>
        `${entry.entityType}:${normalizeGraphKey(entry.name)}:${entry.role}`,
    );
    const desiredLinks = new Set<string>();

    for (const entry of normalizedInput) {
      const contributor = await this.findOrCreateContributor(
        entry,
        source,
        timestamp,
      );
      const linkKey = `${contributor.id}:${entry.role}`;

      desiredLinks.add(linkKey);
      const existing = (await db.workContributors.toArray()).find(
        (link) =>
          link.workId === workId &&
          link.contributorId === contributor.id &&
          link.role === entry.role,
      );
      const nextLink: WorkContributorRecord = existing
        ? {
            ...existing,
            displayOrder: entry.displayOrder ?? 0,
            deletedAt: null,
            syncStatus: getNextSyncStatus(existing.serverVersion),
            updatedAt: timestamp,
          }
        : {
            id: crypto.randomUUID(),
            workId,
            contributorId: contributor.id,
            role: entry.role,
            displayOrder: entry.displayOrder ?? 0,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
            syncStatus: 'local-only',
            serverVersion: 0,
          };

      await db.workContributors.put(nextLink);
      await this.queueRepository.enqueueEntityChange(
        'work_contributor',
        nextLink,
        existing ? 'update' : 'create',
        nextLink,
        source,
      );
    }

    const existingLinks = (await db.workContributors.toArray()).filter(
      (link) => link.workId === workId && isActive(link),
    );

    for (const link of existingLinks) {
      if (!MANAGED_CONTRIBUTOR_ROLES.has(link.role)) {
        continue;
      }

      if (desiredLinks.has(`${link.contributorId}:${link.role}`)) {
        continue;
      }

      const deletedLink: WorkContributorRecord = {
        ...link,
        deletedAt: timestamp,
        syncStatus: getNextSyncStatus(link.serverVersion),
        updatedAt: timestamp,
      };

      await db.workContributors.put(deletedLink);
      await this.queueRepository.enqueueEntityChange(
        'work_contributor',
        deletedLink,
        'delete',
        deletedLink,
        source,
      );
    }
  }

  private async findOrCreateContributor(
    input: WorkGraphContributorInput,
    source: SyncQueueSource,
    timestamp: string,
  ) {
    const db = this.getDb();
    const normalizedName = normalizeGraphKey(input.name);
    const existing = (await db.contributors.toArray()).find(
      (contributor) =>
        contributor.entityType === input.entityType &&
        contributor.normalizedName === normalizedName,
    );

    if (existing) {
      if (isActive(existing)) {
        return existing;
      }

      const restored: ContributorRecord = {
        ...existing,
        deletedAt: null,
        syncStatus: getNextSyncStatus(existing.serverVersion),
        updatedAt: timestamp,
      };

      await db.contributors.put(restored);
      await this.queueRepository.enqueueEntityChange(
        'contributor',
        restored,
        'update',
        restored,
        source,
      );

      return restored;
    }

    const contributor: ContributorRecord = {
      id: crypto.randomUUID(),
      name: input.name,
      normalizedName,
      aliases: [],
      entityType: input.entityType,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    };

    await db.contributors.add(contributor);
    await this.queueRepository.enqueueEntityChange(
      'contributor',
      contributor,
      'create',
      contributor,
      source,
    );

    return contributor;
  }

  private async replaceOutgoingRelations(
    workId: string,
    input: WorkGraphRelationInput[],
    source: SyncQueueSource,
    timestamp: string,
  ) {
    const db = this.getDb();
    const normalizedInput = dedupeByKey(
      input.filter((entry) => entry.targetWorkId && entry.targetWorkId !== workId),
      (entry) => `${entry.targetWorkId}:${entry.relationType}`,
    );
    const desiredRelations = new Set<string>();

    for (const entry of normalizedInput) {
      desiredRelations.add(`${entry.targetWorkId}:${entry.relationType}`);
      const existing = (await db.workRelations.toArray()).find(
        (relation) =>
          relation.sourceWorkId === workId &&
          relation.targetWorkId === entry.targetWorkId &&
          relation.relationType === entry.relationType,
      );
      const nextRelation: WorkRelationRecord = existing
        ? {
            ...existing,
            note: entry.note?.trim() ?? '',
            deletedAt: null,
            syncStatus: getNextSyncStatus(existing.serverVersion),
            updatedAt: timestamp,
          }
        : {
            id: crypto.randomUUID(),
            sourceWorkId: workId,
            targetWorkId: entry.targetWorkId,
            relationType: entry.relationType,
            note: entry.note?.trim() ?? '',
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
            syncStatus: 'local-only',
            serverVersion: 0,
          };

      await db.workRelations.put(nextRelation);
      await this.queueRepository.enqueueEntityChange(
        'work_relation',
        nextRelation,
        existing ? 'update' : 'create',
        nextRelation,
        source,
      );
    }

    const existingRelations = (await db.workRelations.toArray()).filter(
      (relation) => relation.sourceWorkId === workId && isActive(relation),
    );

    for (const relation of existingRelations) {
      if (desiredRelations.has(`${relation.targetWorkId}:${relation.relationType}`)) {
        continue;
      }

      const deletedRelation: WorkRelationRecord = {
        ...relation,
        deletedAt: timestamp,
        syncStatus: getNextSyncStatus(relation.serverVersion),
        updatedAt: timestamp,
      };

      await db.workRelations.put(deletedRelation);
      await this.queueRepository.enqueueEntityChange(
        'work_relation',
        deletedRelation,
        'delete',
        deletedRelation,
        source,
      );
    }
  }
}

export const graphRepository = new GraphRepository();
