import { createContext } from 'react';

import type { AuthUser } from '../services/auth.api';

type AuthMode = 'guest' | 'authenticated';
export type AuthSessionStatus =
  | 'authenticated'
  | 'expired'
  | 'guest'
  | 'offline'
  | 'restoring';

export interface AuthContextValue {
  archiveScopeKey: string;
  completeGoogleSignIn?: () => Promise<string>;
  continueWithGoogle?: (returnTo?: string) => void;
  isLoading: boolean;
  mode: AuthMode;
  sessionStatus: AuthSessionStatus;
  user: AuthUser | null;
  signOut(): Promise<void>;
  updateUser?(user: AuthUser): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
