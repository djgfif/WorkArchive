import { BadRequestException } from '@nestjs/common';

import type { ProviderCredentialValues } from '../providers/import-provider-adapter';
import {
  PROVIDERS,
} from '../providers/import-provider-adapter';
import type { ImportProvider } from '../imports.constants';
import {
  assertProviderCredentialValuesInput,
  normalizeProviderCredentialValuesInput,
} from './provider-credential-values';

export function resolveProviderCredentialValuesFromPayload(
  provider: ImportProvider,
  payload: unknown,
) {
  if (!isPlainRecord(payload)) {
    throw new BadRequestException(
      'Provider credential payload must be an object.',
    );
  }

  const values = isPlainRecord(payload.values)
    ? normalizeProviderCredentialValuesInput(payload.values)
    : collectFlatProviderCredentialValues(provider, payload);

  assertProviderCredentialValuesInput(values);

  return values;
}

function collectFlatProviderCredentialValues(
  provider: ImportProvider,
  payload: Record<string, unknown>,
) {
  const values: ProviderCredentialValues = {};

  for (const field of PROVIDERS[provider].credentialFields ?? []) {
    const value = payload[field.name];

    if (typeof value === 'string') {
      values[field.name] = value.trim();
    }
  }

  return values;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}
