import {
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  loginWithEmailPassword,
  registerWithEmailPassword,
  restoreStoredSession,
  type AuthCredentialsInput,
  type AuthUser,
} from '../services/auth.api';
import {
  clearStoredAuthTokens,
  readStoredAuthTokens,
  subscribeToStoredAuthTokens,
  writeStoredAuthTokens,
} from '../services/auth-storage';
import { workArchiveDbManager } from '../../works/db/work-archive.db';
import { AuthContext, type AuthContextValue } from './AuthContext';

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(() => readStoredAuthTokens() !== null);
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

  async function activateAuthenticatedSession(user: AuthUser, tokens: {
    accessToken: string;
    refreshToken: string;
  }) {
    writeStoredAuthTokens(tokens);
    activateAuthenticatedArchive(user);
  }

  async function signIn(input: AuthCredentialsInput) {
    const session = await loginWithEmailPassword(input);

    await activateAuthenticatedSession(session.user, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
  }

  async function signUp(input: AuthCredentialsInput) {
    const session = await registerWithEmailPassword(input);

    await activateAuthenticatedSession(session.user, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
  }

  async function signOut() {
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
