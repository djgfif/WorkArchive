import type { ImportProvider } from '../imports.constants';
import type { ProviderCredentialValues } from './import-provider-adapter';
import type { ImportProviderFetchOptions } from './import-provider-http';

export interface ImportProviderSearchRuntime {
  fetchJson(
    rawUrl: URL | string,
    options: ImportProviderFetchOptions,
  ): Promise<unknown>;
  getProviderCredentialValues(
    userId: string,
    provider: ImportProvider,
  ): Promise<ProviderCredentialValues | null>;
  getProviderCredentialValuesWithFallback(
    userId: string,
    provider: ImportProvider,
    fallbackProvider: ImportProvider,
  ): Promise<ProviderCredentialValues | null>;
  getSearchProviderCredentialValues(
    userId: string | null,
    provider: ImportProvider,
  ): Promise<ProviderCredentialValues | null>;
  getSearchProviderCredentialValuesWithFallback(
    userId: string | null,
    provider: ImportProvider,
    fallbackProvider: ImportProvider,
  ): Promise<ProviderCredentialValues | null>;
}
