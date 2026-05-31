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
import {
  isOAuthVerificationValueMatch,
  signOAuthVerificationValue,
} from './oauth-verification';

const GOOGLE_OAUTH_STATE_COOKIE = 'wa_google_oauth_state';
const GOOGLE_OAUTH_NONCE_COOKIE = 'wa_google_oauth_nonce';
const GOOGLE_OAUTH_RETURN_ORIGIN_COOKIE = 'wa_google_oauth_return_origin';
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
  async startGoogleLogin(
    @Query('return_origin') returnOrigin: string | undefined,
    @Res() response: Response,
  ) {
    if (!this.authService.isGoogleOAuthConfigured()) {
      response.redirect(
        this.getGoogleLoginFailureRedirectUrl('unconfigured', returnOrigin),
      );
      return;
    }

    const validatedReturnOrigin =
      this.getAllowedOAuthReturnOrigin(returnOrigin);
    const state = this.generateOAuthState(validatedReturnOrigin);
    const nonce = this.generateOAuthSecret();
    response.cookie(
      GOOGLE_OAUTH_STATE_COOKIE,
      signOAuthVerificationValue(state),
      {
        httpOnly: true,
        maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE_MS,
        sameSite: 'lax',
        secure: true,
      },
    );
    response.cookie(
      GOOGLE_OAUTH_NONCE_COOKIE,
      signOAuthVerificationValue(nonce),
      {
        httpOnly: true,
        maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE_MS,
        sameSite: 'lax',
        secure: true,
      },
    );

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
    const expectedStateHash = request.cookies?.[GOOGLE_OAUTH_STATE_COOKIE];
    const expectedNonceHash = request.cookies?.[GOOGLE_OAUTH_NONCE_COOKIE];
    const returnOrigin = this.readReturnOriginFromOAuthState(state);

    this.clearOAuthCookies(response);

    if (error) {
      this.logAuthGoogleFailed(request, 'oauth_error');
      void this.securityAudit.record({
        eventType: 'auth.login.failure',
        metadata: {
          provider: 'google',
          reason: 'oauth_error',
        },
        request,
        severity: 'warning',
      });

      response.redirect(
        this.getGoogleLoginFailureRedirectUrl('failed', returnOrigin),
      );
      return;
    }

    if (
      typeof code !== 'string' ||
      typeof state !== 'string' ||
      typeof expectedStateHash !== 'string' ||
      typeof expectedNonceHash !== 'string' ||
      !isOAuthVerificationValueMatch(state, expectedStateHash)
    ) {
      this.logAuthGoogleFailed(request, 'invalid_oauth_state');
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

    let session: Awaited<
      ReturnType<typeof this.authService.loginWithGoogleAuthorizationCode>
    >;

    try {
      session = await this.authService.loginWithGoogleAuthorizationCode(
        code,
        expectedNonceHash,
        this.getSessionMetadata(request),
      );
    } catch (loginError) {
      this.logAuthGoogleFailed(request, this.describeAuthFailure(loginError));
      throw loginError;
    }

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
    response.redirect(this.getGoogleLoginSuccessRedirectUrl(returnOrigin));
  }

  private logAuthGoogleFailed(request: Request, errorCode: string) {
    this.logger.warn(
      JSON.stringify({
        count: null,
        durationMs: 0,
        entityType: null,
        errorCode,
        event: 'auth.google.failed',
        provider: 'google',
        requestId: getRequestId(request),
        userId: null,
      }),
    );
  }

  private describeAuthFailure(error: unknown) {
    return error instanceof Error ? error.name : 'UnknownError';
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Rotate the session using the refresh cookie.',
    type: AuthSessionResponseDto,
  })
  @ApiNoContentResponse({
    description: 'No refresh cookie is present; continue as a guest session.',
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
      response.status(HttpStatus.NO_CONTENT);
      return;
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

  private generateOAuthState(returnOrigin: string) {
    const encodedReturnOrigin = Buffer.from(returnOrigin, 'utf8').toString(
      'base64url',
    );

    return `${this.generateOAuthSecret()}.${encodedReturnOrigin}`;
  }

  private readReturnOriginFromOAuthState(state: unknown) {
    if (typeof state !== 'string') {
      return undefined;
    }

    const encodedReturnOrigin = state.split('.', 2)[1];

    if (!encodedReturnOrigin) {
      return undefined;
    }

    try {
      return Buffer.from(encodedReturnOrigin, 'base64url').toString('utf8');
    } catch {
      return undefined;
    }
  }

  private clearOAuthCookies(response: Response) {
    const options = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: true,
    };

    response.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, options);
    response.clearCookie(GOOGLE_OAUTH_NONCE_COOKIE, options);
    response.clearCookie(GOOGLE_OAUTH_RETURN_ORIGIN_COOKIE, options);
  }

  private getGoogleLoginSuccessRedirectUrl(returnOrigin?: unknown) {
    const origin = this.getAllowedOAuthReturnOrigin(returnOrigin).replace(
      /\/$/,
      '',
    );

    return `${origin}/auth/google/complete`;
  }

  private getGoogleLoginFailureRedirectUrl(
    reason: 'failed' | 'unconfigured',
    returnOrigin?: unknown,
  ) {
    const origin = this.getAllowedOAuthReturnOrigin(returnOrigin).replace(
      /\/$/,
      '',
    );

    return `${origin}/auth/login?google=${reason}`;
  }

  private getAllowedOAuthReturnOrigin(returnOrigin?: unknown) {
    const config = readApiRuntimeConfig();
    const fallbackOrigin = new URL(config.webBaseUrl).origin;

    if (typeof returnOrigin !== 'string' || returnOrigin.trim() === '') {
      return fallbackOrigin;
    }

    let requestedOrigin: string;

    try {
      const parsedOrigin = new URL(returnOrigin.trim());

      if (!['http:', 'https:'].includes(parsedOrigin.protocol)) {
        return fallbackOrigin;
      }

      requestedOrigin = parsedOrigin.origin;
    } catch {
      return fallbackOrigin;
    }

    const allowedOrigins = new Set([
      fallbackOrigin,
      ...config.corsOrigin.map((origin) => {
        try {
          return new URL(origin).origin;
        } catch {
          return '';
        }
      }),
    ]);

    return allowedOrigins.has(requestedOrigin)
      ? requestedOrigin
      : fallbackOrigin;
  }
}
