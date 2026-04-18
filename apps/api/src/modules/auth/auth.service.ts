import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import type { AuthUserResponseDto } from './dto/auth-user-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { RefreshDto } from './dto/refresh.dto';
import type { RegisterDto } from './dto/register.dto';
import type {
  AuthTokenKind,
  AuthTokenPayload,
  AuthenticatedUser,
} from './auth.types';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const HASH_SEPARATOR = ':';
const SCRYPT_KEY_LENGTH = 64;

function scrypt(secret: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(secret, salt, SCRYPT_KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error);

        return;
      }

      resolve(derivedKey as Buffer);
    });
  });
}

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(registerDto: RegisterDto): Promise<AuthSessionResponseDto> {
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
        passwordHash: await this.hashSecret(registerDto.password),
      },
    });

    return this.createSessionForUser(user);
  }

  async login(loginDto: LoginDto): Promise<AuthSessionResponseDto> {
    const email = this.normalizeEmail(loginDto.email);
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await this.verifySecret(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.createSessionForUser(user);
  }

  async refresh(refreshDto: RefreshDto): Promise<AuthSessionResponseDto> {
    const tokenPayload = this.verifyToken(refreshDto.refreshToken, 'refresh');
    const user = await this.prisma.user.findUnique({
      where: {
        id: tokenPayload.sub,
      },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const isRefreshTokenValid = await this.verifySecret(
      refreshDto.refreshToken,
      user.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    return this.createSessionForUser(user);
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

  private async createSessionForUser(user: User): Promise<AuthSessionResponseDto> {
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
        refreshTokenHash: await this.hashSecret(refreshToken),
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
    const secret =
      type === 'access'
        ? process.env.JWT_ACCESS_SECRET
        : process.env.JWT_REFRESH_SECRET;

    if (!secret?.trim()) {
      throw new Error(
        `JWT_${type.toUpperCase()}_SECRET must be configured before the API starts.`,
      );
    }

    return secret;
  }

  private async hashSecret(secret: string) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = await scrypt(secret, salt);

    return `${salt}${HASH_SEPARATOR}${derivedKey.toString('hex')}`;
  }

  private async verifySecret(secret: string, storedHash: string) {
    const [salt, expectedHash] = storedHash.split(HASH_SEPARATOR);

    if (!salt || !expectedHash) {
      return false;
    }

    const derivedKey = await scrypt(secret, salt);
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    if (expectedBuffer.length !== derivedKey.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, derivedKey);
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
}
