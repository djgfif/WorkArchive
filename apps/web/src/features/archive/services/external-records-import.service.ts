import type { WorkRecord, WorkStatus, WorkType } from '@work-archive/shared-types';

import type { ExternalImportEntry } from '@features/imports';

import { getWorkArchiveDb } from '../../works/storage';
import { createTitleDuplicateKey } from './local-archive-format';
import {
  localArchiveService,
  type LocalArchiveService,
} from './local-archive.service';
import {
  ARCHIVE_FORMAT,
  ARCHIVE_SCHEMA_VERSION,
  ARCHIVE_SOURCE,
  ARCHIVE_VERSION,
  BACKUP_EXCLUSIONS,
  type DatabaseResolver,
  type LocalArchiveExport,
} from './local-archive.types';

export interface ExternalImportPreview {
  duplicateCount: number;
  duplicateTitles: string[];
  newCount: number;
  statusCounts: Partial<Record<WorkStatus, number>>;
  totalCount: number;
  typeCounts: Partial<Record<WorkType, number>>;
  withCoverCount: number;
}

export interface ExternalImportApplyResult {
  importedCount: number;
  skippedDuplicateCount: number;
}

function toWorkRecord(entry: ExternalImportEntry, nowIso: string): WorkRecord {
  return {
    author: entry.author,
    catalogTitleId: null,
    completedAt: entry.status === 'completed' ? entry.completedAt : null,
    createdAt: nowIso,
    deletedAt: null,
    description: entry.description,
    droppedAt: entry.status === 'dropped' ? entry.completedAt : null,
    favorite: false,
    genres: [],
    id: crypto.randomUUID(),
    importDraft: null,
    lastConsumedAt: entry.completedAt ?? entry.startedAt,
    lastConsumedLabel: null,
    personalTags: [],
    progressCurrent: entry.progressCurrent,
    progressTotal: entry.progressTotal,
    progressUnit: entry.progressUnit,
    rating: entry.rating,
    review: entry.review,
    serialStatus: null,
    serverVersion: 0,
    shortReview: '',
    startedAt: entry.startedAt,
    status: entry.status,
    syncStatus: 'local-only',
    thumbnailUrl: entry.thumbnailUrl,
    title: entry.title,
    type: entry.type,
    updatedAt: nowIso,
  };
}

export function buildExternalImportArchive(
  entries: ExternalImportEntry[],
  nowIso = new Date().toISOString(),
): LocalArchiveExport {
  return {
    appMeta: [],
    backupExclusions: [...BACKUP_EXCLUSIONS],
    exportedAt: nowIso,
    format: ARCHIVE_FORMAT,
    releaseRecords: [],
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    scope: 'simple',
    source: ARCHIVE_SOURCE,
    timelineEntries: [],
    version: ARCHIVE_VERSION,
    works: entries.map((entry) => toWorkRecord(entry, nowIso)),
  };
}

export class ExternalRecordsImportService {
  constructor(
    private readonly getDb: DatabaseResolver = getWorkArchiveDb,
    private readonly archiveService: LocalArchiveService = localArchiveService,
  ) {}

  private async getExistingTitleKeys() {
    const works = await this.getDb().works.toArray();

    return new Set(
      works
        .filter((work) => work.deletedAt === null)
        .map(createTitleDuplicateKey),
    );
  }

  async previewEntries(
    entries: ExternalImportEntry[],
  ): Promise<ExternalImportPreview> {
    const existingTitleKeys = await this.getExistingTitleKeys();
    const statusCounts: Partial<Record<WorkStatus, number>> = {};
    const typeCounts: Partial<Record<WorkType, number>> = {};
    const duplicateTitles: string[] = [];
    let withCoverCount = 0;

    for (const entry of entries) {
      statusCounts[entry.status] = (statusCounts[entry.status] ?? 0) + 1;
      typeCounts[entry.type] = (typeCounts[entry.type] ?? 0) + 1;

      if (entry.thumbnailUrl) {
        withCoverCount += 1;
      }

      if (existingTitleKeys.has(createTitleDuplicateKey(entry))) {
        duplicateTitles.push(entry.title);
      }
    }

    return {
      duplicateCount: duplicateTitles.length,
      duplicateTitles,
      newCount: entries.length - duplicateTitles.length,
      statusCounts,
      totalCount: entries.length,
      typeCounts,
      withCoverCount,
    };
  }

  async importEntries(
    entries: ExternalImportEntry[],
    options: { skipDuplicates?: boolean } = {},
  ): Promise<ExternalImportApplyResult> {
    const skipDuplicates = options.skipDuplicates ?? true;
    let entriesToImport = entries;
    let skippedDuplicateCount = 0;

    if (skipDuplicates) {
      const existingTitleKeys = await this.getExistingTitleKeys();
      entriesToImport = entries.filter(
        (entry) => !existingTitleKeys.has(createTitleDuplicateKey(entry)),
      );
      skippedDuplicateCount = entries.length - entriesToImport.length;
    }

    if (entriesToImport.length === 0) {
      return {
        importedCount: 0,
        skippedDuplicateCount,
      };
    }

    const archive = buildExternalImportArchive(entriesToImport);
    const result = await this.archiveService.importJson(
      JSON.stringify(archive),
    );

    return {
      importedCount: result.importedWorkCount,
      skippedDuplicateCount,
    };
  }
}

export const externalRecordsImportService = new ExternalRecordsImportService();
