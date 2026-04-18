export interface StoredAuthTokens {
  accessToken: string;
  refreshToken: string;
}

const AUTH_STORAGE_KEY = 'work-archive.auth.tokens';

function isBrowser() {
  return typeof window !== 'undefined';
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
}

export function clearStoredAuthTokens() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
