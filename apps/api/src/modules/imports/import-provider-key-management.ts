import type { ImportProviderKeyTestResponseDto } from './dto/import-provider-key-test-response.dto';
import type { ImportProviderStatusResponseDto } from './dto/import-provider-status-response.dto';
import type { ImportProvider } from './imports.constants';
import { PROVIDERS, type ProviderCredentialValues } from './providers/import-provider-adapter';
import type { ImportProviderFetchJson } from './credentials/import-provider-key-tester';
import { runImportProviderKeyTest } from './credentials/import-provider-key-tester';
import {
  assertUserCredentialProvider,
  buildProviderKeyTestResponse,
  classifyProviderKeyTestFailure,
  getProviderKeyTestFailureMessage,
  normalizeCredentialValues,
} from './credentials/import-provider-credentials';
import {
  readImportProviderCredentialValues,
  type ImportProviderCredentialReader,
} from './import-provider-credential-runtime';
import { buildImportProviderStatus } from './import-provider-readiness';
import type { ProviderRuntimeStateService } from './runtime/provider-runtime-state.service';

export interface ImportProviderCredentialStore
  extends ImportProviderCredentialReader {
  deleteCredential(userId: string, provider: ImportProvider): Promise<unknown>;
  saveCredential(
    userId: string,
    provider: ImportProvider,
    rawCredential: string,
  ): Promise<unknown>;
}

export async function saveImportProviderKey(input: {
  credentialStore: ImportProviderCredentialStore;
  getCircuitStatus: Pick<
    ProviderRuntimeStateService,
    'getCircuitStatus'
  >['getCircuitStatus'];
  providerInput: string;
  userId: string;
  values: ProviderCredentialValues;
}): Promise<ImportProviderStatusResponseDto> {
  const provider = assertUserCredentialProvider(input.providerInput);
  const credentialValues = normalizeCredentialValues(provider, input.values);

  await input.credentialStore.saveCredential(
    input.userId,
    provider,
    JSON.stringify(credentialValues),
  );

  return buildImportProviderStatus({
    circuitStatus: await input.getCircuitStatus(provider),
    configured: true,
    provider,
  });
}

export async function deleteImportProviderKey(input: {
  credentialStore: ImportProviderCredentialStore;
  providerInput: string;
  userId: string;
}) {
  const provider = assertUserCredentialProvider(input.providerInput);

  await input.credentialStore.deleteCredential(input.userId, provider);
}

export async function testImportProviderKey(input: {
  checkedAt?: string;
  credentialReader: ImportProviderCredentialReader;
  fetchJson: ImportProviderFetchJson;
  providerInput: string;
  userId: string;
}): Promise<ImportProviderKeyTestResponseDto> {
  const provider = assertUserCredentialProvider(input.providerInput);
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const credentials = await readImportProviderCredentialValues({
    credentialReader: input.credentialReader,
    provider,
    userId: input.userId,
  });

  if (!credentials) {
    return buildProviderKeyTestResponse({
      checkedAt,
      message: `${PROVIDERS[provider].label} API key is not configured.`,
      ok: false,
      provider,
      reason: 'missing_key',
    });
  }

  try {
    await runImportProviderKeyTest(provider, credentials, input.fetchJson);

    return buildProviderKeyTestResponse({
      checkedAt,
      message: `${PROVIDERS[provider].label} API key connection test succeeded.`,
      ok: true,
      provider,
      reason: null,
    });
  } catch (error) {
    const reason = classifyProviderKeyTestFailure(error);

    return buildProviderKeyTestResponse({
      checkedAt,
      message: getProviderKeyTestFailureMessage(provider, reason),
      ok: false,
      provider,
      reason,
    });
  }
}
