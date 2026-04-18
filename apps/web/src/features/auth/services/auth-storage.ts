export interface StoredAuthTokens {
  accessToken: string;
  refreshToken: string;
}

const AUTH_STORAGE_KEY = 'work-archive.auth.tokens';
const authTokenListeners = new Set<
  (tokens: StoredAuthTokens | null) => void
>();

function isBrowser() {
  return typeof window !== 'undefined';
}

function notifyAuthTokenListeners(tokens: StoredAuthTokens | null) {
  for (const listener of authTokenListeners) {
    listener(tokens);
  }
}

export function readStoredAuthTokens(): StoredAuthTokens | null {
  if (!isBrowser()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<StoredAuthTokens>;

    if (
      typeof parsedValue.accessToken !== 'string' ||
      typeof parsedValue.refreshToken !== 'string'
    ) {
      return null;
    }

    return {
      accessToken: parsedValue.accessToken,
      refreshToken: parsedValue.refreshToken,
    };
  } catch {
    return null;
  }
}

export function writeStoredAuthTokens(tokens: StoredAuthTokens) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
  notifyAuthTokenListeners(tokens);
}

export function clearStoredAuthTokens() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
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
