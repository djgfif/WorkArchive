import type { NextFunction, Request, Response } from 'express';

import type { MetricsService } from './metrics.service';
import { normalizeMetricsRoute } from './metrics.service';

type RequestWithRoute = Request & {
  route?: {
    path?: string;
  };
};

export function createMetricsMiddleware(
  metricsService: Pick<MetricsService, 'recordRequest'>,
) {
  return (request: RequestWithRoute, response: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();

    response.on('finish', () => {
      const durationSeconds =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      const route =
        typeof request.route?.path === 'string'
          ? `${request.baseUrl}${request.route.path}`
          : response.statusCode === 404
            ? 'not_found'
          : request.originalUrl;

      metricsService.recordRequest(
        {
          method: request.method,
          route: normalizeMetricsRoute(route),
          status_class: `${Math.trunc(response.statusCode / 100)}xx`,
        },
        durationSeconds,
      );
    });

    next();
  };
}
