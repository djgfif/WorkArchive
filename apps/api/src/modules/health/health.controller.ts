import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  service: string;
  status: 'ok';
}

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      service: 'work-archive-api',
      status: 'ok',
    };
  }
}
