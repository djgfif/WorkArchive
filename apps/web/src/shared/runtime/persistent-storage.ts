/**
 * 로컬 퍼스트 저장소 보호.
 *
 * 브라우저는 디스크가 부족하면 "best-effort" IndexedDB 를 임의로 비울 수 있다.
 * navigator.storage.persist() 로 영구(persistent) 등급을 요청하면 사용자가
 * 직접 지우기 전까지 데이터가 보존된다. 이 앱의 기록은 기기에 먼저 저장되므로
 * 영구 등급 확보가 데이터 안전의 핵심이다.
 */

export interface StoragePersistenceState {
  persisted: boolean;
  quotaBytes: number | null;
  supported: boolean;
  usageBytes: number | null;
}

function getStorageManager(): StorageManager | null {
  if (typeof navigator === 'undefined') {
    return null;
  }

  return navigator.storage ?? null;
}

export async function getStoragePersistenceState(): Promise<StoragePersistenceState> {
  const storage = getStorageManager();

  if (!storage || typeof storage.persisted !== 'function') {
    return {
      persisted: false,
      quotaBytes: null,
      supported: false,
      usageBytes: null,
    };
  }

  const persisted = await storage.persisted().catch(() => false);
  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;

  if (typeof storage.estimate === 'function') {
    try {
      const estimate = await storage.estimate();

      usageBytes = estimate.usage ?? null;
      quotaBytes = estimate.quota ?? null;
    } catch {
      // estimate 실패는 무시한다.
    }
  }

  return {
    persisted,
    quotaBytes,
    supported: true,
    usageBytes,
  };
}

/**
 * 영구 저장소를 요청한다. 이미 영구이거나 요청이 승인되면 true.
 * 브라우저·정책에 따라 프롬프트 없이 자동 승인/거부될 수 있다.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = getStorageManager();

  if (!storage || typeof storage.persist !== 'function') {
    return false;
  }

  if (typeof storage.persisted === 'function') {
    const alreadyPersisted = await storage.persisted().catch(() => false);

    if (alreadyPersisted) {
      return true;
    }
  }

  return storage.persist().catch(() => false);
}

/**
 * 앱 시작 시 한 번 영구 저장소를 조용히 요청한다. 실패해도 앱 흐름을 막지 않는다.
 */
export function ensurePersistentStorage(): void {
  void requestPersistentStorage();
}
