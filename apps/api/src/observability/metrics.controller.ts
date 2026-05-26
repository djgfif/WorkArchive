import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Req,
  Res,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';

import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    @Inject(MetricsService) private readonly metricsService: MetricsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async getMetrics(@Req() request: Request, @Res() response: Response) {
    if (!this.metricsService.canReadMetrics(request.header('authorization'))) {
      throw new NotFoundException();
    }

    response.type(this.metricsService.contentType());
    response.send(await this.metricsService.metrics());
  }
}
