import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

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
import { LoginDto } from './dto/login.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import {
  PasswordResetConfirmResponseDto,
  PasswordResetRequestResponseDto,
} from './dto/password-reset-response.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  @Post('register')
  @ApiBody({
    type: RegisterDto,
  })
  @ApiCreatedResponse({
    description: 'Create a user account and return a fresh session.',
    type: AuthSessionResponseDto,
  })
  @ApiConflictResponse({
    description: 'An account with this email already exists.',
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.register(
      registerDto,
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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: LoginDto,
  })
  @ApiOkResponse({
    description: 'Authenticate with email and password.',
    type: AuthSessionResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The email or password is invalid.',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const metadata = this.getSessionMetadata(request);
    let session: Awaited<ReturnType<AuthService['login']>>;

    try {
      session = await this.authService.login(loginDto, metadata);
    } catch (error) {
      void this.securityAudit.record({
        eventType: 'auth.login.failure',
        metadata: {
          reason: 'invalid_credentials',
        },
        request,
        severity: 'warning',
      });
      throw error;
    }

    void this.securityAudit.record({
      eventType: 'auth.login.success',
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

    return this.authService.toSessionResponse(session);
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
  @ApiBody({
    type: PasswordResetRequestDto,
  })
  @ApiOkResponse({
    description:
      'Create a development password reset link when the account exists.',
    type: PasswordResetRequestResponseDto,
  })
  async requestPasswordReset(
    @Body() passwordResetRequestDto: PasswordResetRequestDto,
    @Req() request: Request,
  ) {
    const response = await this.authService.requestPasswordReset(
      passwordResetRequestDto,
    );

    void this.securityAudit.record({
      eventType: 'auth.password_reset.request',
      request,
      severity: 'info',
    });

    return response;
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: PasswordResetConfirmDto,
  })
  @ApiOkResponse({
    description: 'Reset the password using a valid development reset token.',
    type: PasswordResetConfirmResponseDto,
  })
  async confirmPasswordReset(
    @Body() passwordResetConfirmDto: PasswordResetConfirmDto,
    @Req() request: Request,
  ) {
    const response = await this.authService.confirmPasswordReset(
      passwordResetConfirmDto,
    );

    void this.securityAudit.record({
      eventType: 'auth.password_reset.confirm',
      request,
      severity: 'info',
    });

    return response;
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
}
