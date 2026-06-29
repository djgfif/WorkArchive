import type { ApiRuntimeConfig } from './config/api-runtime-config';

interface TimeoutCapableHttpServer {
  headersTimeout: number;
  keepAliveTimeout: number;
  requestTimeout: number;
}

export function configureHttpServerTimeouts(
  server: TimeoutCapableHttpServer,
  config: Pick<
    ApiRuntimeConfig,
    'headersTimeoutMs' | 'keepAliveTimeoutMs' | 'requestTimeoutMs'
  >,
) {
  server.requestTimeout = config.requestTimeoutMs;
  server.headersTimeout = config.headersTimeoutMs;
  server.keepAliveTimeout = config.keepAliveTimeoutMs;
}
