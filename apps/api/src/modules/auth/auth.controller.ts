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
  Optional,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ApiBody,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { MetricsService } from '../../observability/metrics.service';
import {
  getRequestId,
  SecurityAuditService,
} from '../../security/security-audit.service';
import {
  consumeGoogleOAuthFlow,
  generateOAuthSecret,
  getAllowedOAuthReturnOrigin,
  getAuthSessionMetadata,
  getGoogleLoginFailureRedirectUrl,
  getGoogleLoginSuccessRedirectUrl,
  getGoogleOAuthCookieOptions,
  getGoogleOAuthFlowCookieOptions,
  GOOGLE_OAUTH_COOKIE_MAX_AGE_MS,
  GOOGLE_OAUTH_FLOW_COOKIE,
  type GoogleOAuthFlowConsumeResult,
} from './auth-google-oauth';
import { AuthService } from './auth.service';
import {
  getRefreshTokenClearCookieOptions,
  getRefreshTokenCookieOptions,
  REFRESH_TOKEN_COOKIE_NAME,
} from './auth.cookies';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { AuthAccountDeletionRequestDto } from './dto/auth-account-deletion-request.dto';
import { AuthAccountDeletionPreviewResponseDto } from './dto/auth-account-deletion-preview-response.dto';
import { AuthAccountDeletionResponseDto } from './dto/auth-account-deletion-response.dto';
import { AuthRefreshSessionsResponseDto } from './dto/auth-refresh-session-response.dto';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import { AuthUserDataExportResponseDto } from './dto/auth-user-data-export-response.dto';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { hashSecret } from './auth-crypto';
import { GoogleOAuthFlowStoreService } from './google-oauth-flow-store.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(GoogleOAuthFlowStoreService)
    private readonly googleOAuthFlowStore: GoogleOAuthFlowStoreService,
    @Inject(SecurityAuditService)
    private readonly securityAudit: SecurityAuditService,
    @Inject(MetricsService)
    @Optional()
    private readonly metricsService?: MetricsService,
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
        getGoogleLoginFailureRedirectUrl('unconfigured', returnOrigin),
      );
      return;
    }

    const validatedReturnOrigin = getAllowedOAuthReturnOrigin(returnOrigin);
    const flowId = randomUUID();
    const state = generateOAuthSecret();
    const nonce = generateOAuthSecret();
    const [stateHash, nonceHash] = await Promise.all([
      hashSecret(state),
      hashSecret(nonce),
    ]);

    await this.googleOAuthFlowStore.store(
      flowId,
      {
        expiresAt: Date.now() + GOOGLE_OAUTH_COOKIE_MAX_AGE_MS,
        nonceHash,
        returnOrigin: validatedReturnOrigin,
        stateHash,
      },
      GOOGLE_OAUTH_COOKIE_MAX_AGE_MS,
    );

    response.cookie(
      GOOGLE_OAUTH_FLOW_COOKIE,
      flowId,
      getGoogleOAuthFlowCookieOptions(),
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
    const flowId = request.cookies?.[GOOGLE_OAUTH_FLOW_COOKIE];
    let flowResult: GoogleOAuthFlowConsumeResult;

    try {
      flowResult = await consumeGoogleOAuthFlow(flowId, state, (flowId) =>
        this.googleOAuthFlowStore.consume(flowId),
      );
    } catch (flowError) {
      this.clearOAuthCookies(response);
      this.logAuthGoogleFailed(request, this.describeAuthFailure(flowError));
      void this.securityAudit.record({
        eventType: 'auth.login.failure',
        metadata: {
          provider: 'google',
          reason: 'oauth_flow_store_unavailable',
        },
        request,
        severity: 'critical',
      });

      response.redirect(getGoogleLoginFailureRedirectUrl('failed'));
      return;
    }

    const flow = flowResult.flow;
    const returnOrigin = flow?.returnOrigin;

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
        getGoogleLoginFailureRedirectUrl('failed', returnOrigin),
      );
      return;
    }

    if (typeof code !== 'string' || !flow) {
      const reason =
        typeof code !== 'string'
          ? 'missing_oauth_code'
          : (flowResult.failureReason ?? 'invalid_oauth_state');

      this.logAuthGoogleFailed(request, reason);
      void this.securityAudit.record({
        eventType: 'auth.login.failure',
        metadata: {
          provider: 'google',
          reason,
        },
        request,
        severity: 'warning',
      });
      response.redirect(
        getGoogleLoginFailureRedirectUrl('failed', returnOrigin),
      );
      return;
    }

    let session: Awaited<
      ReturnType<typeof this.authService.loginWithGoogleAuthorizationCode>
    >;

    try {
      session = await this.authService.loginWithGoogleAuthorizationCode(
        code,
        flow.nonceHash,
        getAuthSessionMetadata(request),
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

    if (session.refreshToken) {
      response.cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        session.refreshToken,
        getRefreshTokenCookieOptions({
          rememberMe: session.rememberMe,
        }),
      );
    }
    response.redirect(getGoogleLoginSuccessRedirectUrl(returnOrigin));
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

    let session: Awaited<ReturnType<typeof this.authService.refresh>>;

    try {
      session = await this.authService.refresh(
        refreshToken,
        getAuthSessionMetadata(request),
      );
    } catch (error) {
      response.clearCookie(
        REFRESH_TOKEN_COOKIE_NAME,
        getRefreshTokenClearCookieOptions(),
      );
      throw error;
    }

    if (session.refreshToken) {
      response.cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        session.refreshToken,
        getRefreshTokenCookieOptions({
          rememberMe: session.rememberMe,
        }),
      );
    }

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

  @Get('data-export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({
    description:
      'Export the current user server-side account data without secrets or token hashes.',
    type: AuthUserDataExportResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async exportUserData(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const exported = await this.authService.exportUserData(user);

    void this.securityAudit.record({
      eventType: 'auth.user_data.export',
      request,
      severity: 'info',
      userId: user.userId,
    });

    return exported;
  }

  @Get('account/deletion-preview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({
    description:
      'Preview server-side account deletion impact without returning row contents.',
    type: AuthAccountDeletionPreviewResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  previewAccountDeletion(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.previewAccountDeletion(user);
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({
    type: AuthAccountDeletionRequestDto,
  })
  @ApiOkResponse({
    description:
      'Delete the current server-side account and detach retained operational records.',
    type: AuthAccountDeletionResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'The confirmation email or irreversible acknowledgement is invalid.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() deletionRequest: AuthAccountDeletionRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      this.authService.validateAccountDeletionRequest(user, deletionRequest);
    } catch (error) {
      await this.securityAudit.record({
        eventType: 'auth.account.delete_failed',
        metadata: {
          reason: getAccountDeletionFailureReason(error),
        },
        request,
        sessionId: user.sessionId,
        severity: 'warning',
        userId: user.userId,
      });
      this.metricsService?.recordUserDataRights({
        operation: 'delete',
        result: 'failure',
      });

      throw error;
    }

    try {
      await this.securityAudit.record({
        eventType: 'auth.account.delete',
        metadata: {
          result: 'accepted',
        },
        request,
        sessionId: user.sessionId,
        severity: 'warning',
        userId: user.userId,
      });

      const result = await this.authService.deleteAccount(
        user,
        deletionRequest,
      );

      response.clearCookie(
        REFRESH_TOKEN_COOKIE_NAME,
        getRefreshTokenClearCookieOptions(),
      );

      return result;
    } catch (error) {
      await this.securityAudit.record({
        eventType: 'auth.account.delete_failed',
        metadata: {
          reason: getAccountDeletionFailureReason(error),
        },
        request,
        sessionId: user.sessionId,
        severity: 'critical',
        userId: user.userId,
      });

      throw error;
    }
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
  @ApiParam({
    name: 'sessionId',
    format: 'uuid',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
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

  private createLegacyAuthDisabledException() {
    return new HttpException(
      'Email/password authentication is disabled. Continue with Google or use Work Archive as a guest.',
      HttpStatus.GONE,
    );
  }

  private clearOAuthCookies(response: Response) {
    response.clearCookie(
      GOOGLE_OAUTH_FLOW_COOKIE,
      getGoogleOAuthCookieOptions(),
    );
  }
}

function getAccountDeletionFailureReason(error: unknown) {
  if (error instanceof HttpException) {
    return `http_${error.getStatus()}`;
  }

  return 'internal_error';
}
