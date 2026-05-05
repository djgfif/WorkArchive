import { createBrowserLocalStorageAdapter } from '../../../shared/runtime/storage-adapter';

export interface MemoryAuthTokens {
  accessToken: string;
}

const AUTH_STORAGE_KEY = 'work-archive.auth.tokens';
const authTokenListeners = new Set<(tokens: MemoryAuthTokens | null) => void>();
const localAuthTokenStorage = createBrowserLocalStorageAdapter();
const sessionAuthTokenStorage = createBrowserLocalStorageAdapter(
  typeof window === 'undefined' ? null : window.sessionStorage,
);
let memoryAuthTokens: MemoryAuthTokens | null = null;

function notifyAuthTokenListeners(tokens: MemoryAuthTokens | null) {
  for (const listener of authTokenListeners) {
    listener(tokens);
  }
}

export function readStoredAuthTokens(): MemoryAuthTokens | null {
  return memoryAuthTokens ? { ...memoryAuthTokens } : null;
}

export function writeStoredAuthTokens(
  tokens: Pick<MemoryAuthTokens, 'accessToken'>,
) {
  const nextTokens = {
    accessToken: tokens.accessToken,
  };

  memoryAuthTokens = nextTokens;
  notifyAuthTokenListeners(nextTokens);
}

export function clearStoredAuthTokens() {
  memoryAuthTokens = null;
  clearLegacyStoredAuthTokens();
  notifyAuthTokenListeners(null);
}

export function subscribeToStoredAuthTokens(
  listener: (tokens: MemoryAuthTokens | null) => void,
) {
  authTokenListeners.add(listener);

  return () => {
    authTokenListeners.delete(listener);
  };
}

export function clearLegacyStoredAuthTokens() {
  localAuthTokenStorage.clear(AUTH_STORAGE_KEY);
  sessionAuthTokenStorage.clear(AUTH_STORAGE_KEY);
}
