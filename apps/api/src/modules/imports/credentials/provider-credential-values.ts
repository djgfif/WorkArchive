import { BadRequestException } from '@nestjs/common';

import type { ProviderCredentialValues } from '../providers/import-provider-adapter';

export const PROVIDER_CREDENTIAL_VALUES_MAX_FIELDS = 10;
export const PROVIDER_CREDENTIAL_FIELD_NAME_MAX_LENGTH = 80;
export const PROVIDER_CREDENTIAL_VALUE_MAX_LENGTH = 4096;

const PROVIDER_CREDENTIAL_FIELD_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_:-]*$/;

export function normalizeProviderCredentialValuesInput(value: unknown) {
  if (!isPlainRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, rawValue]) => [
      key,
      typeof rawValue === 'string' ? rawValue.trim() : rawValue,
    ]),
  );
}

export function assertProviderCredentialValuesInput(
  value: unknown,
): asserts value is ProviderCredentialValues {
  if (!isProviderCredentialValuesInput(value)) {
    throw new BadRequestException(
      'Provider credential values must be a small object of string values.',
    );
  }
}

export function isProviderCredentialValuesInput(
  value: unknown,
): value is ProviderCredentialValues {
  if (!isPlainRecord(value)) {
    return false;
  }

  const entries = Object.entries(value);

  if (
    entries.length === 0 ||
    entries.length > PROVIDER_CREDENTIAL_VALUES_MAX_FIELDS
  ) {
    return false;
  }

  return entries.every(([key, rawValue]) => {
    return (
      key.length > 0 &&
      key.length <= PROVIDER_CREDENTIAL_FIELD_NAME_MAX_LENGTH &&
      PROVIDER_CREDENTIAL_FIELD_NAME_PATTERN.test(key) &&
      typeof rawValue === 'string' &&
      rawValue.length <= PROVIDER_CREDENTIAL_VALUE_MAX_LENGTH
    );
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}
