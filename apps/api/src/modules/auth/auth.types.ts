export type AuthTokenKind = 'access' | 'refresh';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  type: AuthTokenKind;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
}
