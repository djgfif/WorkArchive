import 'dotenv/config';

const DEFAULT_STARTUP_TIMEOUT_MS = 20_000;
const DEFAULT_RESTART_GRACE_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_FETCH_TIMEOUT_MS = 2_000;
const WAIT_LOG_INTERVAL_MS = 10_000;

function readBoolean(value, fallback) {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return fallback;
  }

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  return fallback;
}

function readPositiveInteger(value, fallback) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function getPort() {
  const normalizedPort = process.env.PORT?.trim();

  if (!normalizedPort) {
    return 3000;
  }

  const parsedPort = Number.parseInt(normalizedPort, 10);

  return Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
}

async function checkUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, fetchTimeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.name : 'FetchError',
      ok: false,
      status: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

const port = getPort();
const startupTimeoutMs = readPositiveInteger(
  process.env.API_HEALTH_STARTUP_TIMEOUT_MS,
  DEFAULT_STARTUP_TIMEOUT_MS,
);
const restartGraceMs = readPositiveInteger(
  process.env.API_HEALTH_RESTART_GRACE_MS,
  DEFAULT_RESTART_GRACE_MS,
);
const pollIntervalMs = readPositiveInteger(
  process.env.API_HEALTH_POLL_INTERVAL_MS,
  DEFAULT_POLL_INTERVAL_MS,
);
const fetchTimeoutMs = readPositiveInteger(
  process.env.API_HEALTH_FETCH_TIMEOUT_MS,
  DEFAULT_FETCH_TIMEOUT_MS,
);
const swaggerEnabled = readBoolean(
  process.env.SWAGGER_ENABLED,
  process.env.NODE_ENV?.trim() !== 'production',
);
const healthUrl = `http://127.0.0.1:${port}/health`;
const openApiUrl = `http://127.0.0.1:${port}/docs/openapi.json`;

let readyAt = null;
let wasReady = false;
let lastWaitLogAt = 0;
const startedAt = Date.now();

function describeCheck(name, result) {
  if (result.ok) {
    return `${name}=ok`;
  }

  if (result.status !== null) {
    return `${name}=HTTP ${result.status}`;
  }

  return `${name}=${result.error ?? 'unreachable'}`;
}

function maybeLogWaiting(now, healthResult, swaggerResult, deadline) {
  if (now - lastWaitLogAt < WAIT_LOG_INTERVAL_MS) {
    return;
  }

  lastWaitLogAt = now;

  process.stdout.write(
    `[api:health] Waiting for API readiness on port ${port}. ${describeCheck(
      'health',
      healthResult,
    )}${swaggerEnabled ? `, ${describeCheck('swagger', swaggerResult)}` : ''}. Timeout in ${Math.max(
      0,
      Math.ceil((deadline - now) / 1000),
    )}s.\n`,
  );
}

async function poll() {
  const healthResult = await checkUrl(healthUrl);
  const swaggerResult = swaggerEnabled
    ? await checkUrl(openApiUrl)
    : {
        ok: true,
        status: 200,
      };
  const isReady = healthResult.ok && swaggerResult.ok;
  const now = Date.now();
  const deadline = wasReady
    ? readyAt + restartGraceMs
    : startedAt + startupTimeoutMs;

  if (isReady) {
    if (!wasReady) {
      process.stdout.write(
        `[api:health] API is ready on port ${port}${swaggerEnabled ? ' with Swagger enabled' : ''}.\n`,
      );
    }

    wasReady = true;
    readyAt = now;
    return;
  }

  maybeLogWaiting(now, healthResult, swaggerResult, deadline);

  if (now >= deadline) {
    process.stderr.write(
      `[api:health] API readiness check failed on port ${port} after ${wasReady ? restartGraceMs : startupTimeoutMs}ms. ${describeCheck(
        'health',
        healthResult,
      )}${swaggerEnabled ? `, ${describeCheck('swagger', swaggerResult)}` : ''}.\n`,
    );
    process.exit(1);
  }
}

let stopped = false;
let timer = null;

async function loop() {
  if (stopped) {
    return;
  }

  await poll();

  if (!stopped) {
    timer = setTimeout(() => {
      void loop();
    }, pollIntervalMs);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopped = true;

    if (timer) {
      clearTimeout(timer);
    }

    process.exit(0);
  });
}

void loop();
