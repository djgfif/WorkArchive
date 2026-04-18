import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

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
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
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
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: RefreshDto,
  })
  @ApiOkResponse({
    description: 'Rotate the session using a valid refresh token.',
    type: AuthSessionResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The refresh token is invalid or expired.',
  })
  refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refresh(refreshDto);
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
}
