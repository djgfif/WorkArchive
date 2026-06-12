import type { ImportProviderStatusResponseDto } from './dto/import-provider-status-response.dto';
import {
  KAKAO_BOOK_PROVIDER,
  KAKAO_WEB_PROVIDER,
  KOBIS_PROVIDER,
  NAVER_BOOK_PROVIDER,
  NAVER_WEB_PROVIDER,
  type ImportProvider,
} from './imports.constants';
import { PROVIDERS } from './providers/import-provider-adapter';
import {
  getServerProviderApiKey,
  hasServerProviderCredential,
  isKobisHttpProviderEnabled,
} from './providers/import-provider-config';
import type { ProviderCircuitStatus } from './runtime/provider-runtime-state.service';

export interface ImportProviderReadinessCredentialStore {
  hasCredential(
    userId: string,
    provider: ImportProvider,
  ): boolean | Promise<boolean>;
}

export async function isImportProviderConfigured(input: {
  credentialStore: ImportProviderReadinessCredentialStore;
  provider: ImportProvider;
  userId: string | null;
}) {
  const metadata = PROVIDERS[input.provider];

  if (input.provider === KOBIS_PROVIDER && !isKobisHttpProviderEnabled()) {
    return false;
  }

  if (metadata.credentialMode === 'none') {
    return true;
  }

  if (metadata.credentialMode === 'server') {
    return Boolean(getServerProviderApiKey(input.provider));
  }

  if (hasServerProviderCredential(input.provider)) {
    return true;
  }

  if (!input.userId) {
    return false;
  }

  if (input.provider === NAVER_WEB_PROVIDER) {
    return (
      hasServerProviderCredential(NAVER_BOOK_PROVIDER) ||
      (await input.credentialStore.hasCredential(
        input.userId,
        NAVER_WEB_PROVIDER,
      )) ||
      input.credentialStore.hasCredential(input.userId, NAVER_BOOK_PROVIDER)
    );
  }

  if (input.provider === KAKAO_WEB_PROVIDER) {
    return (
      hasServerProviderCredential(KAKAO_BOOK_PROVIDER) ||
      (await input.credentialStore.hasCredential(
        input.userId,
        KAKAO_WEB_PROVIDER,
      )) ||
      input.credentialStore.hasCredential(input.userId, KAKAO_BOOK_PROVIDER)
    );
  }

  if (metadata.credentialMode === 'user') {
    return input.credentialStore.hasCredential(input.userId, input.provider);
  }

  return false;
}

export function buildImportProviderStatus(input: {
  circuitStatus: ProviderCircuitStatus;
  configured: boolean;
  provider: ImportProvider;
}): ImportProviderStatusResponseDto {
  const metadata = PROVIDERS[input.provider];

  return {
    ...input.circuitStatus,
    configured: input.configured,
    credentialMode: metadata.credentialMode,
    label: metadata.label,
    mediumTypes: metadata.mediumTypes,
    provider: input.provider,
    ...(metadata.credentialFields
      ? { credentialFields: metadata.credentialFields }
      : {}),
  };
}
