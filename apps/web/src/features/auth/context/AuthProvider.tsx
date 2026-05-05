import {
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  loginWithEmailPassword,
  logoutSession,
  registerWithEmailPassword,
  restoreStoredSession,
  type AuthCredentialsInput,
  type AuthUser,
} from '../services/auth.api';
import { guestTransferService } from '../services/guest-transfer.service';
import {
  clearStoredAuthTokens,
  subscribeToStoredAuthTokens,
  writeStoredAuthTokens,
} from '../services/auth-storage';
import { workArchiveDbManager } from '../../works/db/work-archive.db';
import { AuthContext, type AuthContextValue } from './AuthContext';

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [archiveScopeKey, setArchiveScopeKey] = useState(
    workArchiveDbManager.getCurrentScopeKey(),
  );

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

  useEffect(() => {
    let isCancelled = false;
    const unsubscribe = subscribeToStoredAuthTokens((tokens) => {
      if (isCancelled || tokens !== null) {
        return;
      }

      activateGuestSession();
    });

    async function initializeSession() {
      const restoredSession = await restoreStoredSession();

      if (isCancelled) {
        return;
      }

      if (restoredSession) {
        activateAuthenticatedArchive(restoredSession.user);

        return;
      }

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
    writeStoredAuthTokens(tokens);
    activateAuthenticatedArchive(user);

    const pendingGuestTransfer = await guestTransferService.getPendingReview(user.id);

    return pendingGuestTransfer ? '/account/transfer' : '/';
  }

  async function signIn(input: AuthCredentialsInput) {
    const session = await loginWithEmailPassword(input);

    return activateAuthenticatedSession(session.user, {
      accessToken: session.accessToken,
    });
  }

  async function signUp(input: AuthCredentialsInput) {
    const session = await registerWithEmailPassword(input);

    return activateAuthenticatedSession(session.user, {
      accessToken: session.accessToken,
    });
  }

  async function signOut() {
    try {
      await logoutSession();
    } catch {
      // 세션 정리는 로컬 전환이 우선이므로 서버 logout 실패는 무시합니다.
    }

    clearStoredAuthTokens();
    activateGuestSession();
  }

  const value: AuthContextValue = {
    archiveScopeKey,
    isLoading,
    mode: user ? 'authenticated' : 'guest',
    user,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
