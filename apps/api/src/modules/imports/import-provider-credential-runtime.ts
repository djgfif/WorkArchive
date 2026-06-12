import type { ImportProvider } from './imports.constants';
import { parseCredentialValues } from './credentials/import-provider-credentials';
import type { ProviderCredentialValues } from './providers/import-provider-adapter';
import { getServerProviderCredentialValues } from './providers/import-provider-config';
import type { ImportProviderSearchRuntime } from './providers/import-provider-search';

export interface ImportProviderCredentialReader {
  getDecryptedCredential(
    userId: string,
    provider: ImportProvider,
  ): Promise<string | null>;
}

export async function readImportProviderCredentialValues(input: {
  credentialReader: ImportProviderCredentialReader;
  provider: ImportProvider;
  userId: string;
}) {
  const rawCredential = await input.credentialReader.getDecryptedCredential(
    input.userId,
    input.provider,
  );

  if (!rawCredential) {
    return null;
  }

  return parseCredentialValues(input.provider, rawCredential);
}

export async function readImportProviderCredentialValuesWithFallback(input: {
  credentialReader: ImportProviderCredentialReader;
  fallbackProvider: ImportProvider;
  provider: ImportProvider;
  userId: string;
}) {
  return (
    (await readImportProviderCredentialValues(input)) ??
    readImportProviderCredentialValues({
      credentialReader: input.credentialReader,
      provider: input.fallbackProvider,
      userId: input.userId,
    })
  );
}

export async function readImportSearchCredentialValues(input: {
  credentialReader: ImportProviderCredentialReader;
  provider: ImportProvider;
  userId: string | null;
}) {
  const serverCredential = getServerProviderCredentialValues(input.provider);

  if (serverCredential) {
    return serverCredential;
  }

  return input.userId
    ? readImportProviderCredentialValues({
        credentialReader: input.credentialReader,
        provider: input.provider,
        userId: input.userId,
      })
    : null;
}

export async function readImportSearchCredentialValuesWithFallback(input: {
  credentialReader: ImportProviderCredentialReader;
  fallbackProvider: ImportProvider;
  provider: ImportProvider;
  userId: string | null;
}) {
  return (
    (await readImportSearchCredentialValues(input)) ??
    readImportSearchCredentialValues({
      credentialReader: input.credentialReader,
      provider: input.fallbackProvider,
      userId: input.userId,
    })
  );
}

export function buildImportProviderCredentialRuntime(input: {
  credentialReader: ImportProviderCredentialReader;
  fetchJson: ImportProviderSearchRuntime['fetchJson'];
}): ImportProviderSearchRuntime {
  return {
    fetchJson: input.fetchJson,
    getProviderCredentialValues: (userId, provider) =>
      readImportProviderCredentialValues({
        credentialReader: input.credentialReader,
        provider,
        userId,
      }),
    getProviderCredentialValuesWithFallback: (
      userId,
      provider,
      fallbackProvider,
    ) =>
      readImportProviderCredentialValuesWithFallback({
        credentialReader: input.credentialReader,
        fallbackProvider,
        provider,
        userId,
      }),
    getSearchProviderCredentialValues: (userId, provider) =>
      readImportSearchCredentialValues({
        credentialReader: input.credentialReader,
        provider,
        userId,
      }) as Promise<ProviderCredentialValues | null>,
    getSearchProviderCredentialValuesWithFallback: (
      userId,
      provider,
      fallbackProvider,
    ) =>
      readImportSearchCredentialValuesWithFallback({
        credentialReader: input.credentialReader,
        fallbackProvider,
        provider,
        userId,
      }) as Promise<ProviderCredentialValues | null>,
  };
}
