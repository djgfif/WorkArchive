import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from '@jest/globals';

import {
  PROVIDER_CREDENTIAL_VALUE_MAX_LENGTH,
  PROVIDER_CREDENTIAL_VALUES_MAX_FIELDS,
} from '../src/modules/imports/credentials/provider-credential-values';
import { resolveProviderCredentialValuesFromPayload } from '../src/modules/imports/credentials/provider-credential-payload';
import { UpsertProviderKeyDto } from '../src/modules/imports/dto/upsert-provider-key.dto';
import {
  ALADIN_PROVIDER,
  BRAVE_SEARCH_PROVIDER,
  NAVER_BOOK_PROVIDER,
} from '../src/modules/imports/imports.constants';

describe('upsert provider key DTO', () => {
  it('accepts and trims bounded provider credential values', async () => {
    const dto = plainToInstance(UpsertProviderKeyDto, {
      values: {
        clientId: ' naver-client-id ',
        clientSecret: ' naver-client-secret ',
      },
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.values).toEqual({
      clientId: 'naver-client-id',
      clientSecret: 'naver-client-secret',
    });
  });

  it('rejects nested, non-string, or oversized credential values', async () => {
    const nestedValueDto = plainToInstance(UpsertProviderKeyDto, {
      values: {
        clientId: {
          nested: 'not-a-string',
        },
        clientSecret: 'naver-client-secret',
      },
    });
    const oversizedValueDto = plainToInstance(UpsertProviderKeyDto, {
      values: {
        clientId: 'a'.repeat(PROVIDER_CREDENTIAL_VALUE_MAX_LENGTH + 1),
      },
    });

    await expect(validate(nestedValueDto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'values',
        }),
      ]),
    );
    await expect(validate(oversizedValueDto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'values',
        }),
      ]),
    );
  });

  it('rejects empty, oversized, or malformed credential value records', async () => {
    const emptyDto = plainToInstance(UpsertProviderKeyDto, {
      values: {},
    });
    const tooManyFieldsDto = plainToInstance(UpsertProviderKeyDto, {
      values: Object.fromEntries(
        Array.from(
          { length: PROVIDER_CREDENTIAL_VALUES_MAX_FIELDS + 1 },
          (_value, index) => [`field${index}`, 'secret'],
        ),
      ),
    });
    const malformedKeyDto = plainToInstance(UpsertProviderKeyDto, {
      values: {
        'not a field': 'secret',
      },
    });

    for (const dto of [emptyDto, tooManyFieldsDto, malformedKeyDto]) {
      await expect(validate(dto)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'values',
          }),
        ]),
      );
    }
  });
});

describe('provider credential payload resolver', () => {
  it('normalizes the canonical values wrapper for multi-field providers', () => {
    expect(
      resolveProviderCredentialValuesFromPayload(NAVER_BOOK_PROVIDER, {
        values: {
          clientId: ' naver-client-id ',
          clientSecret: ' naver-client-secret ',
        },
      }),
    ).toEqual({
      clientId: 'naver-client-id',
      clientSecret: 'naver-client-secret',
    });
  });

  it('normalizes flat provider credential payloads for every provider route', () => {
    expect(
      resolveProviderCredentialValuesFromPayload(ALADIN_PROVIDER, {
        ttbKey: ' ttb-test-key ',
      }),
    ).toEqual({
      ttbKey: 'ttb-test-key',
    });

    expect(
      resolveProviderCredentialValuesFromPayload(BRAVE_SEARCH_PROVIDER, {
        apiKey: ' brave-user-key ',
      }),
    ).toEqual({
      apiKey: 'brave-user-key',
    });
  });

  it('ignores unrelated flat fields and rejects empty credential payloads', () => {
    expect(() =>
      resolveProviderCredentialValuesFromPayload(BRAVE_SEARCH_PROVIDER, {
        ttbKey: 'wrong-field',
      }),
    ).toThrow('Provider credential values must be a small object');
  });
});
