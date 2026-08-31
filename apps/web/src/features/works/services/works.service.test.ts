import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';

import {
  createWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';
import { SyncQueueRepository } from '@features/sync';
import { WORK_GENRES } from '../utils/work-genres';
import type { UpsertWorkInput } from '../utils/work-form';
import { GraphRepository } from './graph.repository';
import { TimelineEntriesRepository } from './timeline-entries.repository';
import { WorksRepository } from './works.repository';
import { WorksService } from './works.service';

function buildInput(overrides: Partial<UpsertWorkInput> = {}) {
  return {
    type: 'novel' as const,
    title: 'Dune',
    author: 'Frank Herbert',
    genres: ['판타지'],
    personalTags: [],
    description: '',
    thumbnailUrl: '',
    status: 'planned' as const,
    rating: null,
    shortReview: '',
    review: '',
    favorite: false,
    ...overrides,
  };
}

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: crypto.randomUUID(),
    ...buildInput(),
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'synced',
    serverVersion: 2,
    ...overrides,
  };
}

describe('WorksService', () => {
  let db: WorkArchiveDatabase;
  let repository: WorksRepository;
  let queueRepository: SyncQueueRepository;
  let graphRepository: GraphRepository;
  let timelineRepository: TimelineEntriesRepository;
  let service: WorksService;

  beforeEach(() => {
    db = createWorkArchiveDb(`work-archive-test-${crypto.randomUUID()}`);
    repository = new WorksRepository(() => db);
    queueRepository = new SyncQueueRepository(() => db);
    graphRepository = new GraphRepository(() => db, queueRepository);
    timelineRepository = new TimelineEntriesRepository(() => db);
    service = new WorksService(
      repository,
      queueRepository,
      graphRepository,
      timelineRepository,
    );
  });

  afterEach(async () => {
    await db.delete();
  });

  it('rolls back the stored work when enqueueing its change fails', async () => {
    const failingQueue = new SyncQueueRepository(() => db);
    vi.spyOn(failingQueue, 'enqueueWorkChange').mockRejectedValue(
      new Error('enqueue failed'),
    );
    const failingService = new WorksService(
      repository,
      failingQueue,
      undefined,
      timelineRepository,
    );

    await expect(failingService.createWork(buildInput())).rejects.toThrow();

    expect(await db.works.count()).toBe(0);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('rolls back every work and graph table when graph queueing fails during create', async () => {
    const graphQueue = new SyncQueueRepository(() => db);
    const enqueueEntityChange =
      graphQueue.enqueueEntityChange.bind(graphQueue);

    vi.spyOn(graphQueue, 'enqueueEntityChange').mockImplementation(
      async (entityType, ...args) => {
        if (entityType === 'work_series_link') {
          throw new Error('graph queue failed');
        }

        return enqueueEntityChange(entityType, ...args);
      },
    );
    const failingService = new WorksService(
      repository,
      queueRepository,
      new GraphRepository(() => db, graphQueue),
      timelineRepository,
    );

    await expect(
      failingService.createWork(
        buildInput({
          graph: {
            contributors: [
              {
                entityType: 'person',
                name: 'Frank Herbert',
                role: 'original_creator',
              },
            ],
            series: [{ kind: 'series', title: 'Dune' }],
          },
        }),
      ),
    ).rejects.toThrow('graph queue failed');

    await expect(
      Promise.all([
        db.works.count(),
        db.timelineEntries.count(),
        db.series.count(),
        db.workSeriesLinks.count(),
        db.contributors.count(),
        db.workContributors.count(),
        db.workRelations.count(),
        db.syncQueue.count(),
      ]),
    ).resolves.toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('restores the exact work, graph, timeline, and queue snapshot when graph saving fails during update', async () => {
    const created = await service.createWork(
      buildInput({
        graph: {
          contributors: [
            {
              entityType: 'person',
              name: 'Frank Herbert',
              role: 'original_creator',
            },
          ],
          series: [{ kind: 'series', title: 'Dune' }],
        },
      }),
    );
    const readMutationState = async () => ({
      contributors: await db.contributors.toArray(),
      queue: await db.syncQueue.toArray(),
      series: await db.series.toArray(),
      timelineEntries: await db.timelineEntries.toArray(),
      work: await db.works.get(created.id),
      workContributors: await db.workContributors.toArray(),
      workRelations: await db.workRelations.toArray(),
      workSeriesLinks: await db.workSeriesLinks.toArray(),
    });
    const before = await readMutationState();
    const graphQueue = new SyncQueueRepository(() => db);
    const enqueueEntityChange =
      graphQueue.enqueueEntityChange.bind(graphQueue);

    vi.spyOn(graphQueue, 'enqueueEntityChange').mockImplementation(
      async (entityType, ...args) => {
        if (entityType === 'work_contributor') {
          throw new Error('graph save failed');
        }

        return enqueueEntityChange(entityType, ...args);
      },
    );
    const failingService = new WorksService(
      repository,
      queueRepository,
      new GraphRepository(() => db, graphQueue),
      timelineRepository,
    );

    await expect(
      failingService.updateWork(
        created.id,
        buildInput({
          graph: {
            contributors: [
              {
                entityType: 'organization',
                name: 'Ace Books',
                role: 'publisher',
              },
            ],
            series: [{ kind: 'universe', title: 'Known Universe' }],
          },
          status: 'completed',
          title: 'Dune (revised)',
        }),
      ),
    ).rejects.toThrow('graph save failed');

    expect(await readMutationState()).toEqual(before);
  });

  it('preserves explicit graph records and queue metadata on success', async () => {
    const created = await service.createWork(
      buildInput({
        graph: {
          contributors: [
            {
              displayOrder: 0,
              entityType: 'person',
              name: 'Frank Herbert',
              role: 'original_creator',
            },
          ],
          series: [
            {
              kind: 'series',
              orderIndex: 1,
              orderLabel: 'Book 1',
              role: 'main',
              title: 'Dune',
            },
          ],
        },
      }),
    );
    const graph = await graphRepository.getWorkGraph(created.id);
    const queue = await queueRepository.listAll();

    expect(graph.series).toEqual([
      expect.objectContaining({ kind: 'series', title: 'Dune' }),
    ]);
    expect(graph.contributors).toEqual([
      expect.objectContaining({
        entityType: 'person',
        name: 'Frank Herbert',
      }),
    ]);
    expect(graph.workSeriesLinks).toEqual([
      expect.objectContaining({ orderIndex: 1, orderLabel: 'Book 1' }),
    ]);
    expect(queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: created.id,
          entityType: 'work',
          operation: 'create',
          source: 'manual_create',
        }),
        expect.objectContaining({
          entityType: 'series',
          operation: 'create',
          source: 'manual_create',
        }),
        expect.objectContaining({
          entityType: 'work_series_link',
          operation: 'create',
          source: 'manual_create',
        }),
        expect.objectContaining({
          entityType: 'contributor',
          operation: 'create',
          source: 'manual_create',
        }),
        expect.objectContaining({
          entityType: 'work_contributor',
          operation: 'create',
          source: 'manual_create',
        }),
      ]),
    );
  });

  it('preserves legacy graph-prefixed tags and their queue metadata', async () => {
    const created = await service.createWork(
      buildInput({
        personalTags: [
          'series:Dune',
          'creator:Frank Herbert',
          'favorite prose',
        ],
      }),
    );
    const graph = await graphRepository.getWorkGraph(created.id);
    const queue = await queueRepository.listAll();

    expect(graph.series).toEqual([
      expect.objectContaining({ kind: 'series', title: 'Dune' }),
    ]);
    expect(graph.contributors).toEqual([
      expect.objectContaining({
        entityType: 'person',
        name: 'Frank Herbert',
      }),
    ]);
    expect(queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'series',
          source: 'manual_create',
        }),
        expect.objectContaining({
          entityType: 'work_contributor',
          source: 'manual_create',
        }),
      ]),
    );
  });

  it('keeps a single create queue item while a local-only work changes', async () => {
    const created = await service.createWork(
      buildInput({
        catalogTitleId: 'catalog-title-1',
        completedAt: '2026-04-20T00:00:00.000Z',
        personalTags: ['다시 볼 것'],
        importDraft: {
          catalogTitle: 'Dune',
          mediumType: 'novel',
          externalRefs: [
            {
              provider: 'aladin',
              externalId: '123',
              rawType: 'novel',
            },
          ],
        },
      }),
    );

    expect(await queueRepository.listAll()).toEqual([
      expect.objectContaining({
        entityId: created.id,
        operation: 'create',
        source: 'quick_add',
        payload: expect.objectContaining({
          catalogTitleId: 'catalog-title-1',
          completedAt: '2026-04-20T00:00:00.000Z',
          personalTags: ['다시 볼 것'],
          importDraft: expect.objectContaining({
            catalogTitle: 'Dune',
          }),
        }),
        retryCount: 0,
      }),
    ]);

    await service.updateWork(
      created.id,
      buildInput({
        title: 'Dune Messiah',
      }),
    );

    const queuedAfterUpdate = await queueRepository.listAll();

    expect(queuedAfterUpdate).toHaveLength(1);
    expect(queuedAfterUpdate[0]).toEqual(
      expect.objectContaining({
        entityId: created.id,
        operation: 'create',
        source: 'edit_form',
        payload: expect.objectContaining({
          title: 'Dune Messiah',
          syncStatus: 'local-only',
        }),
      }),
    );

    await service.deleteWork(created.id);

    expect(await queueRepository.listAll()).toEqual([]);
    expect(await repository.getById(created.id)).toEqual(
      expect.objectContaining({
        deletedAt: expect.any(String),
      }),
    );
  });

  it('queues updates for works that already exist on the server', async () => {
    const existing = buildWork();

    await repository.create(existing);

    await service.updateWork(
      existing.id,
      buildInput({
        title: 'Children of Dune',
      }),
    );

    expect(await queueRepository.listAll()).toEqual([
      expect.objectContaining({
        entityId: existing.id,
        operation: 'update',
        source: 'edit_form',
        payload: expect.objectContaining({
          title: 'Children of Dune',
          syncStatus: 'pending',
          serverVersion: 2,
        }),
      }),
    ]);
  });

  it('coalesces a synced work update into a single delete queue item', async () => {
    const existing = buildWork({
      syncStatus: 'synced',
      serverVersion: 4,
    });

    await repository.create(existing);

    await service.updateWork(
      existing.id,
      buildInput({
        title: 'Children of Dune',
      }),
    );
    await service.deleteWork(existing.id);

    const queueItems = await queueRepository.listAll();

    expect(queueItems).toHaveLength(1);
    expect(queueItems[0]).toEqual(
      expect.objectContaining({
        entityId: existing.id,
        operation: 'delete',
        source: 'edit_form',
        payload: expect.objectContaining({
          title: 'Children of Dune',
          deletedAt: expect.any(String),
          syncStatus: 'pending',
          serverVersion: 4,
        }),
      }),
    );
  });

  it('restores a deleted work and queues it back for sync', async () => {
    const existing = buildWork({
      deletedAt: '2026-04-18T01:00:00.000Z',
      syncStatus: 'synced',
      updatedAt: '2026-04-18T01:00:00.000Z',
    });

    await repository.create(existing);

    const restored = await service.restoreWork(existing.id);
    const queueItems = await queueRepository.listAll();

    expect(restored).toEqual(
      expect.objectContaining({
        deletedAt: null,
        syncStatus: 'pending',
      }),
    );
    expect(queueItems).toEqual([
      expect.objectContaining({
        entityId: existing.id,
        operation: 'update',
        source: 'restore',
        payload: expect.objectContaining({
          deletedAt: null,
          syncStatus: 'pending',
        }),
      }),
    ]);
  });

  it('queues progress edits with progress source metadata', async () => {
    const existing = buildWork();

    await repository.create(existing);

    await service.updateProgress(existing.id, {
      progressCurrent: 4,
      progressTotal: 10,
      progressUnit: 'chapter',
    });

    expect(await queueRepository.listAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: existing.id,
          operation: 'update',
          source: 'progress_update',
          payload: expect.objectContaining({
            progressCurrent: 4,
            progressTotal: 10,
            progressUnit: 'chapter',
          }),
        }),
        expect.objectContaining({
          entityType: 'timeline_entry',
          operation: 'create',
          payload: expect.objectContaining({
            source: 'automatic',
            type: 'progress',
          }),
        }),
      ]),
    );
    expect(await timelineRepository.listByWorkId(existing.id)).toEqual([
      expect.objectContaining({
        note: '진행도 변경: 4/10화',
        source: 'automatic',
        type: 'progress',
      }),
    ]);
  });

  it('records meaningful status changes once and keeps automatic entries deletable', async () => {
    const existing = buildWork({ status: 'planned' });

    await repository.create(existing);

    await service.updateWork(existing.id, buildInput({ status: 'completed' }));
    await service.updateWork(existing.id, buildInput({ status: 'completed' }));

    const entries = await timelineRepository.listByWorkId(existing.id);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        note: '상태 변경: 볼 예정 → 완료',
        source: 'automatic',
        type: 'completed',
      }),
    );

    await timelineRepository.softDelete(entries[0]!.id);
    expect(await timelineRepository.listByWorkId(existing.id)).toEqual([]);
  });

  it('does not create progress noise when the saved values did not change', async () => {
    const existing = buildWork({
      lastConsumedLabel: '4화까지',
      progressCurrent: 4,
      progressTotal: 10,
      progressUnit: 'chapter',
    });

    await repository.create(existing);
    await service.updateProgress(existing.id, {
      lastConsumedLabel: '4화까지',
      progressCurrent: 4,
      progressTotal: 10,
      progressUnit: 'chapter',
    });

    expect(await timelineRepository.listByWorkId(existing.id)).toEqual([]);
  });

  it('rolls back the work and automatic entry when timeline enqueueing fails', async () => {
    const existing = buildWork({ status: 'planned' });

    await repository.create(existing);
    vi.spyOn(queueRepository, 'enqueueTimelineEntryChange').mockRejectedValue(
      new Error('timeline enqueue failed'),
    );

    await expect(
      service.updateWork(existing.id, buildInput({ status: 'completed' })),
    ).rejects.toThrow('timeline enqueue failed');

    expect(await repository.getById(existing.id)).toEqual(
      expect.objectContaining({ status: 'planned' }),
    );
    expect(await timelineRepository.listByWorkId(existing.id)).toEqual([]);
    expect(await queueRepository.listAll()).toEqual([]);
  });

  it('separates graph tag suggestions from personal tag suggestions', async () => {
    await service.createWork(
      buildInput({
        genres: ['Fantasy'],
        personalTags: [
          'series:Fate',
          'universe:TYPE-MOON',
          'studio:ufotable',
          'rewatch',
        ],
        title: 'Fate/stay night',
      }),
    );
    await service.createWork(
      buildInput({
        author: 'Frank Herbert',
        genres: ['Science Fiction'],
        personalTags: ['creator:Frank Herbert', 'favorite prose'],
        title: 'Dune',
      }),
    );

    const result = await service.listWorks(
      {
        rating: null,
        searchTerm: '',
        sortBy: 'title',
        status: 'all',
        tag: '',
        type: 'all',
      },
      'active',
    );

    expect(result.seriesSuggestions).toEqual(['Fate', 'TYPE-MOON']);
    expect(result.contributorSuggestions).toEqual([
      'Frank Herbert',
      'ufotable',
    ]);
    expect(result.genreSuggestions).toEqual([...WORK_GENRES]);
    expect(result.genreSuggestions).not.toContain('Science Fiction');
    expect(result.tagSuggestions).toEqual(
      expect.arrayContaining([
        'Fantasy',
        'Science Fiction',
        'favorite prose',
        'rewatch',
      ]),
    );
    expect(result.tagSuggestions).toHaveLength(4);
  });

  it('counts soft-deleted records without materializing them for list queries', async () => {
    await repository.bulkPut([
      buildWork({ id: 'active-1', deletedAt: null }),
      buildWork({ id: 'deleted-1', deletedAt: '2026-04-18T00:00:00.000Z' }),
      buildWork({ id: 'deleted-2', deletedAt: '2026-04-19T00:00:00.000Z' }),
    ]);
    const listDeletedSpy = vi.spyOn(repository, 'listDeleted');
    const countByScopeSpy = vi.spyOn(repository, 'countByScope');

    const result = await service.listWorks(
      {
        rating: null,
        searchTerm: '',
        sortBy: 'updatedAt',
        status: 'all',
        tag: '',
        type: 'all',
      },
      'active',
    );

    expect(result.totalActiveCount).toBe(1);
    expect(result.totalDeletedCount).toBe(2);
    expect(countByScopeSpy).toHaveBeenCalledWith('deleted');
    expect(listDeletedSpy).not.toHaveBeenCalled();
  });

  it('keeps list queries within the large local archive budget', async () => {
    const statuses = [
      'planned',
      'in_progress',
      'completed',
      'dropped',
    ] as const;
    const works = Array.from({ length: 6000 }, (_, index) => {
      const isDeleted = index >= 5000;
      const updatedAt = new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString();

      return buildWork({
        deletedAt: isDeleted ? updatedAt : null,
        genres: ['판타지'],
        id: `large-work-${index}`,
        personalTags: [`tag-${index % 500}`],
        status: statuses[index % statuses.length]!,
        title: `Work ${index}`,
        type: index % 2 === 0 ? 'novel' : 'movie',
        updatedAt,
      });
    });

    await repository.bulkPut(works);

    const startedAt = performance.now();
    const result = await service.listWorks(
      {
        rating: null,
        searchTerm: '',
        sortBy: 'updatedAt',
        status: 'completed',
        tag: '',
        type: 'all',
      },
      'active',
    );
    const durationMs = performance.now() - startedAt;

    expect(result.totalActiveCount).toBe(5000);
    expect(result.totalDeletedCount).toBe(1000);
    expect(result.statusCounts.completed).toBe(1250);
    expect(result.tagSuggestions).toHaveLength(500);
    expect(result.works).toHaveLength(1250);
    expect(result.works.every((work) => work.deletedAt === null)).toBe(true);
    expect(durationMs).toBeLessThan(3000);
  });
});
