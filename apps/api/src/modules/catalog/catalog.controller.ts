import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  toCatalogRelatedTitleView,
  toCatalogRelationView,
  toCatalogTitleView,
} from './catalog.presenter';
import { CatalogService } from './catalog.service';
import type { CatalogSearchQueryDto } from './dto/catalog-search-query.dto';
import type {
  CreateCatalogSubmissionDto,
  MergeCatalogTitleDto,
  ReviewCatalogSubmissionDto,
} from './dto/catalog-submission.dto';
import type { CatalogSubmissionsQueryDto } from './dto/catalog-submissions-query.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('catalog')
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  @Get('search')
  @ApiOkResponse({
    description: 'Search normalized catalog titles.',
  })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid, or expired.',
  })
  async search(@Query() query: CatalogSearchQueryDto) {
    const titles = await this.catalogService.search(query);

    return {
      query: query.query,
      mediumType: query.mediumType ?? null,
      titles: titles.map(toCatalogTitleView),
    };
  }

  @Get('titles/:id')
  @ApiOkResponse({
    description: 'Return one normalized catalog title.',
  })
  findTitle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.findTitleOrThrow(id).then(toCatalogTitleView);
  }

  @Get('titles/:id/related')
  @ApiOkResponse({
    description: 'Return related catalog titles.',
  })
  async findRelated(@Param('id', new ParseUUIDPipe()) id: string) {
    const related = await this.catalogService.findRelatedTitleReadModel(id);
    const relationByTitleId = new Map(
      related.relations.map((relation) => {
        const isOutgoing = relation.sourceTitleId === id;

        return [
          isOutgoing ? relation.targetTitleId : relation.sourceTitleId,
          {
            relationDirection: isOutgoing ? 'outgoing' : 'incoming',
            relationType: relation.relationType,
          },
        ] as const;
      }),
    );

    return {
      catalogTitleId: id,
      currentTitle: toCatalogTitleView(related.currentTitle),
      sameFranchiseTitles: related.sameFranchiseTitles.map((title) =>
        toCatalogRelatedTitleView(title, relationByTitleId.get(title.id) ?? null),
      ),
      relations: related.relations.map((relation) =>
        toCatalogRelationView(id, relation),
      ),
    };
  }

  @Get('franchises/:id/titles')
  @ApiOkResponse({
    description: 'Return all titles under a franchise.',
  })
  async findFranchiseTitles(@Param('id', new ParseUUIDPipe()) id: string) {
    const titles = await this.catalogService.findTitlesByFranchise(id);

    return {
      franchiseId: id,
      titles: titles.map(toCatalogTitleView),
    };
  }

  @Get('contributors/:id/titles')
  @ApiOkResponse({
    description: 'Return all titles connected to a contributor.',
  })
  async findContributorTitles(@Param('id', new ParseUUIDPipe()) id: string) {
    const titles = await this.catalogService.findTitlesByContributor(id);

    return {
      contributorId: id,
      titles: titles.map(toCatalogTitleView),
    };
  }

  @Post('submissions')
  @ApiCreatedResponse({
    description: 'Create a public catalog change submission.',
  })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateCatalogSubmissionDto,
  ) {
    return this.catalogService.submitCatalogChange(user.userId, {
      ...input,
      payload: input.payload,
    });
  }

  @Get('submissions')
  @ApiOkResponse({
    description: 'List all catalog change submissions for moderators.',
  })
  listSubmissions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CatalogSubmissionsQueryDto,
  ) {
    return this.catalogService.listSubmissions(
      {
        role: user.role,
        userId: user.userId,
      },
      query.status,
    );
  }

  @Get('submissions/mine')
  @ApiOkResponse({
    description: 'List catalog change submissions created by the current user.',
  })
  listMySubmissions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CatalogSubmissionsQueryDto,
  ) {
    return this.catalogService.listUserSubmissions(user.userId, query.status);
  }

  @Post('submissions/:id/approve')
  @ApiOkResponse({
    description: 'Approve a catalog change submission.',
  })
  approveSubmission(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ReviewCatalogSubmissionDto,
  ) {
    return this.catalogService.approveSubmission(
      {
        role: user.role,
        userId: user.userId,
      },
      id,
      input.reviewNote,
    );
  }

  @Post('submissions/:id/reject')
  @ApiOkResponse({
    description: 'Reject a catalog change submission.',
  })
  rejectSubmission(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ReviewCatalogSubmissionDto,
  ) {
    return this.catalogService.rejectSubmission(
      {
        role: user.role,
        userId: user.userId,
      },
      id,
      input.reviewNote,
    );
  }

  @Post('titles/:id/merge')
  @ApiOkResponse({
    description: 'Merge a duplicate catalog title into another title.',
  })
  mergeTitle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: MergeCatalogTitleDto,
  ) {
    return this.catalogService.mergeTitle(
      {
        role: user.role,
        userId: user.userId,
      },
      id,
      input.targetTitleId,
    );
  }
}
