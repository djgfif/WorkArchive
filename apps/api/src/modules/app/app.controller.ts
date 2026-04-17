import { Controller, Get } from '@nestjs/common';

interface AppStatusResponse {
  name: string;
  status: 'ready';
}

@Controller()
export class AppController {
  @Get()
  getStatus(): AppStatusResponse {
    return {
      name: 'work-archive-api',
      status: 'ready',
    };
  }
}
