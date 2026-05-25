import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkRecord } from '@work-archive/shared-types';

import { SyncQueueRepository } from '@features/sync';
import { createWorkArchiveDb, type WorkArchiveDatabase } from '@features/works';
import { WorksRepository } from '@features/works';
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

  it('logs tier_board.import.failed without raw image data or secret material', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      service.importBoardJson(
        JSON.stringify({
          token: 'refresh_token',
          authorization: 'Bearer access_token',
          dataUrl: 'data:image/png;base64,raw_image_data',
        }),
      ),
    ).rejects.toThrow();

    const logPayload = String(warnSpy.mock.calls.at(-1)?.[0] ?? '');

    expect(JSON.parse(logPayload)).toEqual(
      expect.objectContaining({
        durationMs: expect.any(Number),
        entityType: 'tier_board',
        errorCode: expect.any(String),
        event: 'tier_board.import.failed',
        requestId: null,
      }),
    );
    expect(logPayload).not.toMatch(
      /authorization|cookie|set-cookie|refresh_token|access_token|oauth_code|api_key|raw_image_data|data:image/i,
    );
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

  it('exports and imports uploaded image JSON with recoverable local blobs', async () => {
    const board = await service.createBoard({ title: 'OP/ED 순위' });
    const card = await service.createImageUrlCard(board.id, {
      imageUrl: 'https://example.com/op.jpg',
      subtitle: 'Opening',
      title: 'OP 1',
    });
    const file = new File([new TextEncoder().encode('image-bytes')], 'cover.png', {
      type: 'image/png',
    });
    const uploaded = await service.createUploadedImageCard(board.id, file, {
      laneId: null,
      title: '업로드 이미지',
    });

    await service.moveCardToLane(card.id, (await service.getBoardEditorState(board.id))!.lanes[0]!.id);
    const exported = await service.exportBoardJson(board.id);
    const uploadedAsset = exported.assets.find((asset) => asset.cardId === uploaded.card.id);

    expect(uploadedAsset).not.toHaveProperty('blob');
    expect(uploadedAsset).toEqual(
      expect.objectContaining({
        dataUrl: expect.stringMatching(/^data:image\/png;base64,/),
        storageType: 'local_blob',
      }),
    );
    expect(exported.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardSourceType: 'image_url', imageUrl: 'https://example.com/op.jpg' }),
        expect.objectContaining({ id: uploaded.card.id, cardSourceType: 'image_upload' }),
      ]),
    );

    const imported = await service.importBoardJson(JSON.stringify(exported));
    expect(imported.id).not.toBe(board.id);
    const importedState = await service.getBoardEditorState(imported.id);
    const importedUpload = importedState?.cards.find((candidate) => candidate.cardSourceType === 'image_upload');

    expect(importedState?.cards).toHaveLength(2);
    expect(importedState?.assets[0]).toEqual(
      expect.objectContaining({
        dataUrl: expect.stringMatching(/^data:image\/png;base64,/),
        objectUrl: expect.stringMatching(/^indexeddb:\/\/tier-board-assets\//),
        storageType: 'local_blob',
      }),
    );
    expect(importedUpload?.imageUrl).toBe(importedState?.assets[0]?.objectUrl);
    expect(importedState?.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardSourceType: 'image_url', imageUrl: 'https://example.com/op.jpg' }),
      ]),
    );
  });

  it('keeps cards when importing old local_blob exports without image payloads', async () => {
    const board = await service.createBoard({ title: 'old export' });
    const file = new File([new TextEncoder().encode('image-bytes')], 'cover.png', {
      type: 'image/png',
    });
    await service.createUploadedImageCard(board.id, file, {
      laneId: null,
      title: 'old upload',
    });
    const exported = await service.exportBoardJson(board.id);
    const oldExport = {
      ...exported,
      assets: exported.assets.map(({ dataUrl: _dataUrl, ...asset }) => asset),
    };

    const imported = await service.importBoardJson(JSON.stringify(oldExport));
    const importedState = await service.getBoardEditorState(imported.id);

    expect(importedState?.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardSourceType: 'image_upload',
          imageUrl: '',
          title: 'old upload',
        }),
      ]),
    );
    expect(importedState?.assets[0]).toEqual(
      expect.objectContaining({
        blob: null,
        objectUrl: '',
        storageType: 'local_blob',
      }),
    );
  });

  it('re-enqueues restored board, lane, and card snapshots after delete undo', async () => {
    const board = await service.createBoard({ title: 'Undo sync' });
    const lane = await service.createLane(board.id, { title: '복원 행' });
    const card = await service.createCard(board.id, {
      laneId: lane.id,
      note: '되돌리기 검증',
      title: '복원 카드',
    });

    await db.tierBoards.update(board.id, { serverVersion: 3, syncStatus: 'synced' });
    await db.tierLanes.update(lane.id, { serverVersion: 4, syncStatus: 'synced' });
    await db.tierBoardCards.update(card.id, { serverVersion: 5, syncStatus: 'synced' });
    await db.syncQueue.clear();

    const boardSnapshot = await service.deleteBoard(board.id);
    expect(await queueRepository.listAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: board.id, entityType: 'tier_board', operation: 'delete' }),
      ]),
    );
    await service.restoreBoardSnapshot(boardSnapshot);
    expect(await queueRepository.listAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: board.id, entityType: 'tier_board', operation: 'update' }),
        expect.objectContaining({ entityId: lane.id, entityType: 'tier_lane', operation: 'update' }),
        expect.objectContaining({ entityId: card.id, entityType: 'tier_board_card', operation: 'update' }),
      ]),
    );
    expect((await queueRepository.listAll()).some((item) => item.operation === 'delete')).toBe(false);

    await db.syncQueue.clear();
    const cardSnapshot = await service.deleteCard(card.id);
    await service.restoreCardSnapshot(cardSnapshot);
    expect(await queueRepository.listAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: card.id, entityType: 'tier_board_card', operation: 'update' }),
      ]),
    );
    expect((await queueRepository.listAll()).some((item) => item.entityId === card.id && item.operation === 'delete')).toBe(false);

    await db.syncQueue.clear();
    const laneSnapshot = await service.deleteLane(lane.id);
    await service.restoreLaneDeleteSnapshot(laneSnapshot);
    expect(await queueRepository.listAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: lane.id, entityType: 'tier_lane', operation: 'update' }),
        expect.objectContaining({ entityId: card.id, entityType: 'tier_board_card', operation: 'update' }),
      ]),
    );
    expect(await repository.getCardById(card.id)).toEqual(
      expect.objectContaining({ laneId: lane.id, orderIndex: card.orderIndex }),
    );
    expect((await queueRepository.listAll()).some((item) => item.entityId === lane.id && item.operation === 'delete')).toBe(false);
  });

  it('never mutates WorkRecord when library_work cards are created, edited, moved, or deleted', async () => {
    const board = await service.createBoard({ title: 'Work snapshot guard' });
    const lane = (await service.getBoardEditorState(board.id))!.lanes[0]!;
    const work = await worksRepository.create(buildWork());
    const original = await worksRepository.getById(work.id);

    const card = await service.createCardFromWorkSnapshot(board.id, work.id, lane.id);
    await service.updateCard(card.id, {
      imageUrl: 'https://example.com/override.jpg',
      note: '카드 전용 메모',
      title: '카드 전용 제목',
    });
    await service.removeCardFromLane(card.id);
    await service.deleteCard(card.id);

    expect(await worksRepository.getById(work.id)).toEqual(original);
  });

  it('keeps work snapshot card fields unchanged after the source work is edited', async () => {
    const board = await service.createBoard({ title: 'Snapshot independence' });
    const work = await worksRepository.create(buildWork());
    const card = await service.createCardFromWorkSnapshot(board.id, work.id);

    await worksRepository.update({
      ...work,
      title: 'Edited Work Title',
      thumbnailUrl: 'https://example.com/edited.jpg',
      shortReview: 'Edited note',
      updatedAt: '2026-05-21T00:00:00.000Z',
    });

    expect(await repository.getCardById(card.id)).toEqual(
      expect.objectContaining({
        title: 'Snapshot Work',
        imageUrl: 'https://example.com/poster.jpg',
        note: 'Snapshot note',
        workId: work.id,
      }),
    );
  });

  it('keeps and queues a work snapshot card after the source work is soft-deleted', async () => {
    const board = await service.createBoard({ title: 'Deleted source work' });
    const work = await worksRepository.create(buildWork());
    const card = await service.createCardFromWorkSnapshot(board.id, work.id);

    await worksRepository.softDelete(work.id, {
      deletedAt: '2026-05-21T00:00:00.000Z',
      syncStatus: 'pending',
      updatedAt: '2026-05-21T00:00:00.000Z',
    });
    await service.moveCardToLane(card.id, (await service.getBoardEditorState(board.id))!.lanes[0]!.id);

    expect(await repository.getCardById(card.id)).toEqual(
      expect.objectContaining({
        cardSourceType: 'library_work',
        title: 'Snapshot Work',
        workId: work.id,
      }),
    );
    expect(await queueRepository.listAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: card.id,
          entityType: 'tier_board_card',
          payload: expect.objectContaining({
            title: 'Snapshot Work',
            workId: work.id,
          }),
        }),
      ]),
    );
  });

  it('exports work snapshot cards without the source WorkRecord or private work id', async () => {
    const board = await service.createBoard({ title: 'Export boundary' });
    const work = await worksRepository.create(buildWork());
    const card = await service.createCardFromWorkSnapshot(board.id, work.id);
    const exported = await service.exportBoardJson(board.id);
    const exportedCard = exported.cards.find((candidate) => candidate.id === card.id);

    expect(exportedCard).toEqual(
      expect.objectContaining({
        cardSourceType: 'library_work',
        title: 'Snapshot Work',
        subtitle: 'anime · Archive Studio · ★ 4.5',
        imageUrl: 'https://example.com/poster.jpg',
        note: 'Snapshot note',
        workId: null,
      }),
    );
    expect(JSON.stringify(exported)).not.toContain(work.id);
    expect(JSON.stringify(exported)).not.toContain('personalTags');
    expect(JSON.stringify(exported)).not.toContain('source-tag');
  });
});
