import type {
  WorkRecord,
  ProgressUnit,
  WorkStatus,
  WorkSyncStatus,
  WorkType,
} from '@work-archive/shared-types';
import type { WorksRepository } from './works.repository';

import { appI18n } from '@app/i18n';
import {
  syncQueueRepository,
  type SyncQueueRepository,
} from '../../sync/queue';
import {
  SERIES_GRAPH_TAG_KINDS,
  getContributorSuggestionValues,
  getGraphTags,
  getPersonalTags,
  getOrganizationContributorSuggestionValues,
  getPersonContributorSuggestionValues,
  getSuggestionValues,
} from '../utils/graph-tags';
import {
  queryWorks,
  type WorksGraphQueryIndex,
  type WorksListQuery,
} from '../utils/query-works';
import {
  WORK_GENRES,
  moveUnknownGenresToPersonalTags,
} from '../utils/work-genres';
import type { UpsertWorkInput } from '../utils/work-form';
import {
  graphRepository,
  type GraphRepository,
  type WorkGraphInput,
  type WorkGraphSnapshot,
} from './graph.repository';
import { worksRepository } from './works.repository';

function getNextSyncStatus(serverVersion: number): WorkSyncStatus {
  return serverVersion > 0 ? 'pending' : 'local-only';
}

function getCreateSource(input: UpsertWorkInput) {
  return input.catalogTitleId || input.importDraft
    ? 'quick_add'
    : 'manual_create';
}

interface WorksListResult {
  contributorSuggestions: string[];
  genreSuggestions: string[];
  organizationContributorSuggestions: string[];
  personContributorSuggestions: string[];
  seriesSuggestions: string[];
  statusCounts: Record<WorkStatus, number>;
  tagSuggestions: string[];
  typeCounts: Record<WorkType, number>;
  recentModifiedWorks: WorkRecord[];
  totalActiveCount: number;
  totalDeletedCount: number;
  works: WorkRecord[];
}

export type WorksCollectionScope = 'active' | 'trash';

interface UpdateProgressInput {
  progressCurrent?: number | null;
  progressTotal?: number | null;
  progressUnit?: ProgressUnit | null;
  lastConsumedLabel?: string | null;
}

function buildEmptyStatusCounts(): Record<WorkStatus, number> {
  return {
    completed: 0,
    dropped: 0,
    in_progress: 0,
    on_hold: 0,
    planned: 0,
  };
}

function countStatuses(works: WorkRecord[]) {
  return works.reduce((counts, work) => {
    counts[work.status] += 1;

    return counts;
  }, buildEmptyStatusCounts());
}

function countTypes(works: WorkRecord[]) {
  return works.reduce(
    (counts, work) => {
      counts[work.type] += 1;

      return counts;
    },
    {
      anime: 0,
      drama: 0,
      light_novel: 0,
      manga: 0,
      movie: 0,
      novel: 0,
      other: 0,
      web_novel: 0,
      webtoon: 0,
    } satisfies Record<WorkType, number>,
  );
}

function buildGraphInputFromLegacyTags(tags: string[]): WorkGraphInput | null {
  const graphTags = getGraphTags(tags);

  if (graphTags.length === 0) {
    return null;
  }

  const graph: WorkGraphInput = {
    contributors: [],
    series: [],
  };
  const contributorOrderByRole = new Map<string, number>();

  for (const tag of graphTags) {
    if (tag.kind === 'series' || tag.kind === 'universe') {
      graph.series.push({
        kind: tag.kind,
        role: 'main',
        title: tag.value,
      });
      continue;
    }

    const role =
      tag.kind === 'creator'
        ? 'original_creator'
        : tag.kind === 'studio'
          ? 'studio'
          : tag.kind === 'publisher'
            ? 'publisher'
            : 'platform';
    const displayOrder = contributorOrderByRole.get(role) ?? 0;

    contributorOrderByRole.set(role, displayOrder + 1);
    graph.contributors.push({
      displayOrder,
      entityType: tag.kind === 'creator' ? 'person' : 'organization',
      name: tag.value,
      role,
    });
  }

  return graph;
}

export class WorksService {
  constructor(
    private readonly repository: WorksRepository = worksRepository,
    private readonly queueRepository: SyncQueueRepository = syncQueueRepository,
    private readonly graphRepo: GraphRepository = graphRepository,
  ) {}

  async listWorks(
    query: WorksListQuery,
    scope: WorksCollectionScope = 'active',
  ) {
    const [activeWorks, deletedCount, worksInScope, graph] = await Promise.all([
      this.repository.listActive(),
      // Only the count is needed here; materializing every soft-deleted record
      // (and normalizing it) on each list call is wasted work for large trashes.
      this.repository.countByScope('deleted'),
      this.repository.listByScopeForQuery(
        scope === 'trash' ? 'deleted' : 'active',
        query,
      ),
      this.graphRepo.listActiveGraph(),
    ]);
    const graphIndex = buildGraphQueryIndex(graph);
    const graphContributorSuggestions = Array.from(
      new Set([
        ...graph.contributors.map((contributor) => contributor.name),
        ...activeWorks.map((work) => work.author.trim()).filter(Boolean),
      ]),
    ).sort((left, right) => left.localeCompare(right));
    const graphPersonContributorSuggestions = Array.from(
      new Set([
        ...graph.contributors
          .filter((contributor) => contributor.entityType === 'person')
          .map((contributor) => contributor.name),
        ...activeWorks.map((work) => work.author.trim()).filter(Boolean),
      ]),
    ).sort((left, right) => left.localeCompare(right));
    const graphOrganizationContributorSuggestions = Array.from(
      new Set(
        graph.contributors
          .filter((contributor) => contributor.entityType !== 'person')
          .map((contributor) => contributor.name),
      ),
    ).sort((left, right) => left.localeCompare(right));
    const graphSeriesSuggestions = Array.from(
      new Set(graph.series.map((series) => series.title)),
    ).sort((left, right) => left.localeCompare(right));

    return {
      contributorSuggestions:
        graphContributorSuggestions.length > 0
          ? graphContributorSuggestions
          : getContributorSuggestionValues(activeWorks),
      genreSuggestions: [...WORK_GENRES],
      organizationContributorSuggestions:
        graphOrganizationContributorSuggestions.length > 0
          ? graphOrganizationContributorSuggestions
          : getOrganizationContributorSuggestionValues(activeWorks),
      personContributorSuggestions:
        graphPersonContributorSuggestions.length > 0
          ? graphPersonContributorSuggestions
          : getPersonContributorSuggestionValues(activeWorks),
      seriesSuggestions:
        graphSeriesSuggestions.length > 0
          ? graphSeriesSuggestions
          : getSuggestionValues(activeWorks, SERIES_GRAPH_TAG_KINDS),
      statusCounts: countStatuses(activeWorks),
      tagSuggestions: Array.from(
        new Set(
          activeWorks.flatMap(
            (work) =>
              moveUnknownGenresToPersonalTags(
                work.genres,
                getPersonalTags(work.personalTags),
              ).personalTags,
          ),
        ),
      ).sort((left, right) => left.localeCompare(right)),
      typeCounts: countTypes(activeWorks),
      recentModifiedWorks: [...activeWorks]
        .sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime(),
        )
        .slice(0, 8),
      totalActiveCount: activeWorks.length,
      totalDeletedCount: deletedCount,
      works: queryWorks(worksInScope, query, graphIndex),
    } satisfies WorksListResult;
  }

  async getWorkById(id: string) {
    const work = await this.repository.getById(id);

    if (!work || work.deletedAt !== null) {
      return null;
    }

    return work;
  }

  async createWork(input: UpsertWorkInput) {
    const now = new Date().toISOString();
    const normalizedTaxonomy = moveUnknownGenresToPersonalTags(
      input.genres,
      input.personalTags ?? [],
    );
    const work: WorkRecord = {
      id: crypto.randomUUID(),
      ...input,
      genres: normalizedTaxonomy.genres,
      catalogTitleId: input.catalogTitleId ?? null,
      importDraft: input.importDraft ?? null,
      serialStatus: input.serialStatus ?? null,
      personalTags: getPersonalTags(normalizedTaxonomy.personalTags),
      createdAt: now,
      updatedAt: now,
      progressCurrent: null,
      progressTotal: null,
      progressUnit: null,
      lastConsumedLabel: null,
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
      droppedAt: input.droppedAt ?? null,
      lastConsumedAt: input.lastConsumedAt ?? null,
      deletedAt: null,
      syncStatus: 'local-only',
      serverVersion: 0,
    };

    await this.repository.runWorkMutation(async () => {
      await this.repository.create(work);
      await this.queueRepository.enqueueWorkChange(
        work,
        'create',
        getCreateSource(input),
      );
    });
    const graphInput =
      input.graph ?? buildGraphInputFromLegacyTags(input.personalTags ?? []);

    if (graphInput) {
      await this.graphRepo.saveWorkGraph(work.id, graphInput, getCreateSource(input));
    }

    return work;
  }

  async updateWork(id: string, input: UpsertWorkInput) {
    const existing = await this.repository.getById(id);

    if (!existing || existing.deletedAt !== null) {
      throw new Error(appI18n.t('works.errors.workMissing'));
    }

    const normalizedTaxonomy = moveUnknownGenresToPersonalTags(
      input.genres,
      input.personalTags ?? existing.personalTags,
    );
    const updated: WorkRecord = {
      ...existing,
      ...input,
      genres: normalizedTaxonomy.genres,
      catalogTitleId:
        input.catalogTitleId === undefined
          ? (existing.catalogTitleId ?? null)
          : input.catalogTitleId,
      importDraft:
        input.importDraft === undefined
          ? (existing.importDraft ?? null)
          : input.importDraft,
      personalTags: getPersonalTags(normalizedTaxonomy.personalTags),
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
      droppedAt: input.droppedAt ?? null,
      lastConsumedAt: input.lastConsumedAt ?? null,
      serialStatus: input.serialStatus ?? existing.serialStatus ?? null,
      updatedAt: new Date().toISOString(),
      syncStatus: getNextSyncStatus(existing.serverVersion),
    };

    await this.repository.runWorkMutation(async () => {
      await this.repository.update(updated);
      await this.queueRepository.enqueueWorkChange(updated, 'update', 'edit_form');
    });
    const graphInput =
      input.graph ?? buildGraphInputFromLegacyTags(input.personalTags ?? []);

    if (graphInput) {
      await this.graphRepo.saveWorkGraph(updated.id, graphInput, 'edit_form');
    }

    return updated;
  }

  async updateProgress(id: string, input: UpdateProgressInput) {
    const existing = await this.repository.getById(id);

    if (!existing || existing.deletedAt !== null) {
      throw new Error(appI18n.t('works.errors.workMissing'));
    }

    const updated: WorkRecord = {
      ...existing,
      lastConsumedLabel:
        input.lastConsumedLabel === undefined
          ? (existing.lastConsumedLabel ?? null)
          : (input.lastConsumedLabel?.trim() ?? null),
      lastConsumedAt: new Date().toISOString(),
      progressCurrent:
        input.progressCurrent === undefined
          ? (existing.progressCurrent ?? null)
          : input.progressCurrent,
      progressTotal:
        input.progressTotal === undefined
          ? (existing.progressTotal ?? null)
          : input.progressTotal,
      progressUnit:
        input.progressUnit === undefined
          ? (existing.progressUnit ?? null)
          : input.progressUnit,
      updatedAt: new Date().toISOString(),
      syncStatus: getNextSyncStatus(existing.serverVersion),
    };

    await this.repository.runWorkMutation(async () => {
      await this.repository.update(updated);
      await this.queueRepository.enqueueWorkChange(
        updated,
        'update',
        'progress_update',
      );
    });

    return updated;
  }

  async deleteWork(id: string) {
    const existing = await this.repository.getById(id);

    if (!existing || existing.deletedAt !== null) {
      throw new Error(appI18n.t('works.errors.workMissing'));
    }

    const deletedAt = new Date().toISOString();
    const deleted = await this.repository.runWorkMutation(async () => {
      const result = await this.repository.softDelete(id, {
        deletedAt,
        updatedAt: deletedAt,
        syncStatus: getNextSyncStatus(existing.serverVersion),
      });

      if (!result) {
        throw new Error(appI18n.t('works.errors.workMissing'));
      }

      await this.queueRepository.enqueueWorkChange(result, 'delete', 'edit_form');

      return result;
    });

    return deleted;
  }

  async restoreWork(id: string) {
    const existing = await this.repository.getById(id);

    if (!existing || existing.deletedAt === null) {
      throw new Error(appI18n.t('works.errors.restoreWorkMissing'));
    }

    const restoredAt = new Date().toISOString();
    const restored = await this.repository.runWorkMutation(async () => {
      const result = await this.repository.restore(id, {
        deletedAt: null,
        syncStatus: getNextSyncStatus(existing.serverVersion),
        updatedAt: restoredAt,
      });

      if (!result) {
        throw new Error(appI18n.t('works.errors.restoreWorkMissing'));
      }

      await this.queueRepository.enqueueWorkChange(result, 'update', 'restore');

      return result;
    });

    return restored;
  }
}

export const worksService = new WorksService();

function buildGraphQueryIndex(graph: WorkGraphSnapshot): WorksGraphQueryIndex {
  const seriesById = new Map(graph.series.map((series) => [series.id, series]));
  const contributorsById = new Map(
    graph.contributors.map((contributor) => [contributor.id, contributor]),
  );
  const seriesValuesByWorkId = new Map<string, string[]>();
  const contributorValuesByWorkId = new Map<string, string[]>();
  const organizationContributorValuesByWorkId = new Map<string, string[]>();
  const personContributorValuesByWorkId = new Map<string, string[]>();

  for (const link of graph.workSeriesLinks) {
    const series = seriesById.get(link.seriesId);

    if (!series) {
      continue;
    }

    const values = seriesValuesByWorkId.get(link.workId) ?? [];
    values.push(series.title);
    seriesValuesByWorkId.set(link.workId, values);
  }

  for (const link of graph.workContributors) {
    const contributor = contributorsById.get(link.contributorId);

    if (!contributor) {
      continue;
    }

    const values = contributorValuesByWorkId.get(link.workId) ?? [];
    values.push(contributor.name);
    contributorValuesByWorkId.set(link.workId, values);

    const scopedMap =
      contributor.entityType === 'person'
        ? personContributorValuesByWorkId
        : organizationContributorValuesByWorkId;
    const scopedValues = scopedMap.get(link.workId) ?? [];
    scopedValues.push(contributor.name);
    scopedMap.set(link.workId, scopedValues);
  }

  return {
    contributorValuesByWorkId,
    organizationContributorValuesByWorkId,
    personContributorValuesByWorkId,
    seriesValuesByWorkId,
  };
}
