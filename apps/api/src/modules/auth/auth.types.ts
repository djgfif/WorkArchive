export type AuthTokenKind = 'access' | 'refresh';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  type: AuthTokenKind;
  rememberMe?: boolean;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
}
