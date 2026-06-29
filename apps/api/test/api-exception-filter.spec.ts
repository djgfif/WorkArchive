import { Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';

import { ApiExceptionFilter } from '../src/security/api-exception-filter';

describe('ApiExceptionFilter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs unhandled exceptions without raw messages, stack traces, or URL secrets', () => {
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const response = createResponseMock();
    const request = {
      method: 'GET',
      originalUrl:
        '/api/auth/google/callback?code=oauth-code&state=oauth-state',
      requestId: 'req-unhandled-1',
    } as Request & { requestId: string };
    const exception = new Error(
      'DATABASE_URL=postgresql://secret access_token raw payload',
    );

    exception.stack = `${exception.name}: ${exception.message}
    at handler (/home/user/app/src/private.ts:10:1)`;

    new ApiExceptionFilter().catch(
      exception,
      createArgumentsHost(request, response),
    );

    expect(loggerError).toHaveBeenCalledWith(
      JSON.stringify({
        errorCode: 'Error',
        event: 'api.exception.unhandled',
        method: 'GET',
        path: '/api/auth/google/callback',
        requestId: 'req-unhandled-1',
      }),
    );
    expect(loggerError).toHaveBeenCalledTimes(1);

    const payload = JSON.stringify(loggerError.mock.calls);

    expect(payload).not.toContain('DATABASE_URL');
    expect(payload).not.toContain('postgresql://secret');
    expect(payload).not.toContain('access_token');
    expect(payload).not.toContain('raw payload');
    expect(payload).not.toContain('/home/user/app');
    expect(payload).not.toContain('oauth-code');
    expect(payload).not.toContain('oauth-state');
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Internal server error.',
        requestId: 'req-unhandled-1',
        statusCode: 500,
      }),
    );
  });
});

function createResponseMock() {
  return {
    headersSent: false,
    json: jest.fn<Response['json']>(),
    status: jest.fn<Response['status']>().mockReturnThis(),
  } as unknown as Response & {
    json: jest.MockedFunction<Response['json']>;
    status: jest.MockedFunction<Response['status']>;
  };
}

function createArgumentsHost(
  request: Request,
  response: Response,
): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost;
}
