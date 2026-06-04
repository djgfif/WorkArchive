import { useEffect, useRef, useState, type PropsWithChildren } from 'react';

import {
  getGoogleLoginStartUrl,
  logoutSession,
  restoreStoredSession,
  type AuthUser,
} from '../services/auth.api';
import { guestTransferService } from '../services/guest-transfer.service';
import {
  clearStoredAuthTokens,
  subscribeToStoredAuthTokens,
  writeStoredAuthTokens,
} from '../services/auth-storage';
import { workArchiveDbManager } from '../../works/storage';
import { AuthContext, type AuthContextValue } from './AuthContext';

const GOOGLE_RETURN_TO_STORAGE_KEY = 'work-archive.auth.googleReturnTo';
const GOOGLE_AUTH_COMPLETE_PATH = '/auth/google/complete';

function isGoogleAuthCompletePath() {
  return window.location.pathname === GOOGLE_AUTH_COMPLETE_PATH;
}

function normalizeGoogleReturnTo(returnTo?: string | null) {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return null;
  }

  if (
    returnTo === '/auth' ||
    returnTo.startsWith('/auth/') ||
    returnTo.startsWith('/auth?') ||
    returnTo.startsWith('/auth#')
  ) {
    return null;
  }

  return returnTo;
}

function writeGoogleReturnTo(returnTo?: string) {
  const normalizedReturnTo = normalizeGoogleReturnTo(returnTo);

  try {
    if (normalizedReturnTo) {
      window.sessionStorage.setItem(
        GOOGLE_RETURN_TO_STORAGE_KEY,
        normalizedReturnTo,
      );

      return;
    }

    window.sessionStorage.removeItem(GOOGLE_RETURN_TO_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function consumeGoogleReturnTo() {
  try {
    const returnTo = normalizeGoogleReturnTo(
      window.sessionStorage.getItem(GOOGLE_RETURN_TO_STORAGE_KEY),
    );

    window.sessionStorage.removeItem(GOOGLE_RETURN_TO_STORAGE_KEY);

    return returnTo;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [archiveScopeKey, setArchiveScopeKey] = useState(
    workArchiveDbManager.getCurrentScopeKey(),
  );
  const sessionGenerationRef = useRef(0);
  const startupRestoreGenerationRef = useRef<number | null>(null);

  function activateGuestSession() {
    workArchiveDbManager.switchToGuest();
    setUser(null);
    setArchiveScopeKey(workArchiveDbManager.getCurrentScopeKey());
    setIsLoading(false);
  }

  function activateAuthenticatedArchive(user: AuthUser) {
    workArchiveDbManager.switchToUser(user.id);
    setUser(user);
    setArchiveScopeKey(workArchiveDbManager.getCurrentScopeKey());
    setIsLoading(false);
  }

  async function getPostGoogleSignInLocation(user: AuthUser) {
    const returnTo = consumeGoogleReturnTo();
    const pendingGuestTransfer = await guestTransferService.getPendingReview(
      user.id,
    );

    return pendingGuestTransfer ? '/account/transfer' : (returnTo ?? '/');
  }

  useEffect(() => {
    let isCancelled = false;
    const restoreGeneration = sessionGenerationRef.current;

    if (isGoogleAuthCompletePath()) {
      startupRestoreGenerationRef.current = null;
      setIsLoading(false);

      return () => {
        isCancelled = true;
      };
    }

    startupRestoreGenerationRef.current = restoreGeneration;
    const unsubscribe = subscribeToStoredAuthTokens((tokens) => {
      if (isCancelled || tokens !== null) {
        return;
      }

      if (
        startupRestoreGenerationRef.current !== null &&
        sessionGenerationRef.current !== startupRestoreGenerationRef.current
      ) {
        return;
      }

      activateGuestSession();
    });

    async function initializeSession() {
      const restoredSession = await restoreStoredSession();

      if (isCancelled) {
        return;
      }

      if (sessionGenerationRef.current !== restoreGeneration) {
        startupRestoreGenerationRef.current = null;

        return;
      }

      startupRestoreGenerationRef.current = null;

      if (restoredSession) {
        writeStoredAuthTokens(restoredSession.tokens);
        activateAuthenticatedArchive(restoredSession.user);

        return;
      }

      clearStoredAuthTokens();
      activateGuestSession();
    }

    void initializeSession();

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, []);

  async function activateAuthenticatedSession(
    user: AuthUser,
    tokens: {
      accessToken: string;
    },
  ) {
    sessionGenerationRef.current += 1;
    startupRestoreGenerationRef.current = null;
    writeStoredAuthTokens(tokens);
    activateAuthenticatedArchive(user);

    return getPostGoogleSignInLocation(user);
  }

  function continueWithGoogle(returnTo?: string) {
    writeGoogleReturnTo(returnTo);
    window.location.assign(getGoogleLoginStartUrl(window.location.origin));
  }

  async function completeGoogleSignIn() {
    if (user) {
      return getPostGoogleSignInLocation(user);
    }

    const restoredSession = await restoreStoredSession({ force: true });

    if (!restoredSession) {
      throw new Error('Google sign-in session could not be restored.');
    }

    return activateAuthenticatedSession(
      restoredSession.user,
      restoredSession.tokens,
    );
  }

  async function signOut() {
    sessionGenerationRef.current += 1;
    startupRestoreGenerationRef.current = null;

    try {
      await logoutSession();
    } catch {
      // 세션 정리는 로컬 전환이 우선이므로 서버 logout 실패는 무시합니다.
    }

    clearStoredAuthTokens();
    activateGuestSession();
  }

  function updateUser(nextUser: AuthUser) {
    setUser(nextUser);
  }

  const value: AuthContextValue = {
    archiveScopeKey,
    completeGoogleSignIn,
    continueWithGoogle,
    isLoading,
    mode: user ? 'authenticated' : 'guest',
    user,
    signOut,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
