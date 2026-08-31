import { describe, expect, it } from 'vitest';

import type { ArchiveHealthIssue } from './archive-health.service';
import {
  ArchiveHealthReviewSessionService,
  buildArchiveHealthEditUrl,
  createArchiveHealthReviewItems,
  parseArchiveHealthIssueCodes,
} from './archive-health-review-session.service';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function buildIssue(
  overrides: Partial<ArchiveHealthIssue> = {},
): ArchiveHealthIssue {
  return {
    code: 'completed_without_date',
    details: {},
    id: 'work-1:completed_without_date',
    severity: 'review',
    workId: 'work-1',
    workTitle: 'Review work',
    ...overrides,
  };
}

describe('archive health review item helpers', () => {
  it('groups manual-review issues and excludes improvements and safe fixes', () => {
    expect(
      createArchiveHealthReviewItems([
        buildIssue(),
        buildIssue({
          code: 'started_after_completed',
          id: 'work-1:started_after_completed',
          severity: 'attention',
        }),
        buildIssue({
          code: 'missing_thumbnail',
          id: 'work-2:missing_thumbnail',
          severity: 'improvement',
          workId: 'work-2',
        }),
        buildIssue({
          code: 'progress_unit_missing',
          id: 'work-3:progress_unit_missing',
          safeFix: {
            kind: 'set_progress_unit',
            progressUnit: 'volume',
          },
          workId: 'work-3',
        }),
      ]),
    ).toEqual([
      {
        issueCodes: ['completed_without_date', 'started_after_completed'],
        workId: 'work-1',
      },
    ]);
  });

  it('builds and parses a constrained edit URL', () => {
    const url = buildArchiveHealthEditUrl('work/with space', {
      issueCodes: [
        'completed_without_date',
        'completed_without_date',
        'started_after_completed',
      ],
      reviewSessionId: 'session-1',
    });

    expect(url).toBe(
      '/works/work%2Fwith%20space/edit?focus=archive-health&issues=completed_without_date%2Cstarted_after_completed&reviewSession=session-1',
    );
    expect(
      parseArchiveHealthIssueCodes(
        'completed_without_date,unknown,completed_without_date',
      ),
    ).toEqual(['completed_without_date']);
  });
});

describe('ArchiveHealthReviewSessionService', () => {
  it('uses a Web Crypto UUID for the default browser-backed session', () => {
    const service = new ArchiveHealthReviewSessionService();
    const session = service.create([
      {
        issueCodes: ['completed_without_date'],
        workId: 'work-crypto',
      },
    ]);

    expect(session).not.toBeNull();
    expect(session?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(service.getContext(session!.id, 'work-crypto')).toMatchObject({
      currentItem: { workId: 'work-crypto' },
      total: 1,
    });

    service.remove(session!.id);
    expect(service.getContext(session!.id, 'work-crypto')).toBeNull();
  });

  it('stores the queue contract and advances by the current work', () => {
    const storage = new MemoryStorage();
    const service = new ArchiveHealthReviewSessionService(
      () => storage,
      () => new Date('2026-08-02T00:00:00.000Z'),
      () => 'session-1',
    );
    const session = service.create([
      {
        issueCodes: ['completed_without_date'],
        workId: 'work-1',
      },
      {
        issueCodes: ['dropped_without_date'],
        workId: 'work-2',
      },
    ]);

    expect(session).toMatchObject({
      createdAt: '2026-08-02T00:00:00.000Z',
      id: 'session-1',
      version: 1,
    });
    expect(service.getContext('session-1', 'work-1')).toMatchObject({
      currentIndex: 0,
      currentItem: { workId: 'work-1' },
      nextItem: { workId: 'work-2' },
      total: 2,
    });
    expect(JSON.parse(storage.getItem(storage.key(0)!)!)).not.toHaveProperty(
      'workTitle',
    );

    service.remove('session-1');

    expect(service.getContext('session-1', 'work-1')).toBeNull();
  });

  it('fails safely when tab storage is unavailable', () => {
    const inaccessibleStorage: Storage = {
      clear: () => undefined,
      getItem: () => {
        throw new Error('storage blocked');
      },
      key: () => null,
      length: 0,
      removeItem: () => {
        throw new Error('storage blocked');
      },
      setItem: () => {
        throw new Error('storage blocked');
      },
    };
    const service = new ArchiveHealthReviewSessionService(
      () => inaccessibleStorage,
      () => new Date('2026-08-02T00:00:00.000Z'),
      () => 'session-blocked',
    );

    expect(
      service.create([
        {
          issueCodes: ['completed_without_date'],
          workId: 'work-1',
        },
      ]),
    ).toBeNull();
    expect(service.getContext('session-blocked', 'work-1')).toBeNull();
    expect(() => service.remove('session-blocked')).not.toThrow();
  });

  it('expires a session after 24 hours', () => {
    const storage = new MemoryStorage();
    let now = new Date('2026-08-02T00:00:00.000Z');
    const service = new ArchiveHealthReviewSessionService(
      () => storage,
      () => now,
      () => 'session-expiring',
    );

    service.create([
      {
        issueCodes: ['completed_without_date'],
        workId: 'work-1',
      },
    ]);
    now = new Date('2026-08-03T00:00:00.001Z');

    expect(service.getContext('session-expiring', 'work-1')).toBeNull();
    expect(storage.length).toBe(0);
  });
});
