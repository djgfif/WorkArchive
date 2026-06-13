import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getStoragePersistenceState,
  requestPersistentStorage,
} from './persistent-storage';

describe('persistent storage runtime', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports unsupported browsers without throwing', async () => {
    vi.stubGlobal('navigator', {});

    await expect(getStoragePersistenceState()).resolves.toEqual({
      persisted: false,
      quotaBytes: null,
      supported: false,
      usageBytes: null,
    });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('reads persisted state and quota estimates', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn(async () => ({
          quota: 2_000,
          usage: 500,
        })),
        persisted: vi.fn(async () => true),
      },
    });

    await expect(getStoragePersistenceState()).resolves.toEqual({
      persisted: true,
      quotaBytes: 2_000,
      supported: true,
      usageBytes: 500,
    });
  });

  it('does not request persistence again when it is already granted', async () => {
    const persist = vi.fn(async () => true);

    vi.stubGlobal('navigator', {
      storage: {
        persist,
        persisted: vi.fn(async () => true),
      },
    });

    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns the browser decision when requesting persistence', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persist: vi.fn(async () => false),
        persisted: vi.fn(async () => false),
      },
    });

    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});
