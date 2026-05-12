export type AuthTokenKind = 'access' | 'refresh';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  sid: string;
  type: AuthTokenKind;
  rememberMe?: boolean;
}

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
}
