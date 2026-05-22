import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    @Inject(MetricsService) private readonly metricsService: MetricsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async getMetrics(@Res() response: Response) {
    if (!this.metricsService.isEnabled()) {
      throw new NotFoundException();
    }

    response.type(this.metricsService.contentType());
    response.send(await this.metricsService.metrics());
  }
}
