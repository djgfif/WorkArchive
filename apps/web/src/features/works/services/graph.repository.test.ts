import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';
import { SyncQueueRepository } from '@features/sync';
import { GraphRepository } from './graph.repository';

describe('GraphRepository outgoing relations', () => {
  let db: WorkArchiveDatabase;
  let graphRepo: GraphRepository;

  beforeEach(() => {
    db = createWorkArchiveDb(`work-archive-graph-test-${crypto.randomUUID()}`);
    graphRepo = new GraphRepository(() => db, new SyncQueueRepository(() => db));
  });

  afterEach(async () => {
    await db.delete();
  });

  it('creates, reuses, and soft-deletes a relation through indexed lookups', async () => {
    await graphRepo.saveWorkGraph(
      'work-a',
      {
        series: [],
        contributors: [],
        relations: [
          { targetWorkId: 'work-b', relationType: 'season_next', note: 'first' },
        ],
      },
      'edit_form',
    );

    let snapshot = await graphRepo.listActiveGraph();
    expect(snapshot.workRelations).toHaveLength(1);
    expect(snapshot.workRelations[0]).toMatchObject({
      sourceWorkId: 'work-a',
      targetWorkId: 'work-b',
      relationType: 'season_next',
      note: 'first',
    });
    const relationId = snapshot.workRelations[0]!.id;

    // Re-saving the same (source, target, type) must reuse the row found by the
    // [sourceWorkId+targetWorkId+relationType] index, not create a duplicate.
    await graphRepo.saveWorkGraph(
      'work-a',
      {
        series: [],
        contributors: [],
        relations: [
          { targetWorkId: 'work-b', relationType: 'season_next', note: 'updated' },
        ],
      },
      'edit_form',
    );

    snapshot = await graphRepo.listActiveGraph();
    expect(snapshot.workRelations).toHaveLength(1);
    expect(snapshot.workRelations[0]!.id).toBe(relationId);
    expect(snapshot.workRelations[0]!.note).toBe('updated');

    // Dropping it from the desired set soft-deletes it via the active-by-source
    // scan (workId index + isActive filter).
    await graphRepo.saveWorkGraph(
      'work-a',
      { series: [], contributors: [], relations: [] },
      'edit_form',
    );

    snapshot = await graphRepo.listActiveGraph();
    expect(snapshot.workRelations).toHaveLength(0);
  });
});
