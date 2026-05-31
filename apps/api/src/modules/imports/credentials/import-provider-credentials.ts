import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import type {
  ImportProviderKeyTestFailureReason,
  ImportProviderKeyTestResponseDto,
} from '../dto/import-provider-key-test-response.dto';
import {
  ALADIN_PROVIDER,
  IMPORT_PROVIDER_VALUES,
  type ImportProvider,
} from '../imports.constants';
import {
  PROVIDERS,
  type ProviderCredentialValues,
} from '../providers/import-provider-adapter';

export function buildProviderKeyTestResponse(input: {
  checkedAt: string;
  message: string;
  ok: boolean;
  provider: ImportProvider;
  reason: ImportProviderKeyTestFailureReason | null;
}): ImportProviderKeyTestResponseDto {
  return {
    checkedAt: input.checkedAt,
    message: input.message,
    ok: input.ok,
    provider: input.provider,
    reason: input.reason,
  };
}

export function assertUserCredentialProvider(providerInput: string) {
  if (!(IMPORT_PROVIDER_VALUES as readonly string[]).includes(providerInput)) {
    throw new BadRequestException('Unsupported import provider.');
  }

  const provider = providerInput as ImportProvider;
  const metadata = PROVIDERS[provider];

  if (metadata.credentialMode !== 'user') {
    throw new BadRequestException(
      `${metadata.label} does not accept user API keys.`,
    );
  }

  return provider;
}

export function normalizeCredentialValues(
  provider: ImportProvider,
  values: ProviderCredentialValues,
) {
  const fields = PROVIDERS[provider].credentialFields ?? [];
  const normalized: ProviderCredentialValues = {};

  for (const field of fields) {
    const value = values[field.name]?.trim();

    if (!value) {
      throw new BadRequestException(`${field.label} is required.`);
    }

    normalized[field.name] = value;
  }

  return normalized;
}

export function parseCredentialValues(
  provider: ImportProvider,
  rawCredential: string,
) {
  const rawValue = rawCredential.trim();

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (isPlainRecord(parsed)) {
      const values: ProviderCredentialValues = {};

      for (const field of PROVIDERS[provider].credentialFields ?? []) {
        const value = parsed[field.name];

        if (typeof value === 'string' && value.trim()) {
          values[field.name] = value.trim();
        }
      }

      return Object.keys(values).length > 0 ? values : null;
    }
  } catch {
    // Legacy Aladin credentials were stored as a raw TTBKey string.
  }

  if (provider === ALADIN_PROVIDER) {
    return {
      ttbKey: rawValue,
    };
  }

  return null;
}

export function classifyProviderKeyTestFailure(
  error: unknown,
): ImportProviderKeyTestFailureReason {
  if (error instanceof ForbiddenException) {
    return 'unauthorized';
  }

  if (error instanceof BadGatewayException) {
    return 'provider_unavailable';
  }

  return 'unknown';
}

export function getProviderKeyTestFailureMessage(
  provider: ImportProvider,
  reason: ImportProviderKeyTestFailureReason,
) {
  const label = PROVIDERS[provider].label;

  switch (reason) {
    case 'missing_key':
      return `${label} API key is not configured.`;
    case 'unauthorized':
      return `${label} API key was rejected by the provider.`;
    case 'provider_unavailable':
      return `${label} provider is temporarily unavailable.`;
    case 'unknown':
    default:
      return `${label} API key connection test failed.`;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
