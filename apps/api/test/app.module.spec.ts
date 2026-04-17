import { Test } from '@nestjs/testing';
import { describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { HealthController } from '../src/modules/health/health.controller';

describe('AppModule', () => {
  it('provides the health controller', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const controller = moduleRef.get(HealthController);

    expect(controller.getHealth()).toEqual({
      service: 'work-archive-api',
      status: 'ok',
    });
  });
});
