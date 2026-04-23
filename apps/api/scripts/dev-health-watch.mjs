import 'dotenv/config';

const STARTUP_TIMEOUT_MS = 20_000;
const RESTART_GRACE_MS = 10_000;
const POLL_INTERVAL_MS = 1_000;

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

function getPort() {
  const normalizedPort = process.env.PORT?.trim();

  if (!normalizedPort) {
    return 3000;
  }

  const parsedPort = Number.parseInt(normalizedPort, 10);

  return Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
}

async function checkUrl(url) {
  try {
    const response = await fetch(url);

    return response.ok;
  } catch {
    return false;
  }
}

const port = getPort();
const swaggerEnabled = readBoolean(
  process.env.SWAGGER_ENABLED,
  process.env.NODE_ENV?.trim() !== 'production',
);
const healthUrl = `http://127.0.0.1:${port}/health`;
const openApiUrl = `http://127.0.0.1:${port}/docs/openapi.json`;

let readyAt = null;
let wasReady = false;
const startedAt = Date.now();

async function poll() {
  const isHealthReady = await checkUrl(healthUrl);
  const isSwaggerReady = swaggerEnabled ? await checkUrl(openApiUrl) : true;
  const isReady = isHealthReady && isSwaggerReady;

  if (isReady) {
    if (!wasReady) {
      process.stdout.write(
        `[api:health] API is ready on port ${port}${swaggerEnabled ? ' with Swagger enabled' : ''}.\n`,
      );
    }

    wasReady = true;
    readyAt = Date.now();
    return;
  }

  const now = Date.now();
  const deadline = wasReady ? readyAt + RESTART_GRACE_MS : startedAt + STARTUP_TIMEOUT_MS;

  if (now >= deadline) {
    const missingChecks = [
      isHealthReady ? null : 'health',
      isSwaggerReady ? null : 'swagger',
    ].filter(Boolean);

    process.stderr.write(
      `[api:health] API readiness check failed on port ${port}. Missing: ${missingChecks.join(', ')}.\n`,
    );
    process.exit(1);
  }
}

const interval = setInterval(() => {
  void poll();
}, POLL_INTERVAL_MS);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearInterval(interval);
    process.exit(0);
  });
}

void poll();
