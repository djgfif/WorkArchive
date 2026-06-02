import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  buildMessage,
  IsObject,
  type ValidationOptions,
  ValidateBy,
} from 'class-validator';

import {
  isProviderCredentialValuesInput,
  normalizeProviderCredentialValuesInput,
  PROVIDER_CREDENTIAL_VALUE_MAX_LENGTH,
  PROVIDER_CREDENTIAL_VALUES_MAX_FIELDS,
} from '../credentials/provider-credential-values';

function IsProviderCredentialValues(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isProviderCredentialValues',
      validator: {
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be a non-empty object with at most ${PROVIDER_CREDENTIAL_VALUES_MAX_FIELDS} string values.`,
          validationOptions,
        ),
        validate: isProviderCredentialValuesInput,
      },
    },
    validationOptions,
  );
}

export class UpsertProviderKeyDto {
  @ApiProperty({
    additionalProperties: {
      maxLength: PROVIDER_CREDENTIAL_VALUE_MAX_LENGTH,
      type: 'string',
    },
    description: 'Provider-specific credential values keyed by field name.',
    example: {
      apiKey: 'provider-api-key',
    },
    maxProperties: PROVIDER_CREDENTIAL_VALUES_MAX_FIELDS,
  })
  @Transform(({ value }) => normalizeProviderCredentialValuesInput(value))
  @IsObject()
  @IsProviderCredentialValues()
  values!: Record<string, string>;
}
