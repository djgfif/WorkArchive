import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateUserRecordV2Dto,
  UserRecordIdentityV2Dto,
} from './dto/v2-user-record.dto';
import { UpdateUserRecordDto } from './dto/user-record.dto';
import { UserRecordsService } from './user-records.service';

const IDENTITY_FIELDS = {
  catalog: ['kind', 'catalogTitleId'],
  external: [
    'kind',
    'provider',
    'externalId',
    'externalRefs',
    'title',
    'mediumType',
    'author',
    'description',
    'thumbnailUrl',
  ],
  manual: ['kind', 'title', 'mediumType'],
} as const;

@ApiTags('v2-user-records')
@ApiBearerAuth()
@ApiExtraModels(
  CreateUserRecordV2Dto,
  UserRecordIdentityV2Dto,
  UpdateUserRecordDto,
)
@UseGuards(JwtAuthGuard)
@Controller('v2/user-records')
export class UserRecordsV2Controller {
  constructor(
    @Inject(UserRecordsService)
    private readonly userRecordsService: UserRecordsService,
  ) {}

  @Get()
  @ApiOkResponse({
    description: 'List user records with a discriminated work identity.',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.userRecordsService.listV2Views(user.userId);
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'Return one user record with a discriminated work identity.',
  })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.userRecordsService.getV2ViewOrThrow(user.userId, id);
  }

  @Post()
  @ApiBody({ type: CreateUserRecordV2Dto })
  @ApiCreatedResponse({
    description:
      'Create a record from exactly one catalog, external, or manual identity.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateUserRecordV2Dto,
  ) {
    this.assertIdentityShape(input.identity);
    const record = input.record ?? {};
    let created: Awaited<ReturnType<UserRecordsService['createViewForUser']>>;

    if (input.identity.kind === 'catalog') {
      created = await this.userRecordsService.createViewForUser(user.userId, {
        ...record,
        catalogTitleId: input.identity.catalogTitleId!,
      });
    } else if (input.identity.kind === 'external') {
      const externalRefs = this.dedupeExternalRefs([
        {
          provider: input.identity.provider!,
          externalId: input.identity.externalId!,
        },
        ...(input.identity.externalRefs ?? []),
      ]);
      created = await this.userRecordsService.createViewFromImportForUser(
        user.userId,
        {
          ...record,
          ...(input.identity.author ? { author: input.identity.author } : {}),
          catalogTitle: input.identity.title!,
          contributors: input.identity.author
            ? [{ name: input.identity.author }]
            : [],
          ...(input.identity.description !== undefined
            ? { description: input.identity.description }
            : {}),
          externalRefs,
          mediumType: input.identity.mediumType!,
          ...(input.identity.thumbnailUrl !== undefined
            ? { thumbnailUrl: input.identity.thumbnailUrl }
            : {}),
          title: input.identity.title!,
          type: input.identity.mediumType!,
        },
      );
    } else {
      created = await this.userRecordsService.createViewForUser(user.userId, {
        ...record,
        title: input.identity.title!,
        type: input.identity.mediumType!,
      });
    }

    return this.userRecordsService.getV2ViewOrThrow(
      user.userId,
      created.record.id,
    );
  }

  @Patch(':id')
  @ApiBody({ type: UpdateUserRecordDto })
  @ApiOkResponse({
    description: 'Update personal fields without changing the work identity.',
  })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateUserRecordDto,
  ) {
    await this.userRecordsService.updateViewForUser(user.userId, id, input);
    return this.userRecordsService.getV2ViewOrThrow(user.userId, id);
  }

  private assertIdentityShape(identity: UserRecordIdentityV2Dto) {
    const allowed = new Set<string>(IDENTITY_FIELDS[identity.kind]);
    const extraFields = Object.entries(identity)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
      .filter((key) => !allowed.has(key));

    if (extraFields.length > 0) {
      throw new BadRequestException(
        `Identity kind "${identity.kind}" cannot include: ${extraFields.join(', ')}.`,
      );
    }

    if (identity.kind === 'catalog' && !identity.catalogTitleId) {
      throw new BadRequestException(
        'Catalog identity requires catalogTitleId.',
      );
    }
    if (
      identity.kind === 'external' &&
      (!identity.provider ||
        !identity.externalId ||
        !identity.title ||
        !identity.mediumType)
    ) {
      throw new BadRequestException(
        'External identity requires provider, externalId, title, and mediumType.',
      );
    }
    if (
      identity.kind === 'manual' &&
      (!identity.title || !identity.mediumType)
    ) {
      throw new BadRequestException(
        'Manual identity requires title and mediumType.',
      );
    }
  }

  private dedupeExternalRefs(
    refs: Array<{
      provider: string;
      externalId: string;
      rawType?: string;
      url?: string;
    }>,
  ) {
    return [
      ...new Map(
        refs.map((ref) => [`${ref.provider}:${ref.externalId}`, ref]),
      ).values(),
    ];
  }
}
