import type {
  AppMetaRecord,
  SyncQueueItemRecord,
  SyncOperation,
  UserReleaseRecord,
  WorkRecord,
} from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../../works/db/work-archive.db';

const ARCHIVE_FORMAT = 'work-archive.local-archive';
const ARCHIVE_VERSION = 1;
const ARCHIVE_SCHEMA_VERSION = 1;
const ARCHIVE_SOURCE = 'work-archive-web';
const BACKUP_EXCLUSIONS = [
  'syncQueue',
  'authTokens',
  'refreshCookie',
  'providerApiKeys',
];

type DatabaseResolver = () => WorkArchiveDatabase;

export interface LocalArchiveExport {
  appMeta: AppMetaRecord[];
  backupExclusions: string[];
  exportedAt: string;
  format: typeof ARCHIVE_FORMAT;
  releaseRecords: UserReleaseRecord[];
  schemaVersion: typeof ARCHIVE_SCHEMA_VERSION;
  source: typeof ARCHIVE_SOURCE;
  version: typeof ARCHIVE_VERSION;
  works: WorkRecord[];
}

export interface LocalArchiveImportPreview {
  addReleaseRecordCount: number;
  addWorkCount: number;
  conflictWorkCount: number;
  duplicateTitleCount: number;
  duplicateWorkCount: number;
  idCollisionCount: number;
  releaseRecordCount: number;
  skippedReleaseRecordCount: number;
  skippedWorkCount: number;
  updateWorkCount: number;
  workCount: number;
}

export interface LocalArchiveImportResult extends LocalArchiveImportPreview {
  importedReleaseRecordCount: number;
  importedWorkCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/[^0-9a-z가-힣]+/g, '');
}

function createTitleDuplicateKey(work: Pick<WorkRecord, 'title' | 'type'>) {
  return `${work.type}:${normalizeTitle(work.title)}`;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      )
    : [];
}

function normalizeArchiveWork(work: WorkRecord): WorkRecord {
  return {
    ...work,
    startedAt: work.startedAt ?? null,
    completedAt: work.completedAt ?? null,
    droppedAt: work.droppedAt ?? null,
    lastConsumedAt: work.lastConsumedAt ?? null,
    genres: normalizeStringArray(work.genres),
    personalTags: normalizeStringArray(
      (work as Partial<WorkRecord>).personalTags,
    ),
  };
}

function stripLocalOnlyWorkFields(
  work: WorkRecord & { _deletedAtScope?: unknown },
): WorkRecord {
  const { _deletedAtScope: _localOnlyIndex, ...archiveWork } = work;

  return normalizeArchiveWork(archiveWork);
}

function prepareImportedWorkForStorage(work: WorkRecord) {
  return {
    ...work,
    _deletedAtScope: work.deletedAt === null ? 'active' : 'deleted',
  };
}

function cloneWorkForImport(work: WorkRecord, id: string): WorkRecord {
  const normalizedWork = normalizeArchiveWork(work);

  return {
    ...normalizedWork,
    genres: [...normalizedWork.genres],
    personalTags: [...normalizedWork.personalTags],
    id,
    importDraft: normalizedWork.importDraft
      ? { ...normalizedWork.importDraft }
      : null,
    serverVersion: 0,
    syncStatus: 'local-only',
  };
}

function cloneReleaseRecordForImport(
  releaseRecord: UserReleaseRecord,
  id: string,
  userWorkRecordId: string,
): UserReleaseRecord {
  return {
    ...releaseRecord,
    id,
    serverVersion: 0,
    syncStatus: 'local-only',
    userWorkRecordId,
  };
}

function parseArchive(rawValue: string): LocalArchiveExport {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new Error('JSON 백업 파일을 읽지 못했습니다.');
  }

  if (
    !isRecord(parsedValue) ||
    parsedValue.format !== ARCHIVE_FORMAT ||
    parsedValue.version !== ARCHIVE_VERSION ||
    !Array.isArray(parsedValue.works) ||
    !Array.isArray(parsedValue.releaseRecords)
  ) {
    throw new Error('Work Archive JSON 백업 파일 형식이 아닙니다.');
  }

  return {
    appMeta: Array.isArray(parsedValue.appMeta)
      ? (parsedValue.appMeta as AppMetaRecord[])
      : [],
    backupExclusions: Array.isArray(parsedValue.backupExclusions)
      ? normalizeStringArray(parsedValue.backupExclusions)
      : [...BACKUP_EXCLUSIONS],
    exportedAt:
      typeof parsedValue.exportedAt === 'string'
        ? parsedValue.exportedAt
        : new Date().toISOString(),
    format: ARCHIVE_FORMAT,
    releaseRecords: parsedValue.releaseRecords as UserReleaseRecord[],
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    source: ARCHIVE_SOURCE,
    version: ARCHIVE_VERSION,
    works: (parsedValue.works as WorkRecord[]).map(normalizeArchiveWork),
  };
}

function escapeCsvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function createCsvRows(works: WorkRecord[]) {
  const header = [
    'title',
    'type',
    'status',
    'rating',
    'personalTags',
    'shortReview',
    'review',
    'progress',
    'startedAt',
    'completedAt',
    'droppedAt',
    'lastConsumedAt',
    'favorite',
    'tier',
    'updatedAt',
  ];
  const rows = works.map((work) => {
    const progress = [
      work.progressCurrent ?? '',
      work.progressTotal ?? '',
      work.progressUnit ?? '',
      work.lastConsumedLabel ?? '',
    ]
      .filter((part) => String(part).trim() !== '')
      .join(' / ');

    return [
      work.title,
      work.type,
      work.status,
      work.rating ?? '',
      work.personalTags.join('; '),
      work.shortReview,
      work.review,
      progress,
      work.startedAt ?? '',
      work.completedAt ?? '',
      work.droppedAt ?? '',
      work.lastConsumedAt ?? '',
      work.favorite ? 'true' : 'false',
      work.tier ?? '',
      work.updatedAt,
    ];
  });

  return [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
}

function createQueueItem<TPayload extends WorkRecord | UserReleaseRecord>(
  entityType: SyncQueueItemRecord<TPayload>['entityType'],
  entityId: string,
  operation: SyncOperation,
  payload: TPayload,
): SyncQueueItemRecord<TPayload> {
  return {
    createdAt: new Date().toISOString(),
    entityId,
    entityType,
    id: crypto.randomUUID(),
    lastError: null,
    operation,
    payload,
    retryCount: 0,
    source: 'archive_migration',
  };
}

export class LocalArchiveService {
  constructor(private readonly getDb: DatabaseResolver = getWorkArchiveDb) {}

  async createJsonExport(): Promise<LocalArchiveExport> {
    const db = this.getDb();
    const [works, releaseRecords, appMeta] = await Promise.all([
      db.works.toArray(),
      db.releaseRecords.toArray(),
      db.appMeta.toArray(),
    ]);

    return {
      appMeta,
      backupExclusions: [...BACKUP_EXCLUSIONS],
      exportedAt: new Date().toISOString(),
      format: ARCHIVE_FORMAT,
      releaseRecords,
      schemaVersion: ARCHIVE_SCHEMA_VERSION,
      source: ARCHIVE_SOURCE,
      version: ARCHIVE_VERSION,
      works: works.map(stripLocalOnlyWorkFields),
    };
  }

  async createJsonExportText() {
    return JSON.stringify(await this.createJsonExport(), null, 2);
  }

  async createCsvExportText() {
    const works = await this.getDb()
      .works.filter((work) => work.deletedAt === null)
      .toArray();

    return createCsvRows(works);
  }

  async dryRunImport(rawValue: string): Promise<LocalArchiveImportPreview> {
    const archive = parseArchive(rawValue);
    const db = this.getDb();
    const existingWorks = await db.works.toArray();
    const existingIds = new Set(existingWorks.map((work) => work.id));
    const existingTitleKeys = new Set(
      existingWorks
        .filter((work) => work.deletedAt === null)
        .map(createTitleDuplicateKey),
    );
    const importedWorkIds = new Set(archive.works.map((work) => work.id));
    const releaseRecordCount = archive.releaseRecords.filter((releaseRecord) =>
      importedWorkIds.has(releaseRecord.userWorkRecordId),
    ).length;

    const duplicateTitleCount = archive.works.filter(
      (work) =>
        work.deletedAt === null &&
        existingTitleKeys.has(createTitleDuplicateKey(work)),
    ).length;
    const idCollisionCount = archive.works.filter((work) =>
      existingIds.has(work.id),
    ).length;

    return {
      addReleaseRecordCount: releaseRecordCount,
      addWorkCount: archive.works.length,
      conflictWorkCount: idCollisionCount,
      duplicateTitleCount,
      duplicateWorkCount: duplicateTitleCount,
      idCollisionCount,
      releaseRecordCount,
      skippedReleaseRecordCount:
        archive.releaseRecords.length - releaseRecordCount,
      skippedWorkCount: 0,
      updateWorkCount: 0,
      workCount: archive.works.length,
    };
  }

  async previewImport(rawValue: string): Promise<LocalArchiveImportPreview> {
    return this.dryRunImport(rawValue);
  }

  async importJson(rawValue: string): Promise<LocalArchiveImportResult> {
    const archive = parseArchive(rawValue);
    const preview = await this.previewImport(rawValue);
    const db = this.getDb();
    const existingWorkIds = new Set(
      (await db.works.toArray()).map((work) => work.id),
    );
    const existingReleaseRecordIds = new Set(
      (await db.releaseRecords.toArray()).map((record) => record.id),
    );
    const usedWorkIds = new Set(existingWorkIds);
    const usedReleaseRecordIds = new Set(existingReleaseRecordIds);
    const workIdMap = new Map<string, string>();
    const worksToImport = archive.works.map((work) => {
      let nextId = work.id;

      if (usedWorkIds.has(nextId)) {
        nextId = crypto.randomUUID();
      }

      usedWorkIds.add(nextId);
      workIdMap.set(work.id, nextId);

      return cloneWorkForImport(work, nextId);
    });
    const worksToImportById = new Map(
      worksToImport.map((work) => [work.id, work]),
    );
    const releaseRecordsToImport = archive.releaseRecords.flatMap(
      (releaseRecord) => {
        const mappedWorkId = workIdMap.get(releaseRecord.userWorkRecordId);

        if (!mappedWorkId) {
          return [];
        }

        let nextId = releaseRecord.id;

        if (usedReleaseRecordIds.has(nextId)) {
          nextId = crypto.randomUUID();
        }

        usedReleaseRecordIds.add(nextId);

        return [
          cloneReleaseRecordForImport(releaseRecord, nextId, mappedWorkId),
        ];
      },
    );

    await db.transaction(
      'rw',
      db.works,
      db.releaseRecords,
      db.syncQueue,
      async () => {
        await db.works.bulkPut(worksToImport.map(prepareImportedWorkForStorage));
        await db.releaseRecords.bulkPut(releaseRecordsToImport);

        for (const work of worksToImport) {
          if (work.deletedAt !== null) {
            continue;
          }

          await db.syncQueue.add(
            createQueueItem('work', work.id, 'create', {
              ...work,
              genres: [...work.genres],
              personalTags: [...work.personalTags],
            }),
          );
        }

        for (const releaseRecord of releaseRecordsToImport) {
          if (releaseRecord.deletedAt !== null) {
            continue;
          }

          if (
            worksToImportById.get(releaseRecord.userWorkRecordId)?.deletedAt !==
            null
          ) {
            continue;
          }

          await db.syncQueue.add(
            createQueueItem('release_record', releaseRecord.id, 'create', {
              ...releaseRecord,
            }),
          );
        }
      },
    );

    return {
      ...preview,
      importedReleaseRecordCount: releaseRecordsToImport.length,
      importedWorkCount: worksToImport.length,
    };
  }
}

export const localArchiveService = new LocalArchiveService();
