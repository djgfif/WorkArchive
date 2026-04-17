import { Test } from '@nestjs/testing';
import { describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { AppController } from '../src/modules/app/app.controller';

describe('AppModule', () => {
  it('provides the root application controller', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const controller = moduleRef.get(AppController);

    expect(controller.getStatus()).toEqual({
      name: 'work-archive-api',
      status: 'ready',
    });
  });
});
