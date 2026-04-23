import { randomBytes } from 'node:crypto';

import {
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
import type { RegisterDto } from './dto/register.dto';
import type {
  AuthTokenKind,
  AuthTokenPayload,
  AuthenticatedUser,
} from './auth.types';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface IssuedAuthSession {
  accessToken: string;
  refreshToken: string;
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

    return this.createSessionForUser(user);
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

    return this.createSessionForUser(user);
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
    };
  }

  toSessionResponse(session: IssuedAuthSession): AuthSessionResponseDto {
    return {
      accessToken: session.accessToken,
      user: session.user,
    };
  }

  private async createSessionForUser(user: User): Promise<IssuedAuthSession> {
    const accessToken = this.signToken(user, 'access', ACCESS_TOKEN_TTL_SECONDS);
    const refreshToken = this.signToken(
      user,
      'refresh',
      REFRESH_TOKEN_TTL_SECONDS,
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
      user: this.toUserResponse(updatedUser),
    };
  }

  private signToken(
    user: Pick<User, 'id' | 'email'>,
    type: AuthTokenKind,
    expiresIn: number,
  ) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        type,
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
        (decoded as JwtPayload).type !== type
      ) {
        throw new UnauthorizedException('Invalid or expired token.');
      }

      return {
        sub: (decoded as JwtPayload).sub as string,
        email: (decoded as JwtPayload).email as string,
        type,
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
    user: Pick<User, 'id' | 'email' | 'nickname'>,
  ): AuthUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
    };
  }

  private logRefreshFailure(reason: string, userId?: string) {
    this.logger.warn(
      `Refresh failed reason=${reason}${userId ? ` userId=${userId}` : ''}`,
    );
  }
}
