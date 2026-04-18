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

  useEffect(() => {
    let isCancelled = false;

    async function initializeSession() {
      const restoredSession = await restoreStoredSession();

      if (isCancelled) {
        return;
      }

      if (restoredSession) {
        workArchiveDbManager.switchToUser(restoredSession.user.id);
        setUser(restoredSession.user);
        setArchiveScopeKey(workArchiveDbManager.getCurrentScopeKey());
        setIsLoading(false);

        return;
      }

      workArchiveDbManager.switchToGuest();
      setUser(null);
      setArchiveScopeKey(workArchiveDbManager.getCurrentScopeKey());
      setIsLoading(false);
    }

    void initializeSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function activateAuthenticatedSession(user: AuthUser, tokens: {
    accessToken: string;
    refreshToken: string;
  }) {
    writeStoredAuthTokens(tokens);
    workArchiveDbManager.switchToUser(user.id);
    setUser(user);
    setArchiveScopeKey(workArchiveDbManager.getCurrentScopeKey());
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
    workArchiveDbManager.switchToGuest();
    setUser(null);
    setArchiveScopeKey(workArchiveDbManager.getCurrentScopeKey());
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
