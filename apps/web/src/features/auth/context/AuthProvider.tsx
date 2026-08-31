import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { isSitesGuestPoc } from '@shared/runtime/deployment-profile';
import {
  ApiRequestError,
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
import {
  clearStoredArchiveIdentity,
  readStoredArchiveIdentity,
  writeStoredArchiveIdentity,
} from '../services/archive-identity';
import { workArchiveDbManager } from '../../works/storage';
import {
  AuthContext,
  type AuthContextValue,
  type AuthSessionStatus,
} from './AuthContext';

const GOOGLE_RETURN_TO_STORAGE_KEY = 'work-archive.auth.googleReturnTo';
const GOOGLE_AUTH_COMPLETE_PATH = '/auth/google/complete';
const OFFLINE_RESTORE_INITIAL_RETRY_MS = 1_000;
const OFFLINE_RESTORE_MAX_RETRY_MS = 30_000;

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
  const sitesGuestPoc = isSitesGuestPoc();
  const initialIdentityRef = useRef<
    ReturnType<typeof readStoredArchiveIdentity> | undefined
  >(undefined);

  if (initialIdentityRef.current === undefined) {
    if (sitesGuestPoc) {
      initialIdentityRef.current = null;
      workArchiveDbManager.switchToGuest();
    } else {
      initialIdentityRef.current = readStoredArchiveIdentity();
      if (initialIdentityRef.current) {
        workArchiveDbManager.switchToUser(initialIdentityRef.current.user.id);
      }
    }
  }

  const initialUser = initialIdentityRef.current?.user ?? null;
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!sitesGuestPoc);
  const [sessionStatus, setSessionStatus] = useState<AuthSessionStatus>(
    sitesGuestPoc ? 'guest' : 'restoring',
  );
  const [archiveScopeKey, setArchiveScopeKey] = useState(
    workArchiveDbManager.getCurrentScopeKey(),
  );
  const activeUserRef = useRef<AuthUser | null>(initialUser);
  const explicitGuestTransitionRef = useRef(false);
  const sessionGenerationRef = useRef(0);
  const startupRestoreGenerationRef = useRef<number | null>(null);

  const activateGuestSession = useCallback(({ clearIdentity = false } = {}) => {
    activeUserRef.current = null;
    explicitGuestTransitionRef.current = false;

    if (clearIdentity) {
      clearStoredArchiveIdentity();
    }

    workArchiveDbManager.switchToGuest();
    setUser(null);
    setSessionStatus('guest');
    setArchiveScopeKey(workArchiveDbManager.getCurrentScopeKey());
    setIsLoading(false);
  }, []);

  const activateAuthenticatedArchive = useCallback((user: AuthUser) => {
    activeUserRef.current = user;
    explicitGuestTransitionRef.current = false;
    writeStoredArchiveIdentity(user);
    workArchiveDbManager.switchToUser(user.id);
    setUser(user);
    setSessionStatus('authenticated');
    setArchiveScopeKey(workArchiveDbManager.getCurrentScopeKey());
    setIsLoading(false);
  }, []);

  const retainAccountArchive = useCallback((
    status: Extract<AuthSessionStatus, 'expired' | 'offline'>,
  ) => {
    const retainedUser = activeUserRef.current;

    if (!retainedUser) {
      activateGuestSession();
      return;
    }

    workArchiveDbManager.switchToUser(retainedUser.id);
    setUser(retainedUser);
    setSessionStatus(status);
    setArchiveScopeKey(workArchiveDbManager.getCurrentScopeKey());
    setIsLoading(false);
  }, [activateGuestSession]);

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
    if (sitesGuestPoc) {
      return undefined;
    }


    if (isGoogleAuthCompletePath()) {
      startupRestoreGenerationRef.current = null;
      setIsLoading(false);

      return () => {
        isCancelled = true;
      };
    }

    startupRestoreGenerationRef.current = restoreGeneration;
    const unsubscribe = subscribeToStoredAuthTokens((tokens) => {
      if (
        isCancelled ||
        tokens !== null ||
        explicitGuestTransitionRef.current
      ) {
        return;
      }

      if (
        startupRestoreGenerationRef.current !== null &&
        sessionGenerationRef.current !== startupRestoreGenerationRef.current
      ) {
        return;
      }

      retainAccountArchive('expired');
    });

    async function initializeSession() {
      const result = await restoreStoredSession();

      if (isCancelled) {
        return;
      }

      if (sessionGenerationRef.current !== restoreGeneration) {
        startupRestoreGenerationRef.current = null;

        return;
      }

      startupRestoreGenerationRef.current = null;

      if (result.status === 'authenticated') {
        writeStoredAuthTokens(result.tokens);
        activateAuthenticatedArchive(result.user);

        return;
      }

      clearStoredAuthTokens();
      retainAccountArchive(
        result.status === 'unavailable' ? 'offline' : 'expired',
      );
    }

    void initializeSession();

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [activateAuthenticatedArchive, retainAccountArchive, sitesGuestPoc]);

  useEffect(() => {
    if (sessionStatus !== 'offline') {
      return undefined;
    }

    const restoreGeneration = sessionGenerationRef.current;
    let disposed = false;
    let restoreInFlight = false;
    let retryAttempt = 0;
    let retryTimer: number | undefined;

    function clearRetryTimer() {
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
        retryTimer = undefined;
      }
    }

    function scheduleRetry() {
      if (
        disposed ||
        retryTimer !== undefined ||
        sessionGenerationRef.current !== restoreGeneration ||
        !window.navigator.onLine
      ) {
        return;
      }

      const delay = Math.min(
        OFFLINE_RESTORE_INITIAL_RETRY_MS * 2 ** retryAttempt,
        OFFLINE_RESTORE_MAX_RETRY_MS,
      );
      retryAttempt += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void tryRestoreSession();
      }, delay);
    }

    async function tryRestoreSession() {
      if (
        disposed ||
        restoreInFlight ||
        sessionGenerationRef.current !== restoreGeneration
      ) {
        return;
      }

      restoreInFlight = true;
      try {
        const result = await restoreStoredSession({ force: true });

        if (
          sessionGenerationRef.current !== restoreGeneration ||
          result.status !== 'authenticated'
        ) {
          return;
        }

        writeStoredAuthTokens(result.tokens);
        activateAuthenticatedArchive(result.user);
      } catch (error) {
        if (
          sessionGenerationRef.current === restoreGeneration &&
          error instanceof ApiRequestError &&
          (error.status === 401 || error.status === 403)
        ) {
          clearStoredAuthTokens();
          retainAccountArchive('expired');
          return;
        }

        scheduleRetry();
      } finally {
        restoreInFlight = false;
      }
    }

    function handleOnline() {
      retryAttempt = 0;
      clearRetryTimer();
      void tryRestoreSession();
    }

    window.addEventListener('online', handleOnline);
    scheduleRetry();

    return () => {
      disposed = true;
      clearRetryTimer();
      window.removeEventListener('online', handleOnline);
    };
  }, [activateAuthenticatedArchive, retainAccountArchive, sessionStatus]);

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
    if (user && sessionStatus === 'authenticated') {
      return getPostGoogleSignInLocation(user);
    }

    const restoredSession = await restoreStoredSession({ force: true });

    if (restoredSession.status !== 'authenticated') {
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
    explicitGuestTransitionRef.current = true;

    try {
      await logoutSession();
    } catch {
      // 세션 정리는 로컬 전환이 우선이므로 서버 logout 실패는 무시합니다.
    }

    clearStoredAuthTokens();
    activateGuestSession({ clearIdentity: true });
  }

  function updateUser(nextUser: AuthUser) {
    activeUserRef.current = nextUser;
    writeStoredArchiveIdentity(nextUser);
    setUser(nextUser);
  }

  const value: AuthContextValue = {
    archiveScopeKey,
    completeGoogleSignIn,
    continueWithGoogle,
    isLoading,
    mode: user ? 'authenticated' : 'guest',
    sessionStatus,
    user,
    signOut,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
