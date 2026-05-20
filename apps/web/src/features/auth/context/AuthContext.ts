import { createContext } from 'react';

import type { AuthCredentialsInput, AuthUser } from '../services/auth.api';

type AuthMode = 'guest' | 'authenticated';

export interface AuthContextValue {
  archiveScopeKey: string;
  completeGoogleSignIn?: () => Promise<string>;
  continueWithGoogle?: () => void;
  isLoading: boolean;
  mode: AuthMode;
  user: AuthUser | null;
  signIn(input: AuthCredentialsInput): Promise<string>;
  signUp(input: AuthCredentialsInput): Promise<string>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
