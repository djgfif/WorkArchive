import type {
  SyncEntityType,
  SyncOperation,
  SyncQueueItemRecord,
  SyncQueuePayload,
  SyncQueueSource,
  TimelineEntryRecord,
  UserReleaseRecord,
  WorkRecord,
} from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';
import { getPersonalTags } from '../utils/graph-tags';
import { moveUnknownGenresToPersonalTags } from '../utils/work-genres';

type DatabaseResolver = () => WorkArchiveDatabase;

export const DUPLICATE_CLEANUP_IGNORED_META_KEY =
  'duplicateCleanup.ignoredPairs.v1';

export const DUPLICATE_MERGE_SCALAR_FIELDS = [
  'catalogTitleId',
  'importDraft',
  'type',
  'title',
  'author',
  'description',
  'thumbnailUrl',
  'status',
  'rating',
  'shortReview',
  'review',
  'favorite',
  'progressCurrent',
  'progressTotal',
  'progressUnit',
  'lastConsumedLabel',
  'startedAt',
  'completedAt',
  'droppedAt',
  'lastConsumedAt',
] as const;

type DuplicateMergeScalarField = (typeof DUPLICATE_MERGE_SCALAR_FIELDS)[number];

type DuplicateRule =
  | 'catalogTitleId'
  | 'externalRef'
  | 'normalizedTitleAuthor'
  | 'fuzzyTitleAuthor';

interface DuplicateEdge {
  leftId: string;
  rightId: string;
  reason: DuplicateCandidateReason;
}

interface IgnoredDuplicateState {
  ignoredPairs: Array<{
    ignoredAt: string;
    pairKey: string;
  }>;
  version: 1;
}

export interface DuplicateCandidateReason {
  confidence: number;
  evidence: string;
  label: string;
  rule: DuplicateRule;
}

export interface DuplicateCandidateGroup {
  id: string;
  pairKeys: string[];
  reasons: DuplicateCandidateReason[];
  works: WorkRecord[];
}

export interface DuplicateMergeConflict {
  field: DuplicateMergeScalarField;
  label: string;
  options: Array<{
    isSuggested: boolean;
    value: unknown;
    workId: string;
    workTitle: string;
  }>;
}

export interface DuplicateMergePreview {
  conflicts: DuplicateMergeConflict[];
  duplicateCount: number;
  releaseRecordCopies: number;
  sourceWorkIds: string[];
  targetWorkId: string;
  timelineEntryCopies: number;
  unionGenres: string[];
  unionPersonalTags: string[];
}

export interface DuplicateMergeInput {
  scalarSelections?: Partial<Record<DuplicateMergeScalarField, string>>;
  sourceWorkIds: string[];
  targetWorkId: string;
}

export interface DuplicateMergeResult extends DuplicateMergePreview {
  deletedWorkIds: string[];
  targetWork: WorkRecord;
}

const SCALAR_FIELD_LABELS: Record<DuplicateMergeScalarField, string> = {
  author: '작가/제작자',
  catalogTitleId: '카탈로그 연결',
  completedAt: '완료일',
  description: '설명',
  droppedAt: '하차일',
  favorite: '즐겨찾기',
  importDraft: '가져오기 원본',
  lastConsumedAt: '마지막 감상일',
  lastConsumedLabel: '마지막 감상 위치',
  progressCurrent: '현재 진행도',
  progressTotal: '전체 진행도',
  progressUnit: '진행 단위',
  rating: '평점',
  review: '리뷰',
  shortReview: '한줄평',
  startedAt: '시작일',
  status: '상태',
  thumbnailUrl: '이미지',
  title: '제목',
  type: '유형',
};

function getPayloadServerVersion(payload: SyncQueuePayload) {
  return 'serverVersion' in payload ? payload.serverVersion : 0;
}

function clonePayload<TPayload extends SyncQueuePayload>(payload: TPayload) {
  return {
    ...payload,
    ...('genres' in payload && Array.isArray(payload.genres)
      ? { genres: [...payload.genres] }
      : {}),
    ...('personalTags' in payload && Array.isArray(payload.personalTags)
      ? { personalTags: [...payload.personalTags] }
      : {}),
  } as TPayload;
}

async function replaceQueuedEntity<TPayload extends SyncQueuePayload>(
  db: WorkArchiveDatabase,
  entityType: SyncEntityType,
  entity: TPayload,
  operation: SyncOperation,
  source: SyncQueueSource,
) {
  const existingItems = await db.syncQueue
    .where('[entityType+entityId]')
    .equals([entityType, entity.id])
    .toArray();

  if (existingItems.length > 0) {
    await db.syncQueue.bulkDelete(existingItems.map((item) => item.id));
  }

  const hasUnsyncedCreate = existingItems.some(
    (item) => item.operation === 'create',
  );

  if (
    'deletedAt' in entity &&
    entity.deletedAt !== null &&
    (hasUnsyncedCreate || getPayloadServerVersion(entity) === 0)
  ) {
    return null;
  }

  const nextOperation =
    hasUnsyncedCreate || getPayloadServerVersion(entity) === 0
      ? 'create'
      : operation;
  const queueItem: SyncQueueItemRecord<TPayload> = {
    autoMerge: null,
    clientMutationId:
      existingItems.find((item) => item.clientMutationId)?.clientMutationId ??
      crypto.randomUUID(),
    conflict: null,
    createdAt: new Date().toISOString(),
    entityId: entity.id,
    entityType,
    id: crypto.randomUUID(),
    lastError: null,
    nextRetryAt: null,
    operation: nextOperation,
    payload: clonePayload(entity),
    retryCount: 0,
    source,
  };

  await db.syncQueue.add(queueItem);

  return queueItem;
}

function normalizeText(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\s*\[[^\]]*\]\s*$/g, '')
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/[^0-9a-z가-힣]+/g, '');
}

function normalizeAuthor(value: string) {
  return normalizeText(value);
}

function getPairKey(leftId: string, rightId: string) {
  return [leftId, rightId].sort().join('::');
}

function addMapValue(map: Map<string, string[]>, key: string, workId: string) {
  if (!key) {
    return;
  }

  const values = map.get(key) ?? [];
  values.push(workId);
  map.set(key, values);
}

function getExternalRefKeys(work: WorkRecord) {
  const externalRefs = work.importDraft?.externalRefs ?? [];

  return externalRefs
    .map((ref) => {
      const provider = ref.provider.trim().toLowerCase();
      const externalId = ref.externalId.trim().toLowerCase();
      const rawType = ref.rawType?.trim().toLowerCase() ?? '';

      return provider && externalId
        ? `${provider}:${rawType}:${externalId}`
        : '';
    })
    .filter(Boolean);
}

function getNormalizedTitleAuthorKey(work: WorkRecord) {
  const title = normalizeText(work.title);
  const author = normalizeAuthor(work.author);

  return title && author ? `${work.type}:${title}:${author}` : '';
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! + substitutionCost,
      );
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index]!;
    }
  }

  return previous[right.length]!;
}

function getTitleSimilarity(leftTitle: string, rightTitle: string) {
  const left = normalizeText(leftTitle);
  const right = normalizeText(rightTitle);

  if (!left || !right) {
    return 0;
  }

  const longestLength = Math.max(left.length, right.length);

  if (longestLength === 0) {
    return 0;
  }

  return 1 - levenshteinDistance(left, right) / longestLength;
}

function isHighConfidenceFuzzyMatch(left: WorkRecord, right: WorkRecord) {
  if (left.type !== right.type) {
    return false;
  }

  const leftAuthor = normalizeAuthor(left.author);
  const rightAuthor = normalizeAuthor(right.author);

  if (!leftAuthor || leftAuthor !== rightAuthor) {
    return false;
  }

  const leftTitle = normalizeText(left.title);
  const rightTitle = normalizeText(right.title);
  const longestLength = Math.max(leftTitle.length, rightTitle.length);

  if (longestLength < 10 || leftTitle === rightTitle) {
    return false;
  }

  return getTitleSimilarity(left.title, right.title) >= 0.94;
}

function getValueKey(value: unknown) {
  return JSON.stringify(value ?? null);
}

function getScalarValue(work: WorkRecord, field: DuplicateMergeScalarField) {
  if (field === 'importDraft') {
    return work.importDraft ?? null;
  }

  return work[field] ?? null;
}

function isMeaningfulValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim() !== '';
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function getSuggestedWorkId(
  works: WorkRecord[],
  field: DuplicateMergeScalarField,
) {
  const withValue = works.filter((work) => isMeaningfulValue(getScalarValue(work, field)));

  if (withValue.length === 0) {
    return [...works].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    )[0]?.id;
  }

  return withValue.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )[0]?.id;
}

function createMergePreview(
  works: WorkRecord[],
  releaseRecords: UserReleaseRecord[],
  timelineEntries: TimelineEntryRecord[],
  input: DuplicateMergeInput,
): DuplicateMergePreview {
  const sourceWorkIds = input.sourceWorkIds.filter(
    (workId) => workId !== input.targetWorkId,
  );
  const selectedIds = new Set([input.targetWorkId, ...sourceWorkIds]);
  const selectedWorks = works.filter((work) => selectedIds.has(work.id));

  if (selectedWorks.length !== selectedIds.size || sourceWorkIds.length === 0) {
    throw new Error('병합할 중복 작품을 찾을 수 없습니다.');
  }

  const conflicts = DUPLICATE_MERGE_SCALAR_FIELDS.flatMap((field) => {
    const optionsByValue = new Map<string, DuplicateMergeConflict['options'][number]>();

    for (const work of selectedWorks) {
      const value = getScalarValue(work, field);
      const valueKey = getValueKey(value);

      if (!optionsByValue.has(valueKey)) {
        optionsByValue.set(valueKey, {
          isSuggested: false,
          value,
          workId: work.id,
          workTitle: work.title,
        });
      }
    }

    const options = [...optionsByValue.values()];

    if (options.length <= 1) {
      return [];
    }

    const suggestedWorkId = getSuggestedWorkId(selectedWorks, field);

    return [
      {
        field,
        label: SCALAR_FIELD_LABELS[field],
        options: options.map((option) => ({
          ...option,
          isSuggested: option.workId === suggestedWorkId,
        })),
      },
    ];
  });
  const normalizedTaxonomy = moveUnknownGenresToPersonalTags(
    selectedWorks.flatMap((work) => work.genres),
    selectedWorks.flatMap((work) => getPersonalTags(work.personalTags)),
  );

  return {
    conflicts,
    duplicateCount: sourceWorkIds.length,
    releaseRecordCopies: releaseRecords.filter((record) =>
      sourceWorkIds.includes(record.userWorkRecordId),
    ).length,
    sourceWorkIds,
    targetWorkId: input.targetWorkId,
    timelineEntryCopies: timelineEntries.filter((entry) =>
      sourceWorkIds.includes(entry.workId),
    ).length,
    unionGenres: normalizedTaxonomy.genres,
    unionPersonalTags: getPersonalTags(normalizedTaxonomy.personalTags),
  };
}

function parseIgnoredState(value: string | null): IgnoredDuplicateState {
  if (!value) {
    return {
      ignoredPairs: [],
      version: 1,
    };
  }

  try {
    const parsed = JSON.parse(value) as Partial<IgnoredDuplicateState>;

    return {
      ignoredPairs: Array.isArray(parsed.ignoredPairs)
        ? parsed.ignoredPairs.filter(
            (item) =>
              typeof item.pairKey === 'string' &&
              typeof item.ignoredAt === 'string',
          )
        : [],
      version: 1,
    };
  } catch {
    return {
      ignoredPairs: [],
      version: 1,
    };
  }
}

function getUniqueReasons(reasons: DuplicateCandidateReason[]) {
  const byKey = new Map<string, DuplicateCandidateReason>();

  for (const reason of reasons) {
    byKey.set(`${reason.rule}:${reason.evidence}`, reason);
  }

  return [...byKey.values()].sort(
    (left, right) =>
      right.confidence - left.confidence || left.label.localeCompare(right.label),
  );
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  constructor(ids: string[]) {
    for (const id of ids) {
      this.parent.set(id, id);
    }
  }

  find(id: string): string {
    const parent = this.parent.get(id);

    if (!parent || parent === id) {
      return id;
    }

    const root = this.find(parent);
    this.parent.set(id, root);

    return root;
  }

  union(left: string, right: string) {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);

    if (leftRoot !== rightRoot) {
      this.parent.set(rightRoot, leftRoot);
    }
  }
}

export class DuplicateCleanupService {
  constructor(private readonly getDb: DatabaseResolver = getWorkArchiveDb) {}

  async listDuplicateCandidateGroups(): Promise<DuplicateCandidateGroup[]> {
    const db = this.getDb();
    const [works, appMeta] = await Promise.all([
      db.works.filter((work) => work.deletedAt === null).toArray(),
      db.appMeta.get(DUPLICATE_CLEANUP_IGNORED_META_KEY),
    ]);
    const ignoredPairs = new Set(
      parseIgnoredState(appMeta?.value ?? null).ignoredPairs.map(
        (item) => item.pairKey,
      ),
    );
    const edges = this.createCandidateEdges(works).filter(
      (edge) => !ignoredPairs.has(getPairKey(edge.leftId, edge.rightId)),
    );
    const unionFind = new UnionFind(works.map((work) => work.id));

    for (const edge of edges) {
      unionFind.union(edge.leftId, edge.rightId);
    }

    const worksById = new Map(works.map((work) => [work.id, work]));
    const groupIdsByRoot = new Map<string, Set<string>>();

    for (const edge of edges) {
      const root = unionFind.find(edge.leftId);
      const ids = groupIdsByRoot.get(root) ?? new Set<string>();
      ids.add(edge.leftId);
      ids.add(edge.rightId);
      groupIdsByRoot.set(root, ids);
    }

    return [...groupIdsByRoot.values()]
      .map((ids) => {
        const groupWorks = [...ids]
          .map((id) => worksById.get(id))
          .filter((work): work is WorkRecord => Boolean(work))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        const groupIdSet = new Set(groupWorks.map((work) => work.id));
        const groupEdges = edges.filter(
          (edge) => groupIdSet.has(edge.leftId) && groupIdSet.has(edge.rightId),
        );
        const pairKeys = Array.from(
          new Set(
            groupEdges.map((edge) => getPairKey(edge.leftId, edge.rightId)),
          ),
        ).sort();

        return {
          id: pairKeys[0] ?? groupWorks.map((work) => work.id).join(':'),
          pairKeys,
          reasons: getUniqueReasons(groupEdges.map((edge) => edge.reason)),
          works: groupWorks,
        };
      })
      .filter((group) => group.works.length > 1)
      .sort(
        (left, right) =>
          right.reasons[0]!.confidence - left.reasons[0]!.confidence ||
          left.works[0]!.title.localeCompare(right.works[0]!.title),
      );
  }

  async markGroupNotDuplicate(workIds: string[]) {
    const uniqueIds = Array.from(new Set(workIds)).sort();

    if (uniqueIds.length < 2) {
      return;
    }

    const db = this.getDb();
    const existing = await db.appMeta.get(DUPLICATE_CLEANUP_IGNORED_META_KEY);
    const state = parseIgnoredState(existing?.value ?? null);
    const ignoredByPair = new Map(
      state.ignoredPairs.map((item) => [item.pairKey, item]),
    );
    const ignoredAt = new Date().toISOString();

    for (let leftIndex = 0; leftIndex < uniqueIds.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < uniqueIds.length;
        rightIndex += 1
      ) {
        const pairKey = getPairKey(uniqueIds[leftIndex]!, uniqueIds[rightIndex]!);
        ignoredByPair.set(pairKey, {
          ignoredAt,
          pairKey,
        });
      }
    }

    await db.appMeta.put({
      key: DUPLICATE_CLEANUP_IGNORED_META_KEY,
      value: JSON.stringify({
        ignoredPairs: [...ignoredByPair.values()].sort((left, right) =>
          left.pairKey.localeCompare(right.pairKey),
        ),
        version: 1,
      } satisfies IgnoredDuplicateState),
    });
  }

  async getMergePreview(input: DuplicateMergeInput) {
    const db = this.getDb();
    const [works, releaseRecords, timelineEntries] = await Promise.all([
      db.works.toArray(),
      db.releaseRecords.toArray(),
      db.timelineEntries.toArray(),
    ]);

    return createMergePreview(works, releaseRecords, timelineEntries, input);
  }

  async mergeDuplicates(input: DuplicateMergeInput): Promise<DuplicateMergeResult> {
    const db = this.getDb();

    return db.transaction(
      'rw',
      [
        db.works,
        db.releaseRecords,
        db.timelineEntries,
        db.syncQueue,
        db.appMeta,
      ],
      async () => {
        const [works, releaseRecords, timelineEntries] = await Promise.all([
          db.works.toArray(),
          db.releaseRecords.toArray(),
          db.timelineEntries.toArray(),
        ]);
        const preview = createMergePreview(
          works,
          releaseRecords,
          timelineEntries,
          input,
        );

        for (const conflict of preview.conflicts) {
          const selectedWorkId = input.scalarSelections?.[conflict.field];

          if (
            !selectedWorkId ||
            !conflict.options.some((option) => option.workId === selectedWorkId)
          ) {
            throw new Error(
              `${conflict.label} 값이 서로 달라 직접 선택해야 합니다.`,
            );
          }
        }

        const selectedIds = new Set([
          input.targetWorkId,
          ...preview.sourceWorkIds,
        ]);
        const selectedWorks = works.filter((work) => selectedIds.has(work.id));
        const target = selectedWorks.find((work) => work.id === input.targetWorkId);

        if (!target || target.deletedAt !== null) {
          throw new Error('병합 대상 작품을 찾을 수 없습니다.');
        }

        const now = new Date().toISOString();
        const mergedWork: WorkRecord = {
          ...target,
          genres: preview.unionGenres,
          personalTags: preview.unionPersonalTags,
          updatedAt: now,
          syncStatus: target.serverVersion > 0 ? 'pending' : 'local-only',
        };

        for (const field of DUPLICATE_MERGE_SCALAR_FIELDS) {
          const selectedWorkId = input.scalarSelections?.[field];
          const fieldHasConflict = preview.conflicts.some(
            (conflict) => conflict.field === field,
          );
          const selectedWork = selectedWorkId
            ? selectedWorks.find((work) => work.id === selectedWorkId)
            : selectedWorks[0];

          if (!fieldHasConflict) {
            const firstWork = selectedWorks[0];
            (mergedWork as unknown as Record<string, unknown>)[field] = firstWork
              ? getScalarValue(firstWork, field)
              : getScalarValue(target, field);
            continue;
          }

          if (selectedWork) {
            (mergedWork as unknown as Record<string, unknown>)[field] = getScalarValue(
              selectedWork,
              field,
            );
          }
        }

        const storedMergedWork = {
          ...mergedWork,
          _deletedAtScope: 'active',
        } as WorkRecord & { _deletedAtScope: 'active' };

        await db.works.put(storedMergedWork);
        await replaceQueuedEntity(db, 'work', mergedWork, 'update', 'edit_form');

        const deletedWorkIds: string[] = [];

        for (const sourceId of preview.sourceWorkIds) {
          const source = selectedWorks.find((work) => work.id === sourceId);

          if (!source || source.deletedAt !== null) {
            continue;
          }

          const deleted: WorkRecord = {
            ...source,
            deletedAt: now,
            syncStatus: source.serverVersion > 0 ? 'pending' : 'local-only',
            updatedAt: now,
          };

          const storedDeletedWork = {
            ...deleted,
            _deletedAtScope: 'deleted',
          } as WorkRecord & { _deletedAtScope: 'deleted' };

          await db.works.put(storedDeletedWork);
          await replaceQueuedEntity(db, 'work', deleted, 'delete', 'edit_form');
          deletedWorkIds.push(source.id);
        }

        for (const releaseRecord of releaseRecords.filter((record) =>
          preview.sourceWorkIds.includes(record.userWorkRecordId),
        )) {
          const clone: UserReleaseRecord = {
            ...releaseRecord,
            deletedAt: releaseRecord.deletedAt,
            id: crypto.randomUUID(),
            serverVersion: 0,
            syncStatus: 'local-only',
            updatedAt: now,
            userWorkRecordId: target.id,
          };

          await db.releaseRecords.add(clone);

          if (clone.deletedAt === null) {
            await replaceQueuedEntity(
              db,
              'release_record',
              clone,
              'create',
              'release_record_update',
            );
          }

          if (releaseRecord.deletedAt === null) {
            const deletedReleaseRecord: UserReleaseRecord = {
              ...releaseRecord,
              deletedAt: now,
              syncStatus:
                releaseRecord.serverVersion > 0 ? 'pending' : 'local-only',
              updatedAt: now,
            };

            await db.releaseRecords.put(deletedReleaseRecord);
            await replaceQueuedEntity(
              db,
              'release_record',
              deletedReleaseRecord,
              'delete',
              'release_record_update',
            );
          }
        }

        for (const timelineEntry of timelineEntries.filter((entry) =>
          preview.sourceWorkIds.includes(entry.workId),
        )) {
          const clone: TimelineEntryRecord = {
            ...timelineEntry,
            deletedAt: timelineEntry.deletedAt,
            id: crypto.randomUUID(),
            serverVersion: 0,
            syncStatus: 'local-only',
            updatedAt: now,
            workId: target.id,
          };

          await db.timelineEntries.add(clone);

          if (clone.deletedAt === null) {
            await replaceQueuedEntity(
              db,
              'timeline_entry',
              clone,
              'create',
              'timeline_entry_update',
            );
          }

          if (timelineEntry.deletedAt === null) {
            const deletedTimelineEntry: TimelineEntryRecord = {
              ...timelineEntry,
              deletedAt: now,
              syncStatus:
                timelineEntry.serverVersion > 0 ? 'pending' : 'local-only',
              updatedAt: now,
            };

            await db.timelineEntries.put(deletedTimelineEntry);
            await replaceQueuedEntity(
              db,
              'timeline_entry',
              deletedTimelineEntry,
              'delete',
              'timeline_entry_update',
            );
          }
        }

        await this.markGroupNotDuplicate([...selectedIds]);

        return {
          ...preview,
          deletedWorkIds,
          targetWork: mergedWork,
        };
      },
    );
  }

  private createCandidateEdges(works: WorkRecord[]) {
    const edges: DuplicateEdge[] = [];
    const addGroupEdges = (
      ids: string[],
      createReason: () => DuplicateCandidateReason,
    ) => {
      const uniqueIds = Array.from(new Set(ids)).sort();

      if (uniqueIds.length < 2) {
        return;
      }

      for (let leftIndex = 0; leftIndex < uniqueIds.length; leftIndex += 1) {
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < uniqueIds.length;
          rightIndex += 1
        ) {
          edges.push({
            leftId: uniqueIds[leftIndex]!,
            reason: createReason(),
            rightId: uniqueIds[rightIndex]!,
          });
        }
      }
    };
    const catalogMap = new Map<string, string[]>();
    const externalRefMap = new Map<string, string[]>();
    const titleAuthorMap = new Map<string, string[]>();

    for (const work of works) {
      addMapValue(catalogMap, work.catalogTitleId ?? '', work.id);

      for (const key of getExternalRefKeys(work)) {
        addMapValue(externalRefMap, key, work.id);
      }

      addMapValue(titleAuthorMap, getNormalizedTitleAuthorKey(work), work.id);
    }

    for (const [catalogTitleId, ids] of catalogMap) {
      addGroupEdges(ids, () => ({
        confidence: 1,
        evidence: catalogTitleId,
        label: '같은 카탈로그 작품 ID',
        rule: 'catalogTitleId',
      }));
    }

    for (const [externalRefKey, ids] of externalRefMap) {
      addGroupEdges(ids, () => ({
        confidence: 0.98,
        evidence: externalRefKey,
        label: '같은 가져오기 원본 ID',
        rule: 'externalRef',
      }));
    }

    for (const [titleAuthorKey, ids] of titleAuthorMap) {
      addGroupEdges(ids, () => ({
        confidence: 0.93,
        evidence: titleAuthorKey,
        label: '제목, 유형, 작가 일치',
        rule: 'normalizedTitleAuthor',
      }));
    }

    for (let leftIndex = 0; leftIndex < works.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < works.length;
        rightIndex += 1
      ) {
        const left = works[leftIndex]!;
        const right = works[rightIndex]!;

        if (!isHighConfidenceFuzzyMatch(left, right)) {
          continue;
        }

        edges.push({
          leftId: left.id,
          reason: {
            confidence: getTitleSimilarity(left.title, right.title),
            evidence: `${left.type}:${normalizeText(left.title)}~${normalizeText(
              right.title,
            )}:${normalizeAuthor(left.author)}`,
            label: '높은 신뢰도의 제목 유사도',
            rule: 'fuzzyTitleAuthor',
          },
          rightId: right.id,
        });
      }
    }

    return edges;
  }
}

export const duplicateCleanupService = new DuplicateCleanupService();

export type { DuplicateMergeScalarField };
