import type {
  Prisma,
  User,
  UserAuthAccount,
  UserRefreshSession,
} from '@prisma/client';

import type { AuthRefreshSessionResponseDto } from './dto/auth-refresh-session-response.dto';
import type { AuthUserResponseDto } from './dto/auth-user-response.dto';
import {
  maskAuthSessionIpAddress,
  summarizeAuthSessionUserAgent,
} from './auth-session-metadata';
import type { GoogleIdentityProfile } from './google-oauth-client';

export type AuthUserResponseSource = Pick<
  User,
  'id' | 'avatarUrl' | 'email' | 'handle' | 'nickname' | 'role'
> & {
  authAccounts?: Pick<
    UserAuthAccount,
    'email' | 'emailVerified' | 'name' | 'pictureUrl' | 'provider'
  >[];
};

export function toAuthUserResponse(
  user: AuthUserResponseSource,
): AuthUserResponseDto {
  return {
    authAccounts:
      user.authAccounts?.map((account) => ({
        email: account.email,
        emailVerified: account.emailVerified,
        name: account.name,
        pictureUrl: account.pictureUrl,
        provider: account.provider,
      })) ?? [],
    avatarUrl: user.avatarUrl,
    id: user.id,
    email: user.email,
    handle: user.handle,
    nickname: user.nickname,
    role: user.role,
  };
}

export function toGoogleAuthAccountData(
  profile: GoogleIdentityProfile,
): Pick<
  Prisma.UserAuthAccountUncheckedCreateInput,
  'email' | 'emailVerified' | 'name' | 'pictureUrl'
> {
  return {
    email: profile.email,
    emailVerified: profile.emailVerified,
    name: profile.name,
    pictureUrl: profile.pictureUrl,
  };
}

export function toAuthRefreshSessionResponse(
  session: UserRefreshSession,
  current: boolean,
): AuthRefreshSessionResponseDto {
  return {
    id: session.id,
    current,
    rememberMe: session.rememberMe,
    userAgent: summarizeAuthSessionUserAgent(session.userAgent),
    ipAddress: maskAuthSessionIpAddress(session.ipAddress),
    createdAt: session.createdAt.toISOString(),
    lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
    rotatedAt: session.rotatedAt?.toISOString() ?? null,
    expiresAt: session.expiresAt.toISOString(),
  };
}
