import type { AuthRefreshSessionResponse } from '@work-archive/shared-types';
import { useEffect, useState } from 'react';

import {
  fetchAuthSessions,
  revokeAllAuthSessions,
  revokeAuthSession,
} from '@features/auth';
import type { SettingsFeedback } from './useImportProviderSettings';

type SettingsAuthMode = 'authenticated' | 'guest';

export function useAuthSessionSettings(
  mode: SettingsAuthMode,
  signOut: () => Promise<void>,
) {
  const [sessions, setSessions] = useState<AuthRefreshSessionResponse[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [sessionFeedback, setSessionFeedback] =
    useState<SettingsFeedback | null>(null);

  async function loadSessions() {
    if (mode !== 'authenticated') {
      setSessions([]);
      setSessionFeedback(null);

      return;
    }

    try {
      setIsLoadingSessions(true);
      const response = await fetchAuthSessions();

      setSessions(Array.isArray(response.sessions) ? response.sessions : []);
      setSessionFeedback(null);
    } catch (error) {
      setSessionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Could not load login sessions.',
      });
    } finally {
      setIsLoadingSessions(false);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadInitialSessions() {
      if (mode !== 'authenticated') {
        setSessions([]);
        setSessionFeedback(null);

        return;
      }

      try {
        setIsLoadingSessions(true);
        const response = await fetchAuthSessions();

        if (!isCancelled) {
          setSessions(Array.isArray(response.sessions) ? response.sessions : []);
          setSessionFeedback(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setSessionFeedback({
            tone: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Could not load login sessions.',
          });
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSessions(false);
        }
      }
    }

    void loadInitialSessions();

    return () => {
      isCancelled = true;
    };
  }, [mode]);

  async function revokeSession(session: AuthRefreshSessionResponse) {
    try {
      setRevokingSessionId(session.id);
      await revokeAuthSession(session.id);

      if (session.current) {
        await signOut();

        return;
      }

      setSessions((current) =>
        current.filter((candidate) => candidate.id !== session.id),
      );
      setSessionFeedback({
        tone: 'success',
        message: 'Login session revoked.',
      });
    } catch (error) {
      setSessionFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Could not revoke session.',
      });
    } finally {
      setRevokingSessionId(null);
    }
  }

  async function revokeEverySession() {
    try {
      setRevokingSessionId('all');
      await revokeAllAuthSessions();
      await signOut();
    } catch (error) {
      setSessionFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Could not revoke sessions.',
      });
    } finally {
      setRevokingSessionId(null);
    }
  }

  return {
    isLoadingSessions,
    refreshSessions: loadSessions,
    revokeEverySession,
    revokeSession,
    revokingSessionId,
    sessionFeedback,
    sessions,
  };
}
