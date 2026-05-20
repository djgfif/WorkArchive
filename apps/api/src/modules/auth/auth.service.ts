import { randomBytes, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import type { User, UserRefreshSession } from '@prisma/client';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import { readApiRuntimeConfig } from '../../config/api-runtime-config';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityAuditService } from '../../security/security-audit.service';
import { hashSecret, verifySecret } from './auth-crypto';
import type { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import type {
  AuthRefreshSessionResponseDto,
  AuthRefreshSessionsResponseDto,
} from './dto/auth-refresh-session-response.dto';
import type { AuthUserResponseDto } from './dto/auth-user-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import type { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import type {
  PasswordResetConfirmResponseDto,
  PasswordResetRequestResponseDto,
} from './dto/password-reset-response.dto';
import type { RegisterDto } from './dto/register.dto';
import type {
  AuthTokenKind,
  AuthTokenPayload,
  AuthenticatedUser,
} from './auth.types';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_RESET_TOKEN_TTL_MS = 1000 * 60 * 30;
const PASSWORD_RESET_SUCCESS_MESSAGE =
  '비밀번호 재설정 요청을 확인했습니다. 계정이 있으면 재설정 링크를 사용할 수 있습니다.';
const PASSWORD_RESET_CONFIRM_MESSAGE = '비밀번호가 재설정되었습니다.';
const PASSWORD_RESET_INVALID_MESSAGE =
  '비밀번호 재설정 링크가 올바르지 않거나 만료되었습니다.';

export interface IssuedAuthSession {
  accessToken: string;
  refreshToken: string;
  rememberMe: boolean;
  sessionId: string;
  user: AuthUserResponseDto;
}

export interface AuthSessionMetadata {
  ipAddress?: string | null;
  requestId?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SecurityAuditService)
    @Optional()
    private readonly securityAudit?: SecurityAuditService,
  ) {}

  async register(
    registerDto: RegisterDto,
    metadata: AuthSessionMetadata = {},
  ): Promise<IssuedAuthSession> {
    const email = this.normalizeEmail(registerDto.email);
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await hashSecret(registerDto.password),
      },
    });

    return this.createSessionForUser(user, true, metadata);
  }

  async login(
    loginDto: LoginDto,
    metadata: AuthSessionMetadata = {},
  ): Promise<IssuedAuthSession> {
    const email = this.normalizeEmail(loginDto.email);
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await verifySecret(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.createSessionForUser(
      user,
      loginDto.rememberMe === true,
      metadata,
    );
  }

  async refresh(
    refreshToken: string,
    metadata: AuthSessionMetadata = {},
  ): Promise<IssuedAuthSession> {
    let tokenPayload: AuthTokenPayload;

    try {
      tokenPayload = this.verifyToken(refreshToken, 'refresh');
    } catch (error) {
      this.recordRefreshFailure(
        'invalid_or_expired_token',
        undefined,
        metadata,
      );
      throw error;
    }

    const session = await this.prisma.userRefreshSession.findUnique({
      where: {
        id: tokenPayload.sid,
      },
      include: {
        user: true,
      },
    });

    if (!session || session.userId !== tokenPayload.sub) {
      this.recordRefreshFailure(
        'missing_refresh_session',
        tokenPayload.sub,
        metadata,
      );
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (session.revokedAt) {
      await this.revokeAllUserSessions(session.userId);
      this.recordRefreshFailure(
        'inactive_refresh_session_reuse',
        session.userId,
        metadata,
        'auth.refresh.reuse_detected',
      );
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.revokeAllUserSessions(session.userId);
      this.recordRefreshFailure(
        'expired_refresh_session',
        session.userId,
        metadata,
      );
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const isRefreshTokenValid = await verifySecret(
      refreshToken,
      session.tokenHash,
    );

    if (!isRefreshTokenValid) {
      await this.revokeAllUserSessions(session.userId);
      this.recordRefreshFailure(
        'refresh_token_reuse_detected',
        session.userId,
        metadata,
        'auth.refresh.reuse_detected',
      );
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    return this.rotateSessionForUser(
      session.user,
      session,
      tokenPayload.rememberMe ?? session.rememberMe,
    );
  }

  async logout(refreshToken: string | null) {
    if (!refreshToken) {
      return;
    }

    try {
      const tokenPayload = this.verifyToken(refreshToken, 'refresh');
      const session = await this.prisma.userRefreshSession.findUnique({
        where: {
          id: tokenPayload.sid,
        },
      });

      if (
        !session ||
        session.userId !== tokenPayload.sub ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now()
      ) {
        return;
      }

      const isRefreshTokenValid = await verifySecret(
        refreshToken,
        session.tokenHash,
      );

      if (!isRefreshTokenValid) {
        return;
      }

      await this.prisma.userRefreshSession.update({
        where: {
          id: session.id,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    } catch {
      return;
    }
  }

  async getCurrentUser(userId: string): Promise<AuthUserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Session is no longer valid.');
    }

    return this.toUserResponse(user);
  }

  async listRefreshSessions(
    user: AuthenticatedUser,
  ): Promise<AuthRefreshSessionsResponseDto> {
    const sessions = await this.prisma.userRefreshSession.findMany({
      where: {
        userId: user.userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      sessions: sessions.map((session) =>
        this.toRefreshSessionResponse(session, session.id === user.sessionId),
      ),
    };
  }

  async revokeRefreshSession(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<{ revokedCurrent: boolean }> {
    await this.prisma.userRefreshSession.updateMany({
      where: {
        id: sessionId,
        userId: user.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return {
      revokedCurrent: sessionId === user.sessionId,
    };
  }

  async revokeAllRefreshSessions(user: AuthenticatedUser) {
    await this.revokeAllUserSessions(user.userId);
  }

  async requestPasswordReset(
    passwordResetRequestDto: PasswordResetRequestDto,
  ): Promise<PasswordResetRequestResponseDto> {
    const email = this.normalizeEmail(passwordResetRequestDto.email);
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return {
        message: PASSWORD_RESET_SUCCESS_MESSAGE,
      };
    }

    const tokenId = randomUUID();
    const tokenSecret = randomBytes(32).toString('hex');
    const resetToken = `${tokenId}.${tokenSecret}`;

    await this.prisma.passwordResetToken.create({
      data: {
        id: tokenId,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        tokenHash: await hashSecret(tokenSecret),
        userId: user.id,
      },
    });

    const config = readApiRuntimeConfig();

    if (!config.passwordResetDevLinksEnabled) {
      return {
        message: PASSWORD_RESET_SUCCESS_MESSAGE,
      };
    }

    return {
      developmentResetUrl: `${config.webBaseUrl.replace(/\/$/, '')}/auth/password-reset/confirm?token=${encodeURIComponent(resetToken)}`,
      message: PASSWORD_RESET_SUCCESS_MESSAGE,
    };
  }

  async confirmPasswordReset(
    passwordResetConfirmDto: PasswordResetConfirmDto,
  ): Promise<PasswordResetConfirmResponseDto> {
    const [tokenId, tokenSecret] = passwordResetConfirmDto.token.split('.');

    if (!tokenId || !tokenSecret) {
      throw new BadRequestException(PASSWORD_RESET_INVALID_MESSAGE);
    }

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: {
        id: tokenId,
      },
    });

    if (
      !resetToken ||
      resetToken.usedAt !== null ||
      resetToken.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException(PASSWORD_RESET_INVALID_MESSAGE);
    }

    const isTokenValid = await verifySecret(tokenSecret, resetToken.tokenHash);

    if (!isTokenValid) {
      throw new BadRequestException(PASSWORD_RESET_INVALID_MESSAGE);
    }

    const now = new Date();
    const updatedResetToken = await this.prisma.passwordResetToken.updateMany({
      where: {
        id: resetToken.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    if (updatedResetToken.count !== 1) {
      throw new BadRequestException(PASSWORD_RESET_INVALID_MESSAGE);
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: resetToken.userId,
        },
        data: {
          passwordHash: await hashSecret(passwordResetConfirmDto.password),
        },
      }),
      this.prisma.userRefreshSession.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      }),
    ]);

    return {
      message: PASSWORD_RESET_CONFIRM_MESSAGE,
    };
  }

  async validateAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const tokenPayload = this.verifyToken(accessToken, 'access');
    const user = await this.prisma.user.findUnique({
      where: {
        id: tokenPayload.sub,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Session is no longer valid.');
    }

    const session = await this.prisma.userRefreshSession.findUnique({
      where: {
        id: tokenPayload.sid,
      },
    });

    if (
      !session ||
      session.userId !== user.id ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Session is no longer valid.');
    }

    return {
      userId: user.id,
      sessionId: session.id,
      email: user.email,
      role: user.role,
    };
  }

  toSessionResponse(session: IssuedAuthSession): AuthSessionResponseDto {
    return {
      accessToken: session.accessToken,
      user: session.user,
    };
  }

  private async createSessionForUser(
    user: User,
    rememberMe = true,
    metadata: AuthSessionMetadata = {},
  ): Promise<IssuedAuthSession> {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    const accessToken = this.signToken(
      user,
      sessionId,
      'access',
      ACCESS_TOKEN_TTL_SECONDS,
    );
    const refreshToken = this.signToken(
      user,
      sessionId,
      'refresh',
      REFRESH_TOKEN_TTL_SECONDS,
      rememberMe,
    );
    await this.prisma.userRefreshSession.create({
      data: {
        id: sessionId,
        expiresAt,
        ipAddress: metadata.ipAddress ?? null,
        lastUsedAt: new Date(),
        rememberMe,
        tokenHash: await hashSecret(refreshToken),
        userAgent: metadata.userAgent ?? null,
        userId: user.id,
      },
    });

    return {
      accessToken,
      refreshToken,
      rememberMe,
      sessionId,
      user: this.toUserResponse(user),
    };
  }

  private async rotateSessionForUser(
    user: User,
    session: UserRefreshSession,
    rememberMe = true,
  ): Promise<IssuedAuthSession> {
    const accessToken = this.signToken(
      user,
      session.id,
      'access',
      ACCESS_TOKEN_TTL_SECONDS,
    );
    const refreshToken = this.signToken(
      user,
      session.id,
      'refresh',
      REFRESH_TOKEN_TTL_SECONDS,
      rememberMe,
    );
    const now = new Date();

    await this.prisma.userRefreshSession.update({
      where: {
        id: session.id,
      },
      data: {
        lastUsedAt: now,
        rememberMe,
        rotatedAt: now,
        tokenHash: await hashSecret(refreshToken),
      },
    });

    return {
      accessToken,
      refreshToken,
      rememberMe,
      sessionId: session.id,
      user: this.toUserResponse(user),
    };
  }

  private signToken(
    user: Pick<User, 'id' | 'email'>,
    sessionId: string,
    type: AuthTokenKind,
    expiresIn: number,
    rememberMe?: boolean,
  ) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        sid: sessionId,
        type,
        ...(type === 'refresh' && rememberMe !== undefined
          ? { rememberMe }
          : {}),
      },
      this.getJwtSecret(type),
      {
        expiresIn,
        jwtid: randomBytes(16).toString('hex'),
      },
    );
  }

  private verifyToken(token: string, type: AuthTokenKind): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret(type));

      if (
        typeof decoded === 'string' ||
        typeof (decoded as JwtPayload).sub !== 'string' ||
        typeof (decoded as JwtPayload).email !== 'string' ||
        typeof (decoded as JwtPayload).sid !== 'string' ||
        (decoded as JwtPayload).type !== type ||
        ('rememberMe' in (decoded as JwtPayload) &&
          typeof (decoded as JwtPayload).rememberMe !== 'boolean')
      ) {
        throw new UnauthorizedException('Invalid or expired token.');
      }

      return {
        sub: (decoded as JwtPayload).sub as string,
        email: (decoded as JwtPayload).email as string,
        sid: (decoded as JwtPayload).sid as string,
        type,
        ...((decoded as JwtPayload).rememberMe !== undefined
          ? { rememberMe: (decoded as JwtPayload).rememberMe as boolean }
          : {}),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  private getJwtSecret(type: AuthTokenKind) {
    const config = readApiRuntimeConfig();

    return type === 'access' ? config.jwtAccessSecret : config.jwtRefreshSecret;
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private toUserResponse(
    user: Pick<User, 'id' | 'email' | 'nickname' | 'role'>,
  ): AuthUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
    };
  }

  private toRefreshSessionResponse(
    session: UserRefreshSession,
    current: boolean,
  ): AuthRefreshSessionResponseDto {
    return {
      id: session.id,
      current,
      rememberMe: session.rememberMe,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
      rotatedAt: session.rotatedAt?.toISOString() ?? null,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  private async revokeAllUserSessions(userId: string) {
    await this.prisma.userRefreshSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private recordRefreshFailure(
    reason: string,
    userId: string | undefined,
    metadata: AuthSessionMetadata,
    eventType:
      | 'auth.refresh.failure'
      | 'auth.refresh.reuse_detected' = 'auth.refresh.failure',
  ) {
    this.logger.warn(
      `Refresh failed reason=${reason}${userId ? ` userId=${userId}` : ''}`,
    );

    void this.securityAudit?.record({
      eventType,
      ipAddress: metadata.ipAddress ?? null,
      metadata: {
        reason,
      },
      requestId: metadata.requestId ?? null,
      severity:
        eventType === 'auth.refresh.reuse_detected' ? 'critical' : 'warning',
      userAgent: metadata.userAgent ?? null,
      userId: userId ?? null,
    });
  }
}
