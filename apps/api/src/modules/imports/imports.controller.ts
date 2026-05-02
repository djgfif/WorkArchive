import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  UnauthorizedException,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportProviderStatusResponseDto } from './dto/import-provider-status-response.dto';
import { ImportSearchQueryDto } from './dto/import-search-query.dto';
import { ImportSearchResponseDto } from './dto/import-search-response.dto';
import { UpsertAladinKeyDto } from './dto/upsert-aladin-key.dto';
import { UpsertProviderKeyDto } from './dto/upsert-provider-key.dto';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@Controller('imports')
export class ImportsController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ImportsService) private readonly importsService: ImportsService,
  ) {}

  @Get('providers/aladin/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'Return whether the current user has configured Aladin search.',
    type: ImportProviderStatusResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  getAladinStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.importsService.getAladinProviderStatus(user.userId);
  }

  @Get('providers')
  @ApiOkResponse({
    description: 'Return import provider capabilities and configuration state.',
    type: ImportProviderStatusResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async listProviders(@Headers('authorization') authorizationHeader?: string) {
    const user = await this.getOptionalUser(authorizationHeader);

    return this.importsService.listProviders(user?.userId ?? null);
  }

  @Put('providers/aladin/key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({
    type: UpsertAladinKeyDto,
  })
  @ApiOkResponse({
    description: 'Store or replace the current user Aladin TTBKey.',
    type: ImportProviderStatusResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  saveAladinKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() upsertAladinKeyDto: UpsertAladinKeyDto,
  ) {
    return this.importsService.saveAladinKey(
      user.userId,
      upsertAladinKeyDto.ttbKey,
    );
  }

  @Delete('providers/aladin/key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Remove the current user Aladin TTBKey.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async deleteAladinKey(@CurrentUser() user: AuthenticatedUser) {
    await this.importsService.deleteAladinKey(user.userId);
  }

  @Put('providers/:provider/key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({
    type: UpsertProviderKeyDto,
  })
  @ApiOkResponse({
    description: 'Store or replace a provider API credential for the current user.',
    type: ImportProviderStatusResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  saveProviderKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') provider: string,
    @Body() upsertProviderKeyDto: UpsertProviderKeyDto,
  ) {
    return this.importsService.saveProviderKey(
      user.userId,
      provider,
      upsertProviderKeyDto.values,
    );
  }

  @Delete('providers/:provider/key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Remove a provider API credential for the current user.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async deleteProviderKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') provider: string,
  ) {
    await this.importsService.deleteProviderKey(user.userId, provider);
  }

  @Get('search')
  @ApiExtraModels(ImportSearchQueryDto)
  @ApiOkResponse({
    description: 'Search provider metadata candidates for Quick Add.',
    type: ImportSearchResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async search(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query() importSearchQueryDto: ImportSearchQueryDto,
  ) {
    const user = await this.getOptionalUser(authorizationHeader);

    return this.importsService.search(user?.userId ?? null, importSearchQueryDto);
  }

  @Post('resolve')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'Return a normalized import candidate payload for client review.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  resolve(@Body() candidate: Record<string, unknown>) {
    return {
      candidate,
      resolved: true,
    };
  }

  private async getOptionalUser(authorizationHeader?: string) {
    if (!authorizationHeader) {
      return null;
    }

    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Malformed Bearer access token.');
    }

    return this.authService.validateAccessToken(token);
  }
}
