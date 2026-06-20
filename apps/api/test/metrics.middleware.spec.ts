import { EventEmitter } from 'node:events';

import { describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';

import { createMetricsMiddleware } from '../src/observability/metrics.middleware';

describe('createMetricsMiddleware', () => {
  it('uses matched route templates instead of raw URLs for request metrics', () => {
    const recordRequest = jest.fn();
    const response = createResponse(200);
    const request = {
      baseUrl: '/api/works',
      method: 'GET',
      originalUrl: '/api/works/07f33d1e-5ef9-4388-b007-813476f31e9e',
      route: {
        path: '/:id',
      },
    } as Request;
    const next = jest.fn(() => undefined);

    createMetricsMiddleware({ recordRequest })(request, response, next);
    response.emit('finish');

    expect(next).toHaveBeenCalled();
    expect(recordRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        route: '/api/works/:id',
        status_class: '2xx',
      }),
      expect.any(Number),
    );
  });

  it('buckets unmatched 404s to avoid high-cardinality route labels', () => {
    const recordRequest = jest.fn();
    const response = createResponse(404);
    const request = {
      method: 'GET',
      originalUrl: '/api/not-real/user-supplied-segment-123',
    } as Request;

    createMetricsMiddleware({ recordRequest })(
      request,
      response,
      () => undefined,
    );
    response.emit('finish');

    expect(recordRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'not_found',
        status_class: '4xx',
      }),
      expect.any(Number),
    );
  });
});

function createResponse(statusCode: number) {
  const response = new EventEmitter() as Response & EventEmitter;

  response.statusCode = statusCode;

  return response;
}
