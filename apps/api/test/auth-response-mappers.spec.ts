import { UserRole } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import {
  toAuthRefreshSessionResponse,
  toAuthUserResponse,
  toGoogleAuthAccountData,
} from '../src/modules/auth/auth-response-mappers';

describe('auth response mappers', () => {
  it('maps user profile fields and linked auth accounts for API responses', () => {
    expect(
      toAuthUserResponse({
        authAccounts: [
          {
            email: 'reader@example.com',
            emailVerified: true,
            name: 'Reader',
            pictureUrl: 'https://example.com/avatar.jpg',
            provider: 'google',
          },
        ],
        avatarUrl: 'https://example.com/profile.jpg',
        email: 'reader@example.com',
        handle: 'reader',
        id: 'user-1',
        nickname: 'Reader',
        role: UserRole.user,
      }),
    ).toEqual({
      authAccounts: [
        {
          email: 'reader@example.com',
          emailVerified: true,
          name: 'Reader',
          pictureUrl: 'https://example.com/avatar.jpg',
          provider: 'google',
        },
      ],
      avatarUrl: 'https://example.com/profile.jpg',
      email: 'reader@example.com',
      handle: 'reader',
      id: 'user-1',
      nickname: 'Reader',
      role: UserRole.user,
    });
  });

  it('maps missing linked auth accounts to an empty list', () => {
    expect(
      toAuthUserResponse({
        avatarUrl: '',
        email: 'reader@example.com',
        handle: null,
        id: 'user-1',
        nickname: 'Reader',
        role: UserRole.user,
      }).authAccounts,
    ).toEqual([]);
  });

  it('builds Google auth account persistence data from identity profile', () => {
    expect(
      toGoogleAuthAccountData({
        email: 'reader@example.com',
        emailVerified: true,
        name: 'Reader',
        pictureUrl: 'https://example.com/avatar.jpg',
        providerAccountId: 'google-user-1',
      }),
    ).toEqual({
      email: 'reader@example.com',
      emailVerified: true,
      name: 'Reader',
      pictureUrl: 'https://example.com/avatar.jpg',
    });
  });

  it('maps refresh session metadata through the same privacy helpers as session creation', () => {
    expect(
      toAuthRefreshSessionResponse(
        {
          createdAt: new Date('2026-04-18T00:00:00.000Z'),
          expiresAt: new Date('2026-05-18T00:00:00.000Z'),
          id: 'session-1',
          ipAddress: '203.0.113.42',
          lastUsedAt: new Date('2026-04-19T00:00:00.000Z'),
          previousRotatedAt: null,
          previousTokenHash: null,
          rememberMe: true,
          revokedAt: null,
          rotatedAt: new Date('2026-04-20T00:00:00.000Z'),
          tokenHash: 'hash',
          updatedAt: new Date('2026-04-20T00:00:00.000Z'),
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
          userId: 'user-1',
        },
        true,
      ),
    ).toEqual({
      createdAt: '2026-04-18T00:00:00.000Z',
      current: true,
      expiresAt: '2026-05-18T00:00:00.000Z',
      id: 'session-1',
      ipAddress: '203.0.113.x',
      lastUsedAt: '2026-04-19T00:00:00.000Z',
      rememberMe: true,
      rotatedAt: '2026-04-20T00:00:00.000Z',
      userAgent: 'Safari on iOS',
    });
  });
});
