import 'dotenv/config';

import {
  IMPORT_PROVIDER_VALUES,
  type ImportProvider,
} from '../modules/imports/imports.constants';
import {
  ProviderRuntimeStateService,
  type ProviderCircuitStatus,
} from '../modules/imports/runtime/provider-runtime-state.service';

const PRODUCTION_CONFIRMATION = 'clear-import-provider-circuit';

export interface ImportProviderCircuitClearConfig {
  dryRun: boolean;
  productionConfirmation: string | null;
  provider: ImportProvider;
  redisUrl: string | null;
}

export interface ImportProviderCircuitClearResult {
  cleared: boolean;
  dryRun: boolean;
  provider: ImportProvider;
  redisConfigured: boolean;
  statusAfter: ProviderCircuitStatus | null;
  statusBefore: ProviderCircuitStatus | null;
}

export interface ImportProviderCircuitRuntime {
  clearCircuit(provider: ImportProvider): Promise<void>;
  getCircuitStatus(provider: ImportProvider): Promise<ProviderCircuitStatus>;
}

export function readImportProviderCircuitClearConfig(
  env: NodeJS.ProcessEnv = process.env,
  providerArg = process.argv[2],
): ImportProviderCircuitClearConfig {
  const provider = parseImportProvider(
    env.IMPORT_PROVIDER_CIRCUIT_PROVIDER ?? providerArg,
  );

  return {
    dryRun: readBoolean(env.IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN, true),
    productionConfirmation:
      env.IMPORT_PROVIDER_CIRCUIT_CLEAR_CONFIRM?.trim() || null,
    provider,
    redisUrl: env.REDIS_URL?.trim() || null,
  };
}

export function assertImportProviderCircuitClearCanRun(
  config: ImportProviderCircuitClearConfig,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!config.dryRun && !config.redisUrl) {
    throw new Error(
      'REDIS_URL must be configured before clearing import provider circuit state. A separate operator process cannot clear in-memory API process state.',
    );
  }

  if (
    env.NODE_ENV?.trim() === 'production' &&
    !config.dryRun &&
    config.productionConfirmation !== PRODUCTION_CONFIRMATION
  ) {
    throw new Error(
      `Production import provider circuit clear requires IMPORT_PROVIDER_CIRCUIT_CLEAR_CONFIRM=${PRODUCTION_CONFIRMATION}.`,
    );
  }
}

export async function runImportProviderCircuitClear(
  runtime: ImportProviderCircuitRuntime,
  config: ImportProviderCircuitClearConfig,
): Promise<ImportProviderCircuitClearResult> {
  assertImportProviderCircuitClearCanRun(config);

  const statusBefore = config.redisUrl
    ? await runtime.getCircuitStatus(config.provider)
    : null;

  if (!config.dryRun) {
    await runtime.clearCircuit(config.provider);
  }

  const statusAfter = config.redisUrl
    ? await runtime.getCircuitStatus(config.provider)
    : null;
  const result: ImportProviderCircuitClearResult = {
    cleared: !config.dryRun,
    dryRun: config.dryRun,
    provider: config.provider,
    redisConfigured: Boolean(config.redisUrl),
    statusAfter,
    statusBefore,
  };

  logImportProviderCircuitClear(result);

  return result;
}

function parseImportProvider(value: string | undefined): ImportProvider {
  const provider = value?.trim();

  if (!provider) {
    throw new Error(
      `IMPORT_PROVIDER_CIRCUIT_PROVIDER or provider argument is required. Allowed providers: ${IMPORT_PROVIDER_VALUES.join(', ')}`,
    );
  }

  if (!isImportProvider(provider)) {
    throw new Error(
      `Unsupported import provider "${provider}". Allowed providers: ${IMPORT_PROVIDER_VALUES.join(', ')}`,
    );
  }

  return provider;
}

function isImportProvider(value: string): value is ImportProvider {
  return (IMPORT_PROVIDER_VALUES as readonly string[]).includes(value);
}

function readBoolean(value: string | undefined, defaultValue: boolean) {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return defaultValue;
  }

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  throw new Error(
    'IMPORT_PROVIDER_CIRCUIT_CLEAR_DRY_RUN must be true or false.',
  );
}

function logImportProviderCircuitClear(
  result: ImportProviderCircuitClearResult,
) {
  console.log(
    JSON.stringify({
      cleared: result.cleared,
      dryRun: result.dryRun,
      event: 'operations.import_provider_circuit.clear',
      provider: result.provider,
      redisConfigured: result.redisConfigured,
      statusAfter: result.statusAfter,
      statusBefore: result.statusBefore,
    }),
  );
}

async function main() {
  const runtime = new ProviderRuntimeStateService();
  const config = readImportProviderCircuitClearConfig();

  try {
    await runImportProviderCircuitClear(runtime, config);
  } finally {
    await runtime.onModuleDestroy();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(formatImportProviderCircuitClearFailure(error));
    process.exitCode = 1;
  });
}

export function formatImportProviderCircuitClearFailure(error: unknown) {
  return JSON.stringify({
    errorCode: error instanceof Error ? error.name : 'UnknownError',
    event: 'operations.import_provider_circuit.clear_failed',
  });
}
