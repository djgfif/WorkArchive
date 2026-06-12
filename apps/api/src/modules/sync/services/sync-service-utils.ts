import { BadRequestException } from '@nestjs/common';

import { SYNC_SCHEMA_VERSION } from '../sync.constants';

export type StructuredLogFields = {
  count?: number;
  durationMs?: number;
  entityType?: string;
  errorCode?: string | undefined;
  provider?: string;
  requestId?: string | undefined;
  userId?: string;
};

type StructuredLogger = {
  log(message: string): unknown;
};

export function assertSupportedSyncSchemaVersion({
  schemaVersion,
}: {
  schemaVersion?: unknown;
}) {
  if (schemaVersion === undefined) {
    return;
  }

  if (schemaVersion !== SYNC_SCHEMA_VERSION) {
    throw new BadRequestException(
      `Unsupported sync schema version "${String(schemaVersion)}". Supported version is ${SYNC_SCHEMA_VERSION}.`,
    );
  }
}

export function parseIsoDate(value: string, fieldName: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(
      `${fieldName} must be a valid ISO 8601 date string.`,
    );
  }

  return parsed;
}

export function describeError(error: unknown) {
  if (error instanceof Error) {
    return error.name;
  }

  return 'UnknownError';
}

export function logStructuredSyncEvent(
  logger: StructuredLogger,
  event: string,
  fields: StructuredLogFields,
) {
  logger.log(
    JSON.stringify({
      count: fields.count ?? null,
      durationMs: fields.durationMs ?? null,
      entityType: fields.entityType ?? null,
      errorCode: fields.errorCode ?? null,
      event,
      provider: fields.provider ?? null,
      requestId: fields.requestId ?? null,
      userId: fields.userId ?? null,
    }),
  );
}
