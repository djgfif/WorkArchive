import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkRecord } from '@work-archive/shared-types';

import { SyncQueueRepository } from '../../sync/services/sync-queue.repository';
import { createWorkArchiveDb, type WorkArchiveDatabase } from '../../works/db/work-archive.db';
import { WorksRepository } from '../../works/services/works.repository';
import { TierBoardRepository } from './tier-board.repository';
import { TierBoardService } from './tier-board.service';

const now = '2026-05-20T00:00:00.000Z';

function buildWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: crypto.randomUUID(),
    type: 'anime',
    title: 'Snapshot Work',
    author: 'Archive Studio',
    genres: ['Action'],
    personalTags: ['source-tag'],
    description: '',
    thumbnailUrl: 'https://example.com/poster.jpg',
    status: 'completed',
    rating: 4.5,
    shortReview: 'Snapshot note',
    review: '',
    favorite: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'synced',
    serverVersion: 2,
    ...overrides,
  };
}

describe('TierBoardService', () => {
  let db: WorkArchiveDatabase;
  let queueRepository: SyncQueueRepository;
  let repository: TierBoardRepository;
  let worksRepository: WorksRepository;
  let service: TierBoardService;

  beforeEach(async () => {
    db = createWorkArchiveDb(`tier-board-test-${crypto.randomUUID()}`);
    await db.open();
    await db.syncQueue.clear();
    repository = new TierBoardRepository(() => db);
    queueRepository = new SyncQueueRepository(() => db);
    worksRepository = new WorksRepository(() => db);
    service = new TierBoardService(repository, queueRepository, worksRepository);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('creates, duplicates, and soft-deletes boards through the local queue path', async () => {
    const board = await service.createBoard({ title: '전투력 순위' });
    const state = await service.getBoardEditorState(board.id);

    expect(state?.lanes.map((lane) => lane.title)).toEqual(['S', 'A', 'B', 'C', 'D']);
    expect(await queueRepository.listAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityType: 'tier_board', operation: 'create' }),
        expect.objectContaining({ entityType: 'tier_lane', operation: 'create' }),
      ]),
    );

    const duplicated = await service.duplicateBoard(board.id);
    expect(duplicated.id).not.toBe(board.id);
    expect(await service.getBoardById(duplicated.id)).toEqual(
      expect.objectContaining({ title: expect.stringContaining(board.title) }),
    );

    const snapshot = await service.deleteBoard(board.id);
    expect(snapshot.board.id).toBe(board.id);
    expect(await service.getBoardById(board.id)).toBeNull();
    expect((await queueRepository.listAll()).some((card) => card.entityId === board.id)).toBe(false);
  });

  it('keeps lane deletion and card movement independent from work records', async () => {
    const board = await service.createBoard({ title: '호감도 순위' });
    const lane = await service.createLane(board.id, {
      colorToken: '#22c55e',
      title: '최애',
    });
    const work = await worksRepository.create(buildWork());
    const workCard = await service.createCardFromWorkSnapshot(board.id, work.id, lane.id);
    const textCard = await service.createCard(board.id, {
      laneId: null,
      note: '메모',
      subtitle: '직접 만든 카드',
      title: '커스텀 카드',
    });

    await service.moveCardToLane(textCard.id, lane.id);
    expect(await repository.getCardById(textCard.id)).toEqual(
      expect.objectContaining({ laneId: lane.id, orderIndex: 1 }),
    );

    await service.deleteLane(lane.id);
    expect(await repository.getLaneById(lane.id)).toBeNull();
    expect(await repository.getCardById(workCard.id)).toEqual(
      expect.objectContaining({ laneId: null, cardSourceType: 'library_work', workId: work.id }),
    );
    expect(await worksRepository.getById(work.id)).toEqual(work);
  });

  it('exports and imports board JSON without raw uploaded blobs', async () => {
    const board = await service.createBoard({ title: 'OP/ED 순위' });
    const card = await service.createImageUrlCard(board.id, {
      imageUrl: 'https://example.com/op.jpg',
      subtitle: 'Opening',
      title: 'OP 1',
    });
    const file = {
      arrayBuffer: async () => new TextEncoder().encode('image-bytes').buffer,
      name: 'cover.png',
      size: 11,
      type: 'image/png',
    } as File;
    const uploaded = await service.createUploadedImageCard(board.id, file, {
      laneId: null,
      title: '업로드 이미지',
    });

    await service.moveCardToLane(card.id, (await service.getBoardEditorState(board.id))!.lanes[0]!.id);
    const exported = await service.exportBoardJson(board.id);

    expect(exported.assets[0]).not.toHaveProperty('blob');
    expect(exported.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardSourceType: 'image_url', imageUrl: 'https://example.com/op.jpg' }),
        expect.objectContaining({ id: uploaded.card.id, cardSourceType: 'image_upload' }),
      ]),
    );

    const imported = await service.importBoardJson(JSON.stringify(exported));
    expect(imported.id).not.toBe(board.id);
    expect((await service.getBoardEditorState(imported.id))?.cards).toHaveLength(2);
  });
});
