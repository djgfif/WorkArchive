import type { AuthUser } from './auth.api';

const ARCHIVE_IDENTITY_STORAGE_KEY = 'work-archive.auth.archiveIdentity.v1';

export interface StoredArchiveIdentity {
  lastAuthenticatedAt: string;
  user: AuthUser;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AuthUser>;

  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.email === 'string'
  );
}

export function readStoredArchiveIdentity(): StoredArchiveIdentity | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(ARCHIVE_IDENTITY_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<StoredArchiveIdentity>;

    if (
      typeof parsedValue.lastAuthenticatedAt !== 'string' ||
      !isAuthUser(parsedValue.user)
    ) {
      clearStoredArchiveIdentity();
      return null;
    }

    return {
      lastAuthenticatedAt: parsedValue.lastAuthenticatedAt,
      user: parsedValue.user,
    };
  } catch {
    clearStoredArchiveIdentity();
    return null;
  }
}

export function writeStoredArchiveIdentity(user: AuthUser) {
  if (typeof window === 'undefined') {
    return;
  }

  const identity: StoredArchiveIdentity = {
    lastAuthenticatedAt: new Date().toISOString(),
    user,
  };

  try {
    window.localStorage.setItem(
      ARCHIVE_IDENTITY_STORAGE_KEY,
      JSON.stringify(identity),
    );
  } catch {
    // Restricted browser contexts can block localStorage. The active tab still
    // keeps the correct user DB; only reload recovery is unavailable.
  }
}

export function clearStoredArchiveIdentity() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(ARCHIVE_IDENTITY_STORAGE_KEY);
  } catch {
    // Ignore restricted browser storage failures during explicit logout.
  }
}
