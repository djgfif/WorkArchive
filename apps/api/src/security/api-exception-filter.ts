import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

import { getRequestId } from './security-audit.service';

const GENERIC_INTERNAL_ERROR_MESSAGE = 'Internal server error.';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    if (response.headersSent) {
      return;
    }

    const requestId = getRequestId(request);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response
        .status(status)
        .json(this.buildHttpExceptionBody(exception, status, requestId));
      return;
    }

    this.logger.error(
      JSON.stringify({
        errorCode: getExceptionType(exception),
        event: 'api.exception.unhandled',
        method: request.method,
        path: getRequestPathname(request.originalUrl ?? request.url),
        requestId: requestId ?? null,
      }),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: GENERIC_INTERNAL_ERROR_MESSAGE,
      requestId,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }

  private buildHttpExceptionBody(
    exception: HttpException,
    status: number,
    requestId: string | null,
  ) {
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      return {
        error: 'Internal Server Error',
        message: GENERIC_INTERNAL_ERROR_MESSAGE,
        requestId,
        statusCode: status,
      };
    }

    const response = exception.getResponse();

    if (isRecord(response)) {
      return {
        ...withoutStack(response),
        requestId,
        statusCode:
          typeof response.statusCode === 'number' ? response.statusCode : status,
      };
    }

    return {
      error: exception.name,
      message: String(response),
      requestId,
      statusCode: status,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withoutStack(value: Record<string, unknown>) {
  const { stack: _stack, ...rest } = value;

  return rest;
}

function getRequestPathname(value: string | undefined) {
  if (!value) {
    return '/';
  }

  return value.split(/[?#]/, 1)[0] || '/';
}

function getExceptionType(exception: unknown) {
  if (exception instanceof Error) {
    return exception.name || 'Error';
  }

  return typeof exception;
}
