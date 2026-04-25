import {
  createBrowserLocalStorageAdapter,
} from '../../../shared/runtime/storage-adapter';

export type AuthTokenPersistence = 'local' | 'session';

export interface StoredAuthTokens {
  accessToken: string;
  persistence: AuthTokenPersistence;
}

const AUTH_STORAGE_KEY = 'work-archive.auth.tokens';
const authTokenListeners = new Set<(tokens: StoredAuthTokens | null) => void>();
const localAuthTokenStorage = createBrowserLocalStorageAdapter();
const sessionAuthTokenStorage = createBrowserLocalStorageAdapter(
  typeof window === 'undefined' ? null : window.sessionStorage,
);

function notifyAuthTokenListeners(tokens: StoredAuthTokens | null) {
  for (const listener of authTokenListeners) {
    listener(tokens);
  }
}

export function readStoredAuthTokens(): StoredAuthTokens | null {
  return (
    readTokensFromStorage(sessionAuthTokenStorage, 'session') ??
    readTokensFromStorage(localAuthTokenStorage, 'local')
  );
}

export function writeStoredAuthTokens(
  tokens: Pick<StoredAuthTokens, 'accessToken'>,
  persistence: AuthTokenPersistence = 'local',
) {
  const nextTokens = {
    accessToken: tokens.accessToken,
    persistence,
  };

  if (persistence === 'local') {
    sessionAuthTokenStorage.clear(AUTH_STORAGE_KEY);
    writeTokensToStorage(localAuthTokenStorage, nextTokens);
  } else {
    localAuthTokenStorage.clear(AUTH_STORAGE_KEY);
    writeTokensToStorage(sessionAuthTokenStorage, nextTokens);
  }

  notifyAuthTokenListeners(nextTokens);
}

export function clearStoredAuthTokens() {
  localAuthTokenStorage.clear(AUTH_STORAGE_KEY);
  sessionAuthTokenStorage.clear(AUTH_STORAGE_KEY);
  notifyAuthTokenListeners(null);
}

export function subscribeToStoredAuthTokens(
  listener: (tokens: StoredAuthTokens | null) => void,
) {
  authTokenListeners.add(listener);

  return () => {
    authTokenListeners.delete(listener);
  };
}

function readTokensFromStorage(
  storage: typeof localAuthTokenStorage,
  fallbackPersistence: AuthTokenPersistence,
): StoredAuthTokens | null {
  if (!storage.isAvailable()) {
    return null;
  }

  const rawValue = storage.read(AUTH_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    if (
      typeof parsedValue !== 'object' ||
      parsedValue === null ||
      !('accessToken' in parsedValue) ||
      typeof parsedValue.accessToken !== 'string'
    ) {
      return null;
    }

    const parsedPersistence =
      'persistence' in parsedValue ? parsedValue.persistence : fallbackPersistence;
    const persistence =
      parsedPersistence === 'local' || parsedPersistence === 'session'
        ? parsedPersistence
        : fallbackPersistence;

    return {
      accessToken: parsedValue.accessToken,
      persistence,
    };
  } catch {
    return null;
  }
}

function writeTokensToStorage(
  storage: typeof localAuthTokenStorage,
  tokens: StoredAuthTokens,
) {
  if (!storage.isAvailable()) {
    return;
  }

  storage.write(AUTH_STORAGE_KEY, JSON.stringify(tokens));
}
