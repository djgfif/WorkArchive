import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { WorkResponseDto } from './dto/work-response.dto';
import { WorksService } from './works.service';

@ApiTags('works')
@Controller('works')
export class WorksController {
  constructor(@Inject(WorksService) private readonly worksService: WorksService) {}

  @Get()
  @ApiOkResponse({
    description: 'List all active works.',
    type: WorkResponseDto,
    isArray: true,
  })
  findAll() {
    return this.worksService.findAll();
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Return a single active work.',
    type: WorkResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'The work was not found or has been deleted.',
  })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.worksService.findOne(id);
  }

  @Post()
  @ApiBody({
    type: CreateWorkDto,
  })
  @ApiCreatedResponse({
    description: 'Create a new work.',
    type: WorkResponseDto,
  })
  create(@Body() createWorkDto: CreateWorkDto) {
    return this.worksService.create(createWorkDto);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    format: 'uuid',
  })
  @ApiBody({
    type: UpdateWorkDto,
  })
  @ApiOkResponse({
    description: 'Update an existing active work.',
    type: WorkResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'The work was not found or has been deleted.',
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateWorkDto: UpdateWorkDto,
  ) {
    return this.worksService.update(id, updateWorkDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({
    name: 'id',
    format: 'uuid',
  })
  @ApiNoContentResponse({
    description: 'Soft-delete a work.',
  })
  @ApiNotFoundResponse({
    description: 'The work was not found or has been deleted.',
  })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.worksService.remove(id);
  }
}
