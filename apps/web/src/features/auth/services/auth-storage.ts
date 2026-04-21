import {
  createBrowserLocalStorageAdapter,
  createJsonStorageAdapter,
} from '../../../shared/runtime/storage-adapter';

export interface StoredAuthTokens {
  accessToken: string;
}

const AUTH_STORAGE_KEY = 'work-archive.auth.tokens';
const authTokenListeners = new Set<(tokens: StoredAuthTokens | null) => void>();
const authTokenStorage = createJsonStorageAdapter<StoredAuthTokens>({
  key: AUTH_STORAGE_KEY,
  storage: createBrowserLocalStorageAdapter(),
  validate(value): value is StoredAuthTokens {
    return (
      typeof value === 'object' &&
      value !== null &&
      'accessToken' in value &&
      typeof value.accessToken === 'string'
    );
  },
});

function notifyAuthTokenListeners(tokens: StoredAuthTokens | null) {
  for (const listener of authTokenListeners) {
    listener(tokens);
  }
}

export function readStoredAuthTokens(): StoredAuthTokens | null {
  return authTokenStorage.read();
}

export function writeStoredAuthTokens(tokens: StoredAuthTokens) {
  authTokenStorage.write(tokens);
  notifyAuthTokenListeners(tokens);
}

export function clearStoredAuthTokens() {
  authTokenStorage.clear();
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
