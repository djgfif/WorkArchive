import { describe, expect, it, jest } from '@jest/globals';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../src/modules/auth/auth.types';
import { WorksController } from '../src/modules/works/works.controller';
import type { WorksService } from '../src/modules/works/works.service';
import { setRequestId } from '../src/security/security-audit.service';

describe('WorksController', () => {
  const user: AuthenticatedUser = {
    email: 'frieren@example.com',
    role: 'user',
    sessionId: 'session-1',
    userId: 'user-1',
  };

  it('passes request ids into work mutation service calls', async () => {
    const workResponse = {} as Awaited<ReturnType<WorksService['create']>>;
    const worksService = {
      create: jest.fn<WorksService['create']>().mockResolvedValue(workResponse),
      remove: jest.fn<WorksService['remove']>().mockResolvedValue(undefined),
      update: jest.fn<WorksService['update']>().mockResolvedValue(workResponse),
    } as unknown as WorksService;
    const controller = new WorksController(worksService);
    const request = {} as Request;
    setRequestId(request, 'req-work-controller-1');

    await controller.create(
      user,
      {
        title: 'Dune',
      },
      request,
    );
    await controller.update(user, 'work-1', { title: 'Dune Messiah' }, request);
    await controller.remove(user, 'work-1', request);

    expect(worksService.create).toHaveBeenCalledWith(
      'user-1',
      {
        title: 'Dune',
      },
      'req-work-controller-1',
    );
    expect(worksService.update).toHaveBeenCalledWith(
      'user-1',
      'work-1',
      {
        title: 'Dune Messiah',
      },
      'req-work-controller-1',
    );
    expect(worksService.remove).toHaveBeenCalledWith(
      'user-1',
      'work-1',
      'req-work-controller-1',
    );
  });
});
