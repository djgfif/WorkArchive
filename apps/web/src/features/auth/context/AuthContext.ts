import { createContext } from 'react';

import type { AuthCredentialsInput, AuthUser } from '../services/auth.api';

type AuthMode = 'guest' | 'authenticated';

export interface AuthContextValue {
  archiveScopeKey: string;
  isLoading: boolean;
  mode: AuthMode;
  user: AuthUser | null;
  signIn(input: AuthCredentialsInput): Promise<void>;
  signUp(input: AuthCredentialsInput): Promise<void>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
