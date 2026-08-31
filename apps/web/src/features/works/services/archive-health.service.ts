import {
  getDefaultProgressUnitForWorkType,
  type ProgressUnit,
  type WorkRecord,
  type WorkSyncStatus,
} from '@work-archive/shared-types';

import { appI18n } from '@app/i18n';
import {
  syncQueueRepository,
  type SyncQueueRepository,
} from '../../sync/queue';
import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';
import { worksRepository, type WorksRepository } from './works.repository';

export const ARCHIVE_HEALTH_FIX_HISTORY_META_KEY =
  'archive-health-fix-history-v1';
const ARCHIVE_HEALTH_FIX_HISTORY_LIMIT = 20;

export const ARCHIVE_HEALTH_ISSUE_CODES = [
  'invalid_date',
  'negative_progress',
  'progress_over_total',
  'started_after_completed',
  'started_after_dropped',
  'started_after_last_consumed',
  'completed_and_dropped',
  'completed_without_date',
  'dropped_without_date',
  'progress_unit_missing',
  'missing_thumbnail',
] as const;

export type ArchiveHealthIssueCode =
  (typeof ARCHIVE_HEALTH_ISSUE_CODES)[number];

export type ArchiveHealthIssueSeverity = 'attention' | 'review' | 'improvement';

export interface ArchiveHealthSafeFix {
  kind: 'set_progress_unit';
  progressUnit: ProgressUnit;
}

export interface ArchiveHealthIssue {
  code: ArchiveHealthIssueCode;
  details: Record<string, number | string>;
  id: string;
  severity: ArchiveHealthIssueSeverity;
  workId: string;
  workTitle: string;
  safeFix?: ArchiveHealthSafeFix;
}

export interface ArchiveHealthReport {
  affectedWorkCount: number;
  issueCounts: Record<ArchiveHealthIssueSeverity, number>;
  issues: ArchiveHealthIssue[];
  scannedAt: string;
  totalWorkCount: number;
}

export interface ArchiveHealthFixHistoryEntry {
  afterProgressUnit: ProgressUnit;
  appliedAt: string;
  beforeProgressUnit: null;
  id: string;
  kind: 'set_progress_unit';
  undoneAt: string | null;
  workId: string;
  workTitle: string;
}

interface ArchiveHealthFixHistoryState {
  entries: ArchiveHealthFixHistoryEntry[];
  version: 1;
}

type DatabaseResolver = () => WorkArchiveDatabase;

type WorkDateField =
  | 'startedAt'
  | 'completedAt'
  | 'droppedAt'
  | 'lastConsumedAt';

const DATE_FIELDS: WorkDateField[] = [
  'startedAt',
  'completedAt',
  'droppedAt',
  'lastConsumedAt',
];

const severityOrder: Record<ArchiveHealthIssueSeverity, number> = {
  attention: 0,
  review: 1,
  improvement: 2,
};

function createIssue(
  work: WorkRecord,
  code: ArchiveHealthIssueCode,
  severity: ArchiveHealthIssueSeverity,
  details: Record<string, number | string> = {},
  safeFix?: ArchiveHealthSafeFix,
): ArchiveHealthIssue {
  return {
    ...(safeFix ? { safeFix } : {}),
    code,
    details,
    id: `${work.id}:${code}:${String(details.field ?? '')}`,
    severity,
    workId: work.id,
    workTitle: work.title.trim() || work.id,
  };
}

function readDate(
  work: WorkRecord,
  field: WorkDateField,
  issues: ArchiveHealthIssue[],
) {
  const value = work[field];

  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    issues.push(
      createIssue(work, 'invalid_date', 'attention', {
        field,
        value,
      }),
    );

    return null;
  }

  return timestamp;
}

function hasProgress(work: WorkRecord) {
  return work.progressCurrent !== null && work.progressCurrent !== undefined
    ? true
    : work.progressTotal !== null && work.progressTotal !== undefined;
}

function checkProgress(
  work: WorkRecord,
  issues: ArchiveHealthIssue[],
  progressUnit: ProgressUnit | null | undefined,
) {
  const current = work.progressCurrent;
  const total = work.progressTotal;

  if (
    (current !== null && current !== undefined && current < 0) ||
    (total !== null && total !== undefined && total < 0)
  ) {
    issues.push(
      createIssue(work, 'negative_progress', 'attention', {
        current: current ?? '',
        total: total ?? '',
      }),
    );
  }

  if (
    current !== null &&
    current !== undefined &&
    total !== null &&
    total !== undefined &&
    current > total
  ) {
    issues.push(
      createIssue(work, 'progress_over_total', 'attention', {
        current,
        total,
      }),
    );
  }

  if (hasProgress(work) && !progressUnit) {
    const suggestedUnit = getDefaultProgressUnitForWorkType(work.type);

    issues.push(
      createIssue(
        work,
        'progress_unit_missing',
        'review',
        suggestedUnit ? { suggestedUnit } : {},
        suggestedUnit
          ? {
              kind: 'set_progress_unit',
              progressUnit: suggestedUnit,
            }
          : undefined,
      ),
    );
  }
}

function checkDates(work: WorkRecord, issues: ArchiveHealthIssue[]) {
  const timestamps = DATE_FIELDS.reduce<
    Partial<Record<WorkDateField, number | null>>
  >((result, field) => {
    result[field] = readDate(work, field, issues);

    return result;
  }, {});
  const startedAt = timestamps.startedAt;

  if (
    startedAt !== null &&
    startedAt !== undefined &&
    timestamps.completedAt !== null &&
    timestamps.completedAt !== undefined &&
    startedAt > timestamps.completedAt
  ) {
    issues.push(createIssue(work, 'started_after_completed', 'attention'));
  }

  if (
    startedAt !== null &&
    startedAt !== undefined &&
    timestamps.droppedAt !== null &&
    timestamps.droppedAt !== undefined &&
    startedAt > timestamps.droppedAt
  ) {
    issues.push(createIssue(work, 'started_after_dropped', 'attention'));
  }

  if (
    startedAt !== null &&
    startedAt !== undefined &&
    timestamps.lastConsumedAt !== null &&
    timestamps.lastConsumedAt !== undefined &&
    startedAt > timestamps.lastConsumedAt
  ) {
    issues.push(createIssue(work, 'started_after_last_consumed', 'attention'));
  }

  if (work.completedAt && work.droppedAt) {
    issues.push(createIssue(work, 'completed_and_dropped', 'review'));
  }

  if (work.status === 'completed' && !work.completedAt) {
    issues.push(createIssue(work, 'completed_without_date', 'review'));
  }

  if (work.status === 'dropped' && !work.droppedAt) {
    issues.push(createIssue(work, 'dropped_without_date', 'review'));
  }
}

export function buildArchiveHealthReport(
  works: WorkRecord[],
  scannedAt = new Date().toISOString(),
): ArchiveHealthReport {
  const issues = works.flatMap((work) => {
    const workIssues: ArchiveHealthIssue[] = [];

    checkProgress(work, workIssues, work.progressUnit);
    checkDates(work, workIssues);

    if (!work.thumbnailUrl.trim()) {
      workIssues.push(createIssue(work, 'missing_thumbnail', 'improvement'));
    }

    return workIssues;
  });

  issues.sort((left, right) => {
    const severityDifference =
      severityOrder[left.severity] - severityOrder[right.severity];

    if (severityDifference !== 0) {
      return severityDifference;
    }

    return left.workTitle.localeCompare(right.workTitle);
  });

  return {
    affectedWorkCount: new Set(issues.map((issue) => issue.workId)).size,
    issueCounts: issues.reduce(
      (counts, issue) => {
        counts[issue.severity] += 1;

        return counts;
      },
      {
        attention: 0,
        review: 0,
        improvement: 0,
      } satisfies Record<ArchiveHealthIssueSeverity, number>,
    ),
    issues,
    scannedAt,
    totalWorkCount: works.length,
  };
}

function getNextSyncStatus(serverVersion: number): WorkSyncStatus {
  return serverVersion > 0 ? 'pending' : 'local-only';
}

function isProgressUnit(value: unknown): value is ProgressUnit {
  return value === 'volume' || value === 'episode' || value === 'chapter';
}

function parseFixHistory(value: string | null): ArchiveHealthFixHistoryEntry[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as Partial<ArchiveHealthFixHistoryState>;

    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return [];
    }

    return parsed.entries.filter(
      (entry): entry is ArchiveHealthFixHistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        entry.kind === 'set_progress_unit' &&
        typeof entry.id === 'string' &&
        typeof entry.workId === 'string' &&
        typeof entry.workTitle === 'string' &&
        typeof entry.appliedAt === 'string' &&
        (entry.undoneAt === null || typeof entry.undoneAt === 'string') &&
        entry.beforeProgressUnit === null &&
        isProgressUnit(entry.afterProgressUnit),
    );
  } catch {
    return [];
  }
}

function serializeFixHistory(entries: ArchiveHealthFixHistoryEntry[]) {
  return JSON.stringify({
    entries: entries.slice(0, ARCHIVE_HEALTH_FIX_HISTORY_LIMIT),
    version: 1,
  } satisfies ArchiveHealthFixHistoryState);
}

export class ArchiveHealthService {
  constructor(
    private readonly repository: WorksRepository = worksRepository,
    private readonly queueRepository: SyncQueueRepository = syncQueueRepository,
    private readonly getDb: DatabaseResolver = getWorkArchiveDb,
  ) {}

  async scan() {
    return buildArchiveHealthReport(await this.repository.listActive());
  }

  async listFixHistory() {
    const entry = await this.getDb().appMeta.get(
      ARCHIVE_HEALTH_FIX_HISTORY_META_KEY,
    );

    return parseFixHistory(entry?.value ?? null);
  }

  async applySafeFix(workId: string, safeFix: ArchiveHealthSafeFix) {
    const db = this.getDb();

    return db.transaction(
      'rw',
      [db.works, db.syncQueue, db.appMeta],
      async () => {
        const work = await this.repository.getById(workId);

        if (!work || work.deletedAt !== null) {
          throw new Error(
            appI18n.t('settings.archiveHealth.fixErrors.workMissing'),
          );
        }

        const expectedProgressUnit = getDefaultProgressUnitForWorkType(
          work.type,
        );

        if (
          safeFix.kind !== 'set_progress_unit' ||
          expectedProgressUnit === null ||
          expectedProgressUnit !== safeFix.progressUnit ||
          !hasProgress(work) ||
          work.progressUnit
        ) {
          throw new Error(
            appI18n.t('settings.archiveHealth.fixErrors.noLongerAvailable'),
          );
        }

        const appliedAt = new Date().toISOString();
        const updated: WorkRecord = {
          ...work,
          progressUnit: safeFix.progressUnit,
          syncStatus: getNextSyncStatus(work.serverVersion),
          updatedAt: appliedAt,
        };
        const historyEntry: ArchiveHealthFixHistoryEntry = {
          afterProgressUnit: safeFix.progressUnit,
          appliedAt,
          beforeProgressUnit: null,
          id: crypto.randomUUID(),
          kind: 'set_progress_unit',
          undoneAt: null,
          workId: work.id,
          workTitle: work.title.trim() || work.id,
        };
        const existingHistory = await db.appMeta.get(
          ARCHIVE_HEALTH_FIX_HISTORY_META_KEY,
        );
        const nextHistory = [
          historyEntry,
          ...parseFixHistory(existingHistory?.value ?? null),
        ];

        await this.repository.update(updated);
        await this.queueRepository.enqueueWorkChange(
          updated,
          'update',
          'archive_health_fix',
        );
        await db.appMeta.put({
          key: ARCHIVE_HEALTH_FIX_HISTORY_META_KEY,
          value: serializeFixHistory(nextHistory),
        });

        return historyEntry;
      },
    );
  }

  async undoSafeFix(historyEntryId: string) {
    const db = this.getDb();

    return db.transaction(
      'rw',
      [db.works, db.syncQueue, db.appMeta],
      async () => {
        const storedHistory = await db.appMeta.get(
          ARCHIVE_HEALTH_FIX_HISTORY_META_KEY,
        );
        const history = parseFixHistory(storedHistory?.value ?? null);
        const historyEntry = history.find(
          (entry) => entry.id === historyEntryId,
        );

        if (!historyEntry) {
          throw new Error(
            appI18n.t('settings.archiveHealth.fixErrors.historyMissing'),
          );
        }

        if (historyEntry.undoneAt) {
          throw new Error(
            appI18n.t('settings.archiveHealth.fixErrors.alreadyUndone'),
          );
        }

        const work = await this.repository.getById(historyEntry.workId);

        if (!work || work.deletedAt !== null) {
          throw new Error(
            appI18n.t('settings.archiveHealth.fixErrors.workMissing'),
          );
        }

        if (work.progressUnit !== historyEntry.afterProgressUnit) {
          throw new Error(
            appI18n.t('settings.archiveHealth.fixErrors.changedAfterFix'),
          );
        }

        const undoneAt = new Date().toISOString();
        const updated: WorkRecord = {
          ...work,
          progressUnit: historyEntry.beforeProgressUnit,
          syncStatus: getNextSyncStatus(work.serverVersion),
          updatedAt: undoneAt,
        };
        const nextHistory = history.map((entry) =>
          entry.id === historyEntryId
            ? {
                ...entry,
                undoneAt,
              }
            : entry,
        );

        await this.repository.update(updated);
        await this.queueRepository.enqueueWorkChange(
          updated,
          'update',
          'archive_health_fix',
        );
        await db.appMeta.put({
          key: ARCHIVE_HEALTH_FIX_HISTORY_META_KEY,
          value: serializeFixHistory(nextHistory),
        });

        return nextHistory.find((entry) => entry.id === historyEntryId)!;
      },
    );
  }
}

export const archiveHealthService = new ArchiveHealthService();
