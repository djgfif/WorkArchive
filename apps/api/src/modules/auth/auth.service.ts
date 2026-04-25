import { randomBytes, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import { readApiRuntimeConfig } from '../../config/api-runtime-config';
import { PrismaService } from '../../prisma/prisma.service';
import { hashSecret, verifySecret } from './auth-crypto';
import type { AuthSessionResponseDto } from './dto/auth-session-response.dto';
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
  user: AuthUserResponseDto;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(registerDto: RegisterDto): Promise<IssuedAuthSession> {
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

    return this.createSessionForUser(user);
  }

  async login(loginDto: LoginDto): Promise<IssuedAuthSession> {
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

    return this.createSessionForUser(user, loginDto.rememberMe === true);
  }

  async refresh(refreshToken: string): Promise<IssuedAuthSession> {
    let tokenPayload: AuthTokenPayload;

    try {
      tokenPayload = this.verifyToken(refreshToken, 'refresh');
    } catch (error) {
      this.logRefreshFailure('invalid_or_expired_token');
      throw error;
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: tokenPayload.sub,
      },
    });

    if (!user || !user.refreshTokenHash) {
      this.logRefreshFailure('missing_refresh_session', tokenPayload.sub);
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const isRefreshTokenValid = await verifySecret(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      this.logRefreshFailure('refresh_token_mismatch', user.id);
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    return this.createSessionForUser(user, tokenPayload.rememberMe ?? true);
  }

  async logout(refreshToken: string | null) {
    if (!refreshToken) {
      return;
    }

    try {
      const tokenPayload = this.verifyToken(refreshToken, 'refresh');
      const user = await this.prisma.user.findUnique({
        where: {
          id: tokenPayload.sub,
        },
      });

      if (!user?.refreshTokenHash) {
        return;
      }

      const isRefreshTokenValid = await verifySecret(
        refreshToken,
        user.refreshTokenHash,
      );

      if (!isRefreshTokenValid) {
        return;
      }

      await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          refreshTokenHash: null,
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
          refreshTokenHash: null,
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

    return {
      userId: user.id,
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
  ): Promise<IssuedAuthSession> {
    const accessToken = this.signToken(user, 'access', ACCESS_TOKEN_TTL_SECONDS);
    const refreshToken = this.signToken(
      user,
      'refresh',
      REFRESH_TOKEN_TTL_SECONDS,
      rememberMe,
    );
    const updatedUser = await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        refreshTokenHash: await hashSecret(refreshToken),
      },
    });

    return {
      accessToken,
      refreshToken,
      rememberMe,
      user: this.toUserResponse(updatedUser),
    };
  }

  private signToken(
    user: Pick<User, 'id' | 'email'>,
    type: AuthTokenKind,
    expiresIn: number,
    rememberMe?: boolean,
  ) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        type,
        ...(type === 'refresh' && rememberMe !== undefined ? { rememberMe } : {}),
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
        (decoded as JwtPayload).type !== type ||
        ('rememberMe' in (decoded as JwtPayload) &&
          typeof (decoded as JwtPayload).rememberMe !== 'boolean')
      ) {
        throw new UnauthorizedException('Invalid or expired token.');
      }

      return {
        sub: (decoded as JwtPayload).sub as string,
        email: (decoded as JwtPayload).email as string,
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

    return (
      type === 'access'
        ? config.jwtAccessSecret
        : config.jwtRefreshSecret
    );
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

  private logRefreshFailure(reason: string, userId?: string) {
    this.logger.warn(
      `Refresh failed reason=${reason}${userId ? ` userId=${userId}` : ''}`,
    );
  }
}
