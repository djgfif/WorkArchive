import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  ApiBody,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { readApiRuntimeConfig } from '../../config/api-runtime-config';
import {
  getRequestId,
  SecurityAuditService,
} from '../../security/security-audit.service';
import { AuthService } from './auth.service';
import {
  getRefreshTokenClearCookieOptions,
  getRefreshTokenCookieOptions,
  REFRESH_TOKEN_COOKIE_NAME,
} from './auth.cookies';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { AuthRefreshSessionsResponseDto } from './dto/auth-refresh-session-response.dto';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

const GOOGLE_OAUTH_STATE_COOKIE = 'wa_google_oauth_state';
const GOOGLE_OAUTH_NONCE_COOKIE = 'wa_google_oauth_nonce';
const GOOGLE_OAUTH_COOKIE_MAX_AGE_MS = 1000 * 60 * 10;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(SecurityAuditService)
    private readonly securityAudit: SecurityAuditService,
  ) {}

  @Post('register')
  @ApiResponse({
    status: HttpStatus.GONE,
    description: 'Email/password registration is disabled.',
  })
  register() {
    throw this.createLegacyAuthDisabledException();
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.GONE,
    description: 'Email/password login is disabled.',
  })
  login() {
    throw this.createLegacyAuthDisabledException();
  }

  @Get('google/start')
  async startGoogleLogin(@Res() response: Response) {
    if (!this.authService.isGoogleOAuthConfigured()) {
      response.redirect(this.getGoogleLoginFailureRedirectUrl('unconfigured'));
      return;
    }

    const state = this.generateOAuthSecret();
    const nonce = this.generateOAuthSecret();
    const cookieOptions = this.getOAuthCookieOptions();

    response.cookie(GOOGLE_OAUTH_STATE_COOKIE, state, cookieOptions);
    response.cookie(GOOGLE_OAUTH_NONCE_COOKIE, nonce, cookieOptions);

    response.redirect(this.authService.getGoogleAuthorizationUrl(state, nonce));
  }

  @Get('google/status')
  googleStatus() {
    return {
      configured: this.authService.isGoogleOAuthConfigured(),
    };
  }

  @Get('google/callback')
  async completeGoogleLogin(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const expectedState = request.cookies?.[GOOGLE_OAUTH_STATE_COOKIE];
    const expectedNonce = request.cookies?.[GOOGLE_OAUTH_NONCE_COOKIE];

    this.clearOAuthCookies(response);

    if (error) {
      void this.securityAudit.record({
        eventType: 'auth.login.failure',
        metadata: {
          provider: 'google',
          reason: 'oauth_error',
        },
        request,
        severity: 'warning',
      });

      response.redirect(this.getGoogleLoginFailureRedirectUrl('failed'));
      return;
    }

    if (
      typeof code !== 'string' ||
      typeof state !== 'string' ||
      typeof expectedState !== 'string' ||
      typeof expectedNonce !== 'string' ||
      state !== expectedState
    ) {
      void this.securityAudit.record({
        eventType: 'auth.login.failure',
        metadata: {
          provider: 'google',
          reason: 'invalid_oauth_state',
        },
        request,
        severity: 'warning',
      });
      throw new UnauthorizedException('Invalid Google OAuth state.');
    }

    const session = await this.authService.loginWithGoogleAuthorizationCode(
      code,
      expectedNonce,
      this.getSessionMetadata(request),
    );

    void this.securityAudit.record({
      eventType: 'auth.login.success',
      metadata: {
        provider: 'google',
      },
      request,
      severity: 'info',
      sessionId: session.sessionId,
      userId: session.user.id,
    });

    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      session.refreshToken,
      getRefreshTokenCookieOptions({
        rememberMe: session.rememberMe,
      }),
    );
    response.redirect(this.getGoogleLoginSuccessRedirectUrl());
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Rotate the session using the refresh cookie.',
    type: AuthSessionResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The refresh token is invalid or expired.',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (typeof refreshToken !== 'string' || !refreshToken) {
      this.logger.warn('Refresh rejected: missing refresh cookie.');
      void this.securityAudit.record({
        eventType: 'auth.refresh.failure',
        metadata: {
          reason: 'missing_refresh_cookie',
        },
        request,
        severity: 'warning',
      });
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const session = await this.authService.refresh(
      refreshToken,
      this.getSessionMetadata(request),
    );

    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      session.refreshToken,
      getRefreshTokenCookieOptions({
        rememberMe: session.rememberMe,
      }),
    );

    return this.authService.toSessionResponse(session);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Clear the refresh cookie and end the current session.',
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    await this.authService.logout(
      typeof refreshToken === 'string' ? refreshToken : null,
    );

    void this.securityAudit.record({
      eventType: 'auth.logout',
      request,
      severity: 'info',
    });

    response.clearCookie(
      REFRESH_TOKEN_COOKIE_NAME,
      getRefreshTokenClearCookieOptions(),
    );
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.GONE,
    description: 'Email/password password reset is disabled.',
  })
  requestPasswordReset() {
    throw this.createLegacyAuthDisabledException();
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.GONE,
    description: 'Email/password password reset is disabled.',
  })
  confirmPasswordReset() {
    throw this.createLegacyAuthDisabledException();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Return the current authenticated user.',
    type: AuthUserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user.userId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({
    type: UpdateProfileDto,
  })
  @ApiOkResponse({
    description: 'Update the current user profile.',
    type: AuthUserResponseDto,
  })
  @ApiConflictResponse({
    description: 'The requested handle is already in use.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.userId, updateProfileDto);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'List active refresh sessions for the current user.',
    type: AuthRefreshSessionsResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listRefreshSessions(user);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse({
    description: 'Revoke one active refresh session owned by the user.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.revokeRefreshSession(user, sessionId);

    void this.securityAudit.record({
      eventType: 'auth.session.revoke',
      request,
      sessionId,
      severity: 'info',
      userId: user.userId,
    });

    if (result.revokedCurrent) {
      response.clearCookie(
        REFRESH_TOKEN_COOKIE_NAME,
        getRefreshTokenClearCookieOptions(),
      );
    }
  }

  @Post('sessions/revoke-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse({
    description: 'Revoke every refresh session for the current user.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async revokeAllSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.revokeAllRefreshSessions(user);

    void this.securityAudit.record({
      eventType: 'auth.session.revoke_all',
      request,
      severity: 'warning',
      userId: user.userId,
    });

    response.clearCookie(
      REFRESH_TOKEN_COOKIE_NAME,
      getRefreshTokenClearCookieOptions(),
    );
  }

  private getSessionMetadata(request: Request) {
    const rawUserAgent = request.headers['user-agent'];

    return {
      ipAddress: request.ip ?? null,
      requestId: getRequestId(request),
      userAgent: Array.isArray(rawUserAgent)
        ? rawUserAgent.join(' ')
        : (rawUserAgent ?? null),
    };
  }

  private createLegacyAuthDisabledException() {
    return new HttpException(
      'Email/password authentication is disabled. Continue with Google or use Work Archive as a guest.',
      HttpStatus.GONE,
    );
  }

  private generateOAuthSecret() {
    return randomBytes(32).toString('base64url');
  }

  private getOAuthCookieOptions() {
    const config = readApiRuntimeConfig();

    return {
      httpOnly: true,
      maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE_MS,
      sameSite: 'lax' as const,
      secure: config.cookieSecure,
    };
  }

  private clearOAuthCookies(response: Response) {
    const config = readApiRuntimeConfig();
    const options = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: config.cookieSecure,
    };

    response.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, options);
    response.clearCookie(GOOGLE_OAUTH_NONCE_COOKIE, options);
  }

  private getGoogleLoginSuccessRedirectUrl() {
    return `${readApiRuntimeConfig().webBaseUrl.replace(/\/$/, '')}/auth/google/complete`;
  }

  private getGoogleLoginFailureRedirectUrl(reason: 'failed' | 'unconfigured') {
    return `${readApiRuntimeConfig().webBaseUrl.replace(/\/$/, '')}/auth/login?google=${reason}`;
  }
}
